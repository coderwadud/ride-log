import React, { useState, useEffect } from 'react';
import { Plus, Trash2, PiggyBank, Loader } from 'lucide-react';
import { translations } from '../utils/translations';
import { listenToFundContributions, addFundContribution, deleteFundContribution, listenToExpenses } from '../utils/tourStorage';
import { getTotalFundCollected, getTotalExpenses, getFundBalance } from '../utils/tourCalculations';

export default function TourFundTab({ tourId, tour, lang = 'bn', user }) {
  const t = translations[lang] || translations['bn'];
  const [contributions, setContributions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    amount: '',
    contributorType: 'me',
    guestIdx: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  useEffect(() => {
    const unsub1 = listenToFundContributions(tourId, setContributions);
    const unsub2 = listenToExpenses(tourId, setExpenses);
    return () => { unsub1(); unsub2(); };
  }, [tourId]);

  const totalCollected = getTotalFundCollected(contributions);
  const fundExpenses = expenses.filter(e => e.fromFund);
  const totalFromFund = fundExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalCollected - totalFromFund;

  const buildContributedBy = () => {
    if (form.contributorType === 'me') return { uid: user?.uid, name: user?.displayName || 'Me' };
    const gIdx = parseInt(form.guestIdx, 10);
    if (!isNaN(gIdx) && tour?.guestMembers?.[gIdx]) {
      const g = tour.guestMembers[gIdx];
      return { guestId: g.id, name: g.name };
    }
    return { uid: user?.uid, name: user?.displayName || 'Me' };
  };

  const handleSave = async () => {
    if (!form.amount) return;
    setSaving(true);
    await addFundContribution(tourId, {
      amount: parseFloat(form.amount),
      contributedBy: buildContributedBy(),
      date: new Date(form.date).toISOString(),
      notes: form.notes.trim()
    });
    setForm({ amount: '', contributorType: 'me', guestIdx: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(lang === 'bn' ? 'এই চাঁদা মুছবেন?' : 'Delete this contribution?')) return;
    await deleteFundContribution(tourId, id);
  };

  const formatDate = (iso) => {
    try { return new Date(iso).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-BD', { day: 'numeric', month: 'short' }); } catch { return ''; }
  };

  return (
    <div className="tour-fund-tab">
      {/* Fund summary cards */}
      <div className="tour-fund-summary">
        <div className="tour-fund-card collected">
          <div className="tour-fund-card-label">{t.totalCollected}</div>
          <div className="tour-fund-card-value">৳{totalCollected.toLocaleString('en-IN')}</div>
        </div>
        <div className="tour-fund-card spent">
          <div className="tour-fund-card-label">{lang === 'bn' ? 'ফান্ড থেকে খরচ' : 'Spent from Fund'}</div>
          <div className="tour-fund-card-value">৳{totalFromFund.toLocaleString('en-IN')}</div>
        </div>
        <div className={`tour-fund-card balance ${balance >= 0 ? 'positive' : 'negative'}`}>
          <div className="tour-fund-card-label">{t.fundBalance}</div>
          <div className="tour-fund-card-value">৳{balance.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Add contribution */}
      <div className="tour-tab-section-header">
        <span><PiggyBank size={15} /> {t.fund}</span>
        <button className="tour-add-btn" onClick={() => setShowForm(p => !p)}>
          <Plus size={15} /> {t.addContribution}
        </button>
      </div>

      {showForm && (
        <div className="tour-expense-form">
          <div className="form-row-2">
            <div className="form-group">
              <label>{t.contributionAmount} *</label>
              <input className="tour-input" type="number" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-group">
              <label>{t.contributedBy}</label>
              <select className="tour-input" value={form.contributorType} onChange={e => setForm(p => ({ ...p, contributorType: e.target.value }))}>
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
            <div className="form-group">
              <label>{lang === 'bn' ? 'নোট' : 'Notes'}</label>
              <input className="tour-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={lang === 'bn' ? 'ঐচ্ছিক' : 'Optional'} />
            </div>
          </div>
          <div className="tour-form-actions">
            <button className="tour-btn-secondary" onClick={() => setShowForm(false)}>{t.cancel}</button>
            <button className="tour-btn-primary" onClick={handleSave} disabled={saving || !form.amount}>
              {saving ? <Loader size={14} className="spin" /> : <Plus size={14} />} {t.save || 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Contribution list */}
      {contributions.length === 0 ? (
        <div className="tour-empty-sub">{lang === 'bn' ? 'এখনো কোনো চাঁদা নেই' : 'No contributions yet'}</div>
      ) : (
        <div className="tour-contribution-list">
          {contributions.map(contrib => (
            <div key={contrib.id} className="tour-contribution-row">
              <div className="tour-contrib-left">
                <strong>{contrib.contributedBy?.name || '?'}</strong>
                <span>{formatDate(contrib.date)}</span>
                {contrib.notes && <span className="tour-contrib-notes">{contrib.notes}</span>}
              </div>
              <div className="tour-contrib-right">
                <span className="tour-contrib-amount">৳{Number(contrib.amount).toLocaleString('en-IN')}</span>
                <button className="tour-remove-btn" onClick={() => handleDelete(contrib.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fund expenses list */}
      {fundExpenses.length > 0 && (
        <div className="tour-fund-expenses">
          <div className="tour-fund-expenses-title">🏦 {lang === 'bn' ? 'ফান্ড থেকে পরিশোধ' : 'Paid from Fund'}</div>
          {fundExpenses.map(e => (
            <div key={e.id} className="tour-fund-expense-row">
              <span>{e.title}</span>
              <span className="tour-expense-amount">৳{Number(e.amount).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
