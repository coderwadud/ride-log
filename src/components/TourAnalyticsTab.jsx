import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Award, Fuel, Gauge, DollarSign, Users,
  Bike, Trophy, Sparkles, MapPin, Clock, ArrowUpRight
} from 'lucide-react';
import { translations } from '../utils/translations';
import { listenToTourMembers, listenToExpenses } from '../utils/tourStorage';

export default function TourAnalyticsTab({ tourId, tour, lang = 'bn', user }) {
  const t = translations[lang] || translations['bn'];

  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    if (!tourId) return;
    const unsub1 = listenToTourMembers(tourId, setMembers);
    const unsub2 = listenToExpenses(tourId, setExpenses);
    return () => { unsub1(); unsub2(); };
  }, [tourId]);

  const totalDist = tour?.estimatedDistanceKm || 0;
  const numMembers = members.length || tour?.numMembers || 1;
  const numBikes = tour?.numBikes || numMembers;

  const totalExpense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const fuelExpenses = expenses.filter(e => e.category === 'fuel');
  const totalFuelCost = fuelExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0) || (tour?.costEstimate?.fuelCost || 0);

  const kmPerLiter = tour?.costEstimate?.kmPerLiter || 40;
  const totalFuelLiters = Math.round(((totalDist * numBikes) / kmPerLiter) * 10) / 10;
  const costPerPerson = Math.round(totalExpense / numMembers);
  const costPerKm = totalDist > 0 ? (totalExpense / totalDist).toFixed(2) : '0.00';

  // Format hours & mins
  const formatDuration = (hrs) => {
    if (!hrs) return '--';
    const totalMinutes = Math.round(hrs * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (lang === 'bn') return `${h > 0 ? `${h} ঘণ্টা ` : ''}${m} মিনিট`;
    return `${h > 0 ? `${h}h ` : ''}${m}m`;
  };

  return (
    <div className="tour-analytics-tab">
      {/* Overview KPI Cards */}
      <div className="tour-analytics-kpi-grid">
        <div className="tour-analytics-card">
          <div className="tour-analytics-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
            <MapPin size={18} />
          </div>
          <div className="tour-analytics-info">
            <span className="label">{lang === 'bn' ? 'মোট দূরত্ব' : 'Total Distance'}</span>
            <strong className="val">{totalDist} km</strong>
            <span className="sub">{numBikes} {lang === 'bn' ? 'টি বাইক' : 'bikes'}</span>
          </div>
        </div>

        <div className="tour-analytics-card">
          <div className="tour-analytics-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <Clock size={18} />
          </div>
          <div className="tour-analytics-info">
            <span className="label">{lang === 'bn' ? 'আনুমানিক সময়' : 'Estimated Time'}</span>
            <strong className="val">{formatDuration(tour?.estimatedDurationHours)}</strong>
            <span className="sub">Avg ~45 km/h</span>
          </div>
        </div>

        <div className="tour-analytics-card">
          <div className="tour-analytics-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <Fuel size={18} />
          </div>
          <div className="tour-analytics-info">
            <span className="label">{lang === 'bn' ? 'মোট জ্বালানি' : 'Total Fuel'}</span>
            <strong className="val">{totalFuelLiters} L</strong>
            <span className="sub">৳{totalFuelCost} ({kmPerLiter} km/L)</span>
          </div>
        </div>

        <div className="tour-analytics-card">
          <div className="tour-analytics-icon" style={{ background: 'rgba(236,72,153,0.15)', color: '#ec4899' }}>
            <DollarSign size={18} />
          </div>
          <div className="tour-analytics-info">
            <span className="label">{lang === 'bn' ? 'মোট খরচ' : 'Total Expense'}</span>
            <strong className="val">৳{totalExpense.toLocaleString()}</strong>
            <span className="sub">৳{costPerPerson}/person</span>
          </div>
        </div>
      </div>

      {/* Bike-wise Statistics */}
      <div className="tour-analytics-section">
        <div className="tour-analytics-section-title">
          <Bike size={16} className="text-indigo-400" />
          <span>{lang === 'bn' ? 'বাইক-ওয়াইজ পারফরম্যান্স ও ফুয়েল হিসাব' : 'Bike-wise Performance & Fuel Stats'}</span>
        </div>

        <div className="tour-bike-stats-list">
          {members.map((member, idx) => {
            const bikeName = member.bikeModel || member.bike || `Bike #${idx + 1}`;
            const riderMileage = member.mileage || kmPerLiter;
            const riderFuelLiters = Math.round((totalDist / riderMileage) * 10) / 10;
            const riderFuelCost = Math.round(riderFuelLiters * (tour?.costEstimate?.fuelPricePerLiter || 135));

            return (
              <div key={member.id || idx} className="tour-bike-stat-row">
                <div className="tour-bike-stat-left">
                  <div className="tour-bike-icon-circle">
                    <Bike size={16} />
                  </div>
                  <div>
                    <strong>{bikeName}</strong>
                    <span className="rider-name">Rider: {member.name} {member.isOrganizer ? '👑' : ''}</span>
                  </div>
                </div>

                <div className="tour-bike-stat-right">
                  <div className="stat-pill">
                    <span className="lbl">দূরত্ব:</span>
                    <strong>{totalDist} km</strong>
                  </div>
                  <div className="stat-pill">
                    <span className="lbl">ফুয়েল:</span>
                    <strong>{riderFuelLiters} L</strong>
                  </div>
                  <div className="stat-pill highlight">
                    <span className="lbl">খরচ:</span>
                    <strong>৳{riderFuelCost}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fun Tour Leaderboard & Achievements */}
      <div className="tour-analytics-section">
        <div className="tour-analytics-section-title">
          <Trophy size={16} className="text-amber-400" />
          <span>{lang === 'bn' ? 'ট্যুর লিডারবোর্ড ও ট্রফি' : 'Tour Leaderboard & Achievements'}</span>
        </div>

        <div className="tour-leaderboard-grid">
          <div className="tour-leaderboard-card gold">
            <div className="trophy-badge">🏆</div>
            <div className="leaderboard-info">
              <span className="badge-title">{lang === 'bn' ? 'সেরা মাইলেজ রাইডার' : 'Best Mileage Rider'}</span>
              <strong className="rider-winner">{members[0]?.name || 'Leader'}</strong>
              <span className="score">~{kmPerLiter + 2} km/L Fuel Efficiency</span>
            </div>
          </div>

          <div className="tour-leaderboard-card silver">
            <div className="trophy-badge">⛽</div>
            <div className="leaderboard-info">
              <span className="badge-title">{lang === 'bn' ? 'সাশ্রয়ী রাইডার' : 'Most Economic'}</span>
              <strong className="rider-winner">{members[1]?.name || members[0]?.name || 'Rider'}</strong>
              <span className="score">৳{costPerKm}/km Ride Cost</span>
            </div>
          </div>

          <div className="tour-leaderboard-card bronze">
            <div className="trophy-badge">🛣️</div>
            <div className="leaderboard-info">
              <span className="badge-title">{lang === 'bn' ? 'ট্যুর এক্সপ্লোরার' : 'Tour Cruiser'}</span>
              <strong className="rider-winner">{members[2]?.name || members[0]?.name || 'Explorer'}</strong>
              <span className="score">{totalDist} km Highway Cruised</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
