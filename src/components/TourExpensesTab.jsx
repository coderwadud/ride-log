import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Fuel, UtensilsCrossed, BedDouble, Milestone, Package, Loader, ChevronDown } from 'lucide-react';
import { translations } from '../utils/translations';
import { listenToExpenses, addExpense, deleteExpense } from '../utils/tourStorage';
import { summarizeExpensesByCategory, getTotalExpenses, EXPENSE_CATEGORIES } from '../utils/tourCalculations';

const CATEGORY_ICONS = {
  fuel: <Fuel size={14} />,
  food: <UtensilsCrossed size={14} />,
  hotel: <BedDouble size={14} />,
  toll: <Milestone size={14} />,
  misc: <Package size={14} />
};

export default function TourExpensesTab({ tourId, tour, lang = 'bn', user }) {
  const t = translations[lang] || translations['bn'];
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);

  // Form state
  const [form, setForm] = useState({
    title: '', amount: '', category: 'misc',
    paidByType: 'me', paidByGuestIdx: '',
    splitType: 'equal', fromFund: false, notes: '', date: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    const unsub = listenToExpenses(tourId, setExpenses);
    return unsub;
  }, [tourId]);

  // All members combined
  const allMembers = [
    ...((tour?.memberIds || []).map(uid => {
      const idx = (tour?.memberIds || []).indexOf(uid);
      return { uid, name: uid === user?.uid ? (lang === 'bn' ? 'আমি' : 'Me') : `Member ${idx + 1}`, isGuest: false };
    })),
    ...(tour?.guestMembers || []).map(g => ({ guestId: g.id, name: g.name, isGuest: true }))
  ];

  const buildPaidBy = () => {
    if (form.paidByType === 'me') return { uid: user?.uid, name: user?.displayName || 'Me' };
    const gIdx = parseInt(form.paidByGuestIdx, 10);
    if (!isNaN(gIdx) && tour?.guestMembers?.[gIdx]) {
      const g = tour.guestMembers[gIdx];
      return { guestId: g.id, name: g.name };
    }
    return { uid: user?.uid, name: user?.displayName || 'Me' };
  };

  const buildSplitAmong = (amount) => {
    if (form.splitType === 'equal') {
      const share = Number(amount) / (allMembers.length || 1);
      return allMembers.map(m => ({ ...m, share: Math.round(share * 100) / 100 }));
    }
    // Custom split not implemented in inline form; defaults to equal
    return [];
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.amount) return;
    setSaving(true);
    const expense = {
      title: form.title.trim(),
      amount: parseFloat(form.amount),
      category: form.category,
      paidBy: buildPaidBy(),
      splitAmong: buildSplitAmong(form.amount),
      date: new Date(form.date).toISOString(),
      notes: form.notes.trim(),
      fromFund: form.fromFund,
      createdByUid: user?.uid || ''
    };
    await addExpense(tourId, expense);
    setForm({ title: '', amount: '', category: 'misc', paidByType: 'me', paidByGuestIdx: '', splitType: 'equal', fromFund: false, notes: '', date: new Date().toISOString().slice(0, 10) });
    setShowForm(false);
    setSaving(false);
  };

  const categoryGroups = summarizeExpensesByCategory(expenses);
  const total = getTotalExpenses(expenses);

  const expensesByCategory = (cat) => expenses.filter(e => e.category === cat);

  return (
    <div className="tour-expenses-tab">
      {/* Total bar */}
      <div className="tour-expenses-total-bar">
        <span>{lang === 'bn' ? 'মোট খরচ' : 'Total Expenses'}</span>
        <strong className="tour-total-amount">৳{total.toLocaleString('en-IN')}</strong>
        <button className="tour-add-btn" onClick={() => setShowForm(p => !p)}>
          <Plus size={15} /> {t.addExpense}
        </button>
      </div>

      {/* Add expense form */}
      {showForm && (
        <div className="tour-expense-form">
          <div className="form-row-2">
            <div className="form-group">
              <label>{t.expenseTitle} *</label>
              <input className="tour-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t.expenseTitlePlaceholder} />
            </div>
            <div className="form-group">
              <label>{t.expenseAmount} *</label>
              <input className="tour-input" type="number" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>{t.expenseCategory}</label>
              <select className="tour-input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {Object.entries(EXPENSE_CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>{val.icon} {lang === 'bn' ? val.label : val.labelEn}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t.paidBy}</label>
              <select className="tour-input" value={form.paidByType} onChange={e => setForm(p => ({ ...p, paidByType: e.target.value }))}>
                <option value="me">{lang === 'bn' ? 'আমি' : 'Me'}</option>
                {(tour?.guestMembers || []).map((g, i) => (
                  <option key={g.id} value={`guest_${i}`}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>{lang === 'bn' ? 'তারিখ' : 'Date'}</label>
              <input className="tour-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="form-group tour-fund-toggle">
              <label className="tour-checkbox-label">
                <input type="checkbox" checked={form.fromFund} onChange={e => setForm(p => ({ ...p, fromFund: e.target.checked }))} />
                {t.fromFund}
              </label>
            </div>
          </div>
          <div className="form-group">
            <label>{lang === 'bn' ? 'নোট' : 'Notes'}</label>
            <input className="tour-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={lang === 'bn' ? 'ঐচ্ছিক' : 'Optional'} />
          </div>
          <div className="tour-form-actions">
            <button className="tour-btn-secondary" onClick={() => setShowForm(false)}>{t.cancel}</button>
            <button className="tour-btn-primary" onClick={handleSave} disabled={saving || !form.title || !form.amount}>
              {saving ? <Loader size={14} className="spin" /> : <Plus size={14} />} {t.save || 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Category groups */}
      {expenses.length === 0 ? (
        <div className="tour-empty-sub">{lang === 'bn' ? 'এখনো কোনো খরচ নেই' : 'No expenses yet'}</div>
      ) : (
        <div className="tour-expense-categories">
          {categoryGroups.map(cat => {
            const catExpenses = expensesByCategory(cat.category);
            const isExpanded = expandedCat === cat.category;
            return (
              <div key={cat.category} className="tour-expense-cat-group">
                <button
                  className="tour-expense-cat-header"
                  onClick={() => setExpandedCat(isExpanded ? null : cat.category)}
                >
                  <span className="tour-cat-icon" style={{ color: cat.color }}>
                    {CATEGORY_ICONS[cat.category]}
                  </span>
                  <span className="tour-cat-name">{lang === 'bn' ? cat.label : cat.labelEn}</span>
                  <span className="tour-cat-count">{cat.count}</span>
                  <span className="tour-cat-total">৳{cat.total.toLocaleString('en-IN')}</span>
                  <ChevronDown size={14} className={isExpanded ? 'rotated' : ''} />
                </button>
                {isExpanded && (
                  <div className="tour-expense-list">
                    {catExpenses.map(exp => (
                      <ExpenseRow key={exp.id} exp={exp} lang={lang} t={t} tourId={tourId} isOrganizer={exp.createdByUid === user?.uid} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExpenseRow({ exp, lang, t, tourId, isOrganizer }) {
  const formatDate = (iso) => {
    try { return new Date(iso).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-BD', { day: 'numeric', month: 'short' }); } catch { return ''; }
  };
  const cat = EXPENSE_CATEGORIES[exp.category] || EXPENSE_CATEGORIES.misc;

  const handleDelete = async () => {
    if (!window.confirm(lang === 'bn' ? 'এই খরচটি মুছবেন?' : 'Delete this expense?')) return;
    await deleteExpense(tourId, exp.id);
  };

  return (
    <div className="tour-expense-row">
      <div className="tour-expense-row-left">
        <div className="tour-expense-title">{exp.title}</div>
        <div className="tour-expense-meta">
          {formatDate(exp.date)} · {lang === 'bn' ? 'দিয়েছেন:' : 'Paid by:'} <strong>{exp.paidBy?.name || '?'}</strong>
          {exp.fromFund && <span className="tour-fund-badge">🏦 {t.fund}</span>}
        </div>
      </div>
      <div className="tour-expense-row-right">
        <span className="tour-expense-amount">৳{Number(exp.amount).toLocaleString('en-IN')}</span>
        {isOrganizer && <button className="tour-remove-btn" onClick={handleDelete}><Trash2 size={13} /></button>}
      </div>
    </div>
  );
}
