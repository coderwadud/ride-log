import React from 'react';
import { Gauge, Fuel, Wrench, Coins, Droplets, ChevronRight } from 'lucide-react';
import { translations } from '../utils/translations';
import { formatCurrency, formatNum } from '../utils/calculations';

export default function Dashboard({
  lang,
  fuelStats,
  serviceStats,
  bikeProfile,
  onOpenAddFuel,
  onOpenAddService,
  recentLogs,
  onNavigateTab
}) {
  const t = translations[lang] || translations.bn;
  const { 
    avgMileage, 
    totalFuelSpent, 
    costPerKm, 
    totalDistance, 
    totalLiters,
    lastFuelLiters,
    lastFuelCost,
    lastMileage 
  } = fuelStats;
  const { totalServiceSpent, kmUntilNextOilChange, oilHealthPercentage, oilStatus, lastOilChangeKm } = serviceStats;

  return (
    <div className="dashboard-view">
      {/* Engine Oil Health Banner */}
      <div className={`card oil-health-card ${oilStatus}`}>
        <div className="oil-info-left">
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: oilStatus === 'good' ? 'rgba(16, 185, 129, 0.15)' : oilStatus === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: oilStatus === 'good' ? '#10b981' : oilStatus === 'warning' ? '#f59e0b' : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Droplets size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h4 style={{ fontSize: '0.98rem' }}>{t.oilHealth}</h4>
              <span className={`log-badge ${oilStatus === 'good' ? 'badge-full' : 'badge-partial'}`}>
                {oilStatus === 'good' ? t.oilStatusGood : oilStatus === 'warning' ? t.oilStatusWarning : t.oilStatusDanger}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {t.lastOilChange}: {lastOilChangeKm ? `${formatNum(lastOilChangeKm, lang)} ${t.km}` : 'N/A'} • {formatNum(kmUntilNextOilChange, lang)} {t.kmRemaining}
            </p>
            
            {/* Progress bar */}
            <div className="oil-progress-bar-bg">
              <div 
                className="oil-progress-fill"
                style={{
                  width: `${oilHealthPercentage}%`,
                  background: oilStatus === 'good' ? '#10b981' : oilStatus === 'warning' ? '#f59e0b' : '#ef4444'
                }}
              />
            </div>
          </div>
        </div>

        <button className="btn btn-service" onClick={onOpenAddService} style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
          <Wrench size={16} />
          <span>{t.addService}</span>
        </button>
      </div>

      {/* Primary KPI Stats Grid */}
      <div className="stats-grid">
        {/* Average Mileage */}
        <div className="card stat-card mileage">
          <div className="stat-icon-wrap">
            <span className="stat-label">{t.avgMileage}</span>
            <div className="stat-icon"><Gauge size={18} /></div>
          </div>
          <div>
            <div className="stat-value">
              {formatNum(avgMileage, lang)}
              <span className="stat-unit">{t.kmPerLiter}</span>
            </div>
          </div>
        </div>

        {/* Total Fuel Expense */}
        <div className="card stat-card fuel">
          <div className="stat-icon-wrap">
            <span className="stat-label">{t.totalFuelExpense}</span>
            <div className="stat-icon"><Fuel size={18} /></div>
          </div>
          <div>
            <div className="stat-value">
              {formatCurrency(totalFuelSpent, lang)}
            </div>
          </div>
        </div>

        {/* Total Service Expense */}
        <div className="card stat-card service">
          <div className="stat-icon-wrap">
            <span className="stat-label">{t.totalServiceExpense}</span>
            <div className="stat-icon"><Wrench size={18} /></div>
          </div>
          <div>
            <div className="stat-value">
              {formatCurrency(totalServiceSpent, lang)}
            </div>
          </div>
        </div>

        {/* Cost Per Km */}
        <div className="card stat-card cost">
          <div className="stat-icon-wrap">
            <span className="stat-label">{t.costPerKm}</span>
            <div className="stat-icon"><Coins size={18} /></div>
          </div>
          <div>
            <div className="stat-value">
              {formatNum(costPerKm, lang)}
              <span className="stat-unit">৳/{t.km}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats Summary Grid (Total Distance, Total Fuel, Last Fuel, Last Mileage) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {/* Total Distance */}
        <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-mileage)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Gauge size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.totalDistance}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {formatNum(totalDistance, lang)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)' }}>{t.km}</span>
            </div>
          </div>
        </div>

        {/* Total Fuel Consumed */}
        <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--accent-fuel)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Fuel size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.totalLiters}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {formatNum(totalLiters, lang)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)' }}>{t.liter}</span>
            </div>
          </div>
        </div>

        {/* Last Fuel Refill */}
        <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16, 185, 129, 0.18)', color: 'var(--accent-fuel)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Fuel size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.lastFuel}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {lastFuelLiters > 0 ? formatNum(lastFuelLiters, lang) : '--'} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)' }}>{t.liter}</span>
              {lastFuelCost > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--accent-fuel)', marginLeft: '4px' }}>({formatCurrency(lastFuelCost, lang)})</span>}
            </div>
          </div>
        </div>

        {/* Last Mileage */}
        <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(56, 189, 248, 0.18)', color: 'var(--accent-mileage)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Gauge size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.lastMileage}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-mileage)' }}>
              {lastMileage > 0 ? formatNum(lastMileage, lang) : '--'} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)' }}>{t.kmPerLiter}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className="btn btn-primary" style={{ flex: 1, padding: '12px' }} onClick={onOpenAddFuel}>
          <Fuel size={18} />
          <span>{t.addFuel}</span>
        </button>
        <button className="btn btn-service" style={{ flex: 1, padding: '12px' }} onClick={onOpenAddService}>
          <Wrench size={18} />
          <span>{t.addService}</span>
        </button>
      </div>

      {/* Recent Activity Feed */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '1.05rem' }}>{t.recentLogs}</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            {t.odometerLabel} {formatNum(bikeProfile?.currentOdometer || 0, lang)} {t.km}
          </span>
        </div>

        {recentLogs.length === 0 ? (
          <div className="empty-state">
            <Fuel className="empty-icon" />
            <p style={{ fontWeight: 600 }}>{t.noData}</p>
            <p style={{ fontSize: '0.85rem' }}>{t.noDataSub}</p>
          </div>
        ) : (
          <div>
            <div className="log-list">
              {recentLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="log-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      background: log.isFuel ? 'rgba(16, 185, 129, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                      color: log.isFuel ? 'var(--accent-fuel)' : 'var(--accent-service)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {log.isFuel ? <Fuel size={18} /> : <Wrench size={18} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="log-main-title">
                        {log.isFuel 
                          ? `${formatNum(log.liters, lang)} ${t.liter} ${t.fuelRefillLabel}` 
                          : (log.notes || t.bikeServiceLabel)}
                      </div>
                      <div className="log-date">
                        {log.date} • {formatNum(log.odometer, lang)} {t.km}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {formatCurrency(log.totalAmount || (log.serviceCost + log.partsCost), lang)}
                    </div>
                    {log.isFuel && log.calculatedMileage && (
                      <span className="log-badge badge-full">
                        {formatNum(log.calculatedMileage, lang)} {t.kmPerLiter}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Navigation to Full Log Pages */}
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={() => onNavigateTab?.('fuel')}
                style={{
                  flex: 1,
                  minWidth: '130px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--accent-fuel)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Fuel size={14} />
                <span>{lang === 'bn' ? 'সব ফুয়েল লগ' : 'All Fuel Logs'}</span>
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                className="btn"
                onClick={() => onNavigateTab?.('service')}
                style={{
                  flex: 1,
                  minWidth: '130px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'rgba(139, 92, 246, 0.1)',
                  color: 'var(--accent-service)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Wrench size={14} />
                <span>{lang === 'bn' ? 'সব সার্ভিস লগ' : 'All Service Logs'}</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
