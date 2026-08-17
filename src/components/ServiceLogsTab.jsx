import React from 'react';
import { Wrench, Plus, Edit2, Trash2, Calendar, Gauge, FileText } from 'lucide-react';
import { translations } from '../utils/translations';
import { formatCurrency, formatNum } from '../utils/calculations';

export default function ServiceLogsTab({ lang, serviceLogs, serviceStats, onOpenAddService, onEditService, onDeleteService }) {
  const t = translations[lang];

  return (
    <div className="service-logs-view">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>{t.serviceLogs}</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {t.partsCostLabel} {formatCurrency(serviceStats.totalPartsSpent, lang)} • {t.laborCostLabel} {formatCurrency(serviceStats.totalLaborSpent, lang)}
          </p>
        </div>
        <button className="btn btn-service" onClick={onOpenAddService} style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
          <Plus size={16} />
          <span>{t.addService}</span>
        </button>
      </div>

      {serviceLogs.length === 0 ? (
        <div className="card empty-state">
          <Wrench className="empty-icon" />
          <p style={{ fontWeight: 600 }}>{t.noData}</p>
          <p style={{ fontSize: '0.85rem' }}>{t.noDataSub}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="log-list">
            {serviceLogs.map((log) => {
              const totalCost = Number(log.serviceCost || 0) + Number(log.partsCost || 0);

              return (
                <div key={log.id} className="log-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      background: 'rgba(139, 92, 246, 0.15)',
                      color: 'var(--accent-service)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Wrench size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="log-main-title" style={{ fontSize: '0.88rem' }}>
                        {log.garageName || t.bikeServiceLabel}
                      </div>
                      <div className="log-date" style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Calendar size={12} color="var(--text-dim)" />
                          <span>{log.date}</span>
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Gauge size={12} color="var(--text-dim)" />
                          <span>{formatNum(log.odometer, lang)} {t.km}</span>
                        </span>
                      </div>

                      {/* Service Category Badges */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                        {log.types && log.types.map((typeKey) => (
                          <span key={typeKey} style={{
                            fontSize: '0.68rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-color)'
                          }}>
                            {t[typeKey] || typeKey}
                          </span>
                        ))}
                      </div>

                      {log.notes && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FileText size={12} />
                          <span>{log.notes}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-service)' }}>
                        {formatCurrency(totalCost, lang)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button className="btn btn-icon" onClick={() => onEditService(log)} style={{ padding: '5px' }}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-icon" onClick={() => onDeleteService(log.id)} style={{ padding: '5px', color: '#ef4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
