import React, { useState, useEffect } from 'react';
import { CheckCircle2, CircleDot, Loader, Download } from 'lucide-react';
import { translations } from '../utils/translations';
import {
  listenToExpenses, listenToFundContributions, listenToTourMembers,
  markTransactionSettled, listenToSettlements
} from '../utils/tourStorage';
import { calculateSettlement } from '../utils/tourCalculations';
import TourReportModal from './TourReportModal';

export default function TourSettlementTab({ tourId, tour, lang = 'bn', user }) {
  const t = translations[lang] || translations['bn'];
  const [expenses, setExpenses] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [members, setMembers] = useState([]);
  const [settledKeys, setSettledKeys] = useState(new Set());
  const [settling, setSettling] = useState(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    const u1 = listenToExpenses(tourId, setExpenses);
    const u2 = listenToFundContributions(tourId, setContributions);
    const u3 = listenToTourMembers(tourId, setMembers);
    const u4 = listenToSettlements(tourId, (list) => {
      setSettledKeys(new Set(list.map(s => s.key)));
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, [tourId]);

  // Combine registered members + guests
  const allMembers = [
    ...members.map(m => ({ key: m.uid, name: m.name || m.displayName || 'Member', uid: m.uid })),
    ...(tour?.guestMembers || []).map(g => ({ key: g.id, name: g.name, guestId: g.id }))
  ];

  const { balances, transactions } = calculateSettlement(allMembers, expenses, contributions);

  const handleSettle = async (tx) => {
    setSettling(tx.key);
    await markTransactionSettled(tourId, tx.key, user?.uid);
    setSettling(null);
  };

  const pendingTransactions = transactions.filter(tx => !settledKeys.has(tx.key));
  const settledTransactions = transactions.filter(tx => settledKeys.has(tx.key));
  const allDone = transactions.length > 0 && pendingTransactions.length === 0;

  return (
    <div className="tour-settlement-tab">
      {/* Header with export button */}
      <div className="tour-tab-section-header">
        <span>💸 {t.whoOwesWhom}</span>
        <button className="tour-add-btn" onClick={() => setShowReport(true)}>
          <Download size={14} /> {t.exportReport}
        </button>
      </div>

      {/* Balance summary */}
      {balances.length > 0 && (
        <div className="tour-balances">
          {balances.map(b => (
            <div key={b.key} className={`tour-balance-row ${b.balance > 0 ? 'positive' : b.balance < 0 ? 'negative' : 'zero'}`}>
              <span className="tour-balance-name">{b.name}</span>
              <span className="tour-balance-value">
                {b.balance > 0 ? `+৳${b.balance.toFixed(0)}` : b.balance < 0 ? `-৳${Math.abs(b.balance).toFixed(0)}` : '✓ 0'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* All settled */}
      {allDone && (
        <div className="tour-all-settled">
          <CheckCircle2 size={40} />
          <p>{t.allSettled}</p>
        </div>
      )}

      {/* Pending transactions */}
      {pendingTransactions.length > 0 && (
        <div className="tour-transactions">
          <div className="tour-transactions-title">{lang === 'bn' ? '⏳ বাকি লেনদেন' : '⏳ Pending'}</div>
          {pendingTransactions.map(tx => (
            <div key={tx.key} className="tour-transaction-row">
              <div className="tour-tx-left">
                <span className="tour-tx-from">{tx.from.name}</span>
                <span className="tour-tx-arrow">→ {t.owes} →</span>
                <span className="tour-tx-to">{tx.to.name}</span>
              </div>
              <div className="tour-tx-right">
                <span className="tour-tx-amount">৳{tx.amount.toLocaleString('en-IN')}</span>
                <button
                  className="tour-settle-btn"
                  onClick={() => handleSettle(tx)}
                  disabled={settling === tx.key}
                >
                  {settling === tx.key ? <Loader size={13} className="spin" /> : <CircleDot size={13} />}
                  {t.markSettled}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settled transactions */}
      {settledTransactions.length > 0 && (
        <div className="tour-transactions settled-section">
          <div className="tour-transactions-title">{lang === 'bn' ? '✅ মিটিয়ে দেওয়া হয়েছে' : '✅ Settled'}</div>
          {settledTransactions.map(tx => (
            <div key={tx.key} className="tour-transaction-row settled">
              <div className="tour-tx-left">
                <span className="tour-tx-from">{tx.from.name}</span>
                <span className="tour-tx-arrow">→</span>
                <span className="tour-tx-to">{tx.to.name}</span>
              </div>
              <div className="tour-tx-right">
                <span className="tour-tx-amount">৳{tx.amount.toLocaleString('en-IN')}</span>
                <span className="tour-settled-badge">{t.settled}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {transactions.length === 0 && expenses.length === 0 && (
        <div className="tour-empty-sub">{lang === 'bn' ? 'খরচ যোগ করলে হিসাব দেখা যাবে' : 'Add expenses to see settlement'}</div>
      )}

      {showReport && (
        <TourReportModal
          tourId={tourId}
          tour={tour}
          members={members}
          expenses={expenses}
          contributions={contributions}
          balances={balances}
          transactions={transactions}
          settledKeys={settledKeys}
          lang={lang}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
