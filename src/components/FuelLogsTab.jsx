import React from 'react';
import { Fuel, Plus, Edit2, Trash2, MapPin } from 'lucide-react';
import { translations } from '../utils/translations';
import { formatCurrency, formatNum } from '../utils/calculations';

export default function FuelLogsTab({ lang, fuelLogsStats, onOpenAddFuel, onEditFuel, onDeleteFuel }) {
  const t = translations[lang];
  const logs = fuelLogsStats.processedLogs || [];

  return (
    <div className="fuel-logs-view">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>{t.fuelLogs}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {t.totalDistance}: {formatNum(fuelLogsStats.totalDistance, lang)} {t.km}
          </p>
        </div>
        <button className="btn btn-primary" onClick={onOpenAddFuel} style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
          <Plus size={16} />
          <span>{t.addFuel}</span>
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="card empty-state">
          <Fuel className="empty-icon" />
          <p style={{ fontWeight: 600 }}>{t.noData}</p>
          <p style={{ fontSize: '0.85rem' }}>{t.noDataSub}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="log-list">
            {logs.map((log) => (
              <div key={log.id} className="log-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--accent-fuel)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Fuel size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="log-main-title" style={{ fontSize: '0.88rem' }}>
                        {formatNum(log.liters, lang)} {t.liter} @ ৳{formatNum(log.pricePerLiter, lang)}
                      </span>
                      <span className={`log-badge ${log.isFullTank ? 'badge-full' : 'badge-partial'}`}>
                        {log.isFullTank ? t.fullTankBadge : t.partialTankBadge}
                      </span>
                    </div>

                    <div className="log-date" style={{ marginTop: '2px' }}>
                      📅 {log.date} • 🛣️ {formatNum(log.odometer, lang)} {t.km}
                      {log.tripDistance > 0 && ` (+${formatNum(log.tripDistance, lang)} ${t.km})`}
                    </div>

                    {log.stationName && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <MapPin size={11} />
                        <span>{log.stationName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-fuel)' }}>
                      {formatCurrency(log.totalAmount, lang)}
                    </div>
                    {log.calculatedMileage ? (
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-mileage)' }}>
                        {formatNum(Number(log.tripDistance) / Number(log.liters), lang)} {t.km}/{t.liter}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>--</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button className="btn btn-icon" onClick={() => onEditFuel(log)} style={{ padding: '5px' }}>
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-icon" onClick={() => onDeleteFuel(log.id)} style={{ padding: '5px', color: '#ef4444' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
