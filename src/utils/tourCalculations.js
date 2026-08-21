/**
 * Tour Calculations — Settlement Algorithm, Cost Estimation, Report Builder
 * Pure utility functions (no Firestore calls).
 */

// ─── SETTLEMENT ALGORITHM ─────────────────────────────────────────────────────

/**
 * Build a unique member key from a member object.
 * Registered members use uid; guests use their guest id.
 */
export function getMemberKey(member) {
  if (!member) return 'unknown';
  return member.uid || member.guestId || member.id || member.name || 'unknown';
}

export function getMemberName(member) {
  return member?.name || member?.displayName || 'Unknown';
}

/**
 * Calculate net balance for each participant.
 * Positive balance = owed money; Negative balance = owes money.
 *
 * @param {Array} allMembers — combined registered + guest members
 * @param {Array} expenses — tour expense records
 * @param {Array} contributions — fund contribution records
 * @returns {Object} { balances: Map<key, {name, balance}>, transactions: Array }
 */
export function calculateSettlement(allMembers, expenses, contributions) {
  // Initialize balance map for every member
  const balanceMap = new Map();

  const ensureMember = (memberRef) => {
    const key = getMemberKey(memberRef);
    if (!balanceMap.has(key)) {
      balanceMap.set(key, {
        key,
        name: getMemberName(memberRef),
        balance: 0 // positive = is owed money; negative = owes money
      });
    }
    return key;
  };

  // Process expenses
  for (const exp of (expenses || [])) {
    if (!exp || !exp.amount) continue;
    const amount = Number(exp.amount) || 0;
    const paidByKey = ensureMember(exp.paidBy);

    // Person who paid gets credit
    balanceMap.get(paidByKey).balance += amount;

    // Each person in splitAmong gets debited their share
    const splits = exp.splitAmong || [];
    if (splits.length > 0) {
      for (const split of splits) {
        const splitKey = ensureMember(split);
        const share = Number(split.share) || (amount / splits.length);
        balanceMap.get(splitKey).balance -= share;
      }
    } else {
      // If no split defined, split equally among all members
      const memberKeys = [...balanceMap.keys()];
      const equalShare = amount / (memberKeys.length || 1);
      for (const k of memberKeys) {
        balanceMap.get(k).balance -= equalShare;
      }
    }
  }

  // Process fund contributions — contributions CREDIT the contributor
  for (const contrib of (contributions || [])) {
    if (!contrib || !contrib.amount) continue;
    const amount = Number(contrib.amount) || 0;
    const contribKey = ensureMember(contrib.contributedBy);
    balanceMap.get(contribKey).balance += amount;
  }

  // Generate minimal transactions using greedy algorithm
  const transactions = generateMinimalTransactions([...balanceMap.values()]);

  return {
    balances: [...balanceMap.values()],
    transactions
  };
}

/**
 * Generate minimal set of transactions to settle all debts.
 * Uses a greedy "most indebted <-> most owed" approach.
 *
 * @param {Array} balances — [{ key, name, balance }]
 * @returns {Array} — [{ from: {key, name}, to: {key, name}, amount }]
 */
function generateMinimalTransactions(balances) {
  const EPSILON = 0.01; // ignore < 1 paisa differences
  const creditors = []; // balance > 0 (are owed)
  const debtors = [];   // balance < 0 (owe)

  for (const b of balances) {
    if (b.balance > EPSILON) creditors.push({ ...b });
    else if (b.balance < -EPSILON) debtors.push({ ...b });
  }

  // Sort descending
  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => a.balance - b.balance);

  const transactions = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const amount = Math.min(creditor.balance, -debtor.balance);

    if (amount > EPSILON) {
      transactions.push({
        key: `${debtor.key}__>${creditor.key}`,
        from: { key: debtor.key, name: debtor.name },
        to: { key: creditor.key, name: creditor.name },
        amount: Math.round(amount * 100) / 100
      });
    }

    creditor.balance -= amount;
    debtor.balance += amount;

    if (creditor.balance < EPSILON) i++;
    if (debtor.balance > -EPSILON) j++;
  }

  return transactions;
}

// ─── COST ESTIMATION ──────────────────────────────────────────────────────────

/**
 * Auto-estimate tour cost breakdown given distance and member count.
 *
 * @param {number} distanceKm — planned route distance
 * @param {number} numMembers — number of participants
 * @param {Object} params — optional override values
 * @returns {Object} costEstimate breakdown
 */
export function calculateCostEstimate(distanceKm, numMembers = 1, params = {}) {
  const km = Number(distanceKm) || 0;
  const members = Math.max(1, Number(numMembers));

  const kmPerLiter = Math.max(1, Number(params.kmPerLiter) || 40);
  const fuelPricePerLiter = Math.max(0, Number(params.fuelPricePerLiter) || 135);
  const days = Math.max(1, Number(params.days) || 1);
  const nights = Math.max(0, Number(params.nights) || 0);

  // Toll cost: check manual override, otherwise calculate from km * 0.5
  let tollCost = Math.round(km * 0.5);
  if (params.tollCostManual !== undefined && params.tollCostManual !== '' && params.tollCostManual !== null) {
    tollCost = Math.max(0, Number(params.tollCostManual) || 0);
  }

  // Food cost
  let foodPerPersonPerDay = 300;
  if (params.foodPerPersonPerDay !== undefined && params.foodPerPersonPerDay !== '' && params.foodPerPersonPerDay !== null) {
    foodPerPersonPerDay = Math.max(0, Number(params.foodPerPersonPerDay) || 0);
  }

  // Hotel cost
  let hotelPerPersonPerNight = nights > 0 ? 800 : 0;
  if (params.hotelPerPersonPerNight !== undefined && params.hotelPerPersonPerNight !== '' && params.hotelPerPersonPerNight !== null) {
    hotelPerPersonPerNight = Math.max(0, Number(params.hotelPerPersonPerNight) || 0);
  }

  const miscBudget = Math.max(0, Number(params.miscBudget) || 0);

  // Calculations
  const litersNeeded = km / kmPerLiter;
  const fuelCost = Math.round(litersNeeded * fuelPricePerLiter);
  const foodCost = Math.round(foodPerPersonPerDay * days * members);
  const hotelCost = Math.round(hotelPerPersonPerNight * nights * members);
  const miscCost = Math.round(miscBudget);
  const totalCost = fuelCost + tollCost + foodCost + hotelCost + miscCost;
  const perMemberCost = members > 0 ? Math.round(totalCost / members) : totalCost;

  return {
    fuelCost,
    tollCost,
    foodCost,
    hotelCost,
    miscCost,
    totalCost,
    perMemberCost,
    litersNeeded: Math.round(litersNeeded * 10) / 10
  };
}

// ─── EXPENSE SUMMARY ──────────────────────────────────────────────────────────

const CATEGORIES = ['fuel', 'food', 'hotel', 'toll', 'misc'];

export const EXPENSE_CATEGORIES = {
  fuel: { label: 'জ্বালানি', labelEn: 'Fuel', icon: '⛽', color: '#f59e0b' },
  food: { label: 'খাবার', labelEn: 'Food', icon: '🍽️', color: '#10b981' },
  hotel: { label: 'হোটেল', labelEn: 'Hotel', icon: '🏨', color: '#6366f1' },
  toll: { label: 'টোল', labelEn: 'Toll', icon: '🛣️', color: '#ef4444' },
  misc: { label: 'অন্যান্য', labelEn: 'Misc', icon: '📦', color: '#8b5cf6' }
};

/**
 * Summarize expenses by category.
 */
export function summarizeExpensesByCategory(expenses) {
  const summary = {};
  for (const cat of CATEGORIES) {
    summary[cat] = { category: cat, total: 0, count: 0, ...EXPENSE_CATEGORIES[cat] };
  }
  for (const exp of (expenses || [])) {
    const cat = exp.category || 'misc';
    if (summary[cat]) {
      summary[cat].total += Number(exp.amount) || 0;
      summary[cat].count++;
    }
  }
  return Object.values(summary).filter(c => c.total > 0);
}

/**
 * Get total of all expenses.
 */
export function getTotalExpenses(expenses) {
  return (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

/**
 * Get total fund collected.
 */
export function getTotalFundCollected(contributions) {
  return (contributions || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

/**
 * Get fund balance (collected - total expenses paid from fund).
 */
export function getFundBalance(contributions, expenses) {
  const collected = getTotalFundCollected(contributions);
  const fromFund = (expenses || [])
    .filter(e => e.fromFund)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  return collected - fromFund;
}

// ─── TOUR STATUS HELPERS ───────────────────────────────────────────────────────

export const TOUR_STATUS = {
  planned: { label: 'পরিকল্পিত', labelEn: 'Planned', color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  active:  { label: 'চলছে',     labelEn: 'Active',  color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  completed: { label: 'সম্পন্ন', labelEn: 'Done',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  cancelled: { label: 'বাতিল',   labelEn: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
};

export function getTourStatus(status) {
  return TOUR_STATUS[status] || TOUR_STATUS.planned;
}

/**
 * Format duration in hours to human-readable Bengali/English.
 */
export function formatDuration(hours, lang = 'bn') {
  if (!hours) return lang === 'bn' ? '০ ঘণ্টা' : '0 hrs';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (lang === 'bn') {
    return h > 0 ? `${h} ঘণ্টা ${m > 0 ? m + ' মিনিট' : ''}` : `${m} মিনিট`;
  }
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}` : `${m}m`;
}
