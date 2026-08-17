import React, { useState, useMemo } from 'react';
import {
  Wrench, Plus, Edit2, Trash2, Calendar, Gauge, FileText,
  Search, X, ChevronLeft, ChevronRight, Filter, ArrowUpDown
} from 'lucide-react';
import { translations } from '../utils/translations';
import { formatCurrency, formatNum } from '../utils/calculations';

export default function ServiceLogsTab({
  lang,
  serviceLogs = [],
  serviceStats,
  onOpenAddService,
  onEditService,
  onDeleteService
}) {
  const isBn = lang === 'bn';
  const t = translations[lang] || translations.bn;

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all'); // 'all', 'oil', 'brake', 'tire', 'chain', etc.
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest', 'highest_cost'
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Extract all available service categories
  const allServiceCategories = useMemo(() => {
    const cats = new Set();
    serviceLogs.forEach(log => {
      if (Array.isArray(log.types)) {
        log.types.forEach(typeKey => cats.add(typeKey));
      }
    });
    return Array.from(cats);
  }, [serviceLogs]);

  // Filter & Sort Logic
  const filteredLogs = useMemo(() => {
    let list = [...serviceLogs];

    // Category Filter
    if (filterCategory !== 'all') {
      list = list.filter(item => Array.isArray(item.types) && item.types.includes(filterCategory));
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => {
        const garage = (item.garageName || '').toLowerCase();
        const date = (item.date || '').toLowerCase();
        const notes = (item.notes || '').toLowerCase();
        const odo = String(item.odometer || '');
        const total = String(Number(item.serviceCost || 0) + Number(item.partsCost || 0));
        const matchedCategory = Array.isArray(item.types) && item.types.some(tKey => (t[tKey] || tKey).toLowerCase().includes(q));
        return garage.includes(q) || date.includes(q) || notes.includes(q) || odo.includes(q) || total.includes(q) || matchedCategory;
      });
    }

    // Sort Order
    if (sortOrder === 'oldest') {
      list.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    } else if (sortOrder === 'highest_cost') {
      list.sort((a, b) => (Number(b.serviceCost || 0) + Number(b.partsCost || 0)) - (Number(a.serviceCost || 0) + Number(a.partsCost || 0)));
    } else {
      // Default: Newest first
      list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }

    return list;
  }, [serviceLogs, filterCategory, searchQuery, sortOrder, t]);

  // Pagination Calculation
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedLogs = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, validCurrentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterCategory('all');
    setSortOrder('newest');
    setCurrentPage(1);
  };

  return (
    <div className="service-logs-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── HEADER & ADD BUTTON ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 2px' }}>{t.serviceLogs}</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
            {t.partsCostLabel} <strong style={{ color: 'var(--accent-service)' }}>{formatCurrency(serviceStats?.totalPartsSpent || 0, lang)}</strong> • {t.laborCostLabel} <strong style={{ color: 'var(--accent-service)' }}>{formatCurrency(serviceStats?.totalLaborSpent || 0, lang)}</strong>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-service"
          onClick={onOpenAddService}
          style={{ padding: '9px 14px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>{t.addService}</span>
        </button>
      </div>

      {serviceLogs.length === 0 ? (
        <div className="card empty-state">
          <Wrench className="empty-icon" />
          <p style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 4px' }}>{t.noData}</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.noDataSub}</p>
        </div>
      ) : (
        <>
          {/* ── SEARCH & FILTER CONTROLS ── */}
          <div className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="form-input"
                placeholder={isBn ? 'গ্যারেজের নাম, নোট, তারিখ, ওডোমিটার দিয়ে খুঁজুন...' : 'Search garage, notes, date, odometer...'}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ paddingLeft: '36px', paddingRight: searchQuery ? '34px' : '12px', height: '40px', fontSize: '0.86rem' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Filter Pills & Sort Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              {/* Service Category Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => { setFilterCategory('all'); setCurrentPage(1); }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    transition: 'all 0.2s ease',
                    background: filterCategory === 'all' ? 'var(--accent-service)' : 'rgba(255, 255, 255, 0.04)',
                    color: filterCategory === 'all' ? '#ffffff' : 'var(--text-muted)',
                    borderColor: filterCategory === 'all' ? 'var(--accent-service)' : 'var(--border-color)'
                  }}
                >
                  {isBn ? 'সকল' : 'All'} ({formatNum(serviceLogs.length, lang)})
                </button>

                {allServiceCategories.map((catKey) => {
                  const isActive = filterCategory === catKey;
                  const label = t[catKey] || catKey;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => { setFilterCategory(catKey); setCurrentPage(1); }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: '1px solid',
                        transition: 'all 0.2s ease',
                        background: isActive ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        color: isActive ? '#a78bfa' : 'var(--text-muted)',
                        borderColor: isActive ? '#a78bfa' : 'var(--border-color)'
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Sort Order Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowUpDown size={14} color="var(--text-dim)" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  style={{
                    background: 'var(--bg-card-hover)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <option value="newest">{isBn ? 'নতুন প্রথমে' : 'Newest First'}</option>
                  <option value="oldest">{isBn ? 'পুরাতন প্রথমে' : 'Oldest First'}</option>
                  <option value="highest_cost">{isBn ? 'সর্বোচ্চ খরচ' : 'Highest Cost'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── LOGS LIST VIEW ── */}
          {filteredLogs.length === 0 ? (
            <div className="card empty-state" style={{ padding: '30px 16px' }}>
              <Filter className="empty-icon" style={{ opacity: 0.5 }} />
              <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: '0 0 6px' }}>
                {isBn ? 'কোনো সার্ভিস লগ পাওয়া যায়নি' : 'No Matching Service Logs'}
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetFilters}
                style={{ padding: '6px 14px', fontSize: '0.8rem', marginTop: '6px' }}
              >
                {isBn ? 'ফিল্টার রিসেট করুন' : 'Reset Filters'}
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="log-list">
                {paginatedLogs.map((log) => {
                  const totalCost = Number(log.serviceCost || 0) + Number(log.partsCost || 0);

                  return (
                    <div key={log.id} className="log-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: '10px',
                          background: 'rgba(139, 92, 246, 0.15)',
                          color: 'var(--accent-service)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Wrench size={19} />
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
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
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

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            type="button"
                            className="btn btn-icon"
                            onClick={() => onEditService(log)}
                            style={{ padding: '6px', color: 'var(--text-muted)' }}
                            title={isBn ? 'সম্পাদনা' : 'Edit'}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-icon"
                            onClick={() => onDeleteService(log.id)}
                            style={{ padding: '6px', color: '#ef4444' }}
                            title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── PAGINATION CONTROLS ── */}
              {totalPages > 1 && (
                <div style={{
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}>
                  {/* Summary Text */}
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {isBn
                      ? `দেখাচ্ছে ${formatNum((validCurrentPage - 1) * itemsPerPage + 1, lang)}-${formatNum(Math.min(validCurrentPage * itemsPerPage, totalItems), lang)}, মোট ${formatNum(totalItems, lang)}টি`
                      : `Showing ${(validCurrentPage - 1) * itemsPerPage + 1}-${Math.min(validCurrentPage * itemsPerPage, totalItems)} of ${totalItems}`}
                  </span>

                  {/* Navigation Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-icon"
                      disabled={validCurrentPage === 1}
                      onClick={() => handlePageChange(validCurrentPage - 1)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        opacity: validCurrentPage === 1 ? 0.4 : 1,
                        cursor: validCurrentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        Math.abs(pageNum - validCurrentPage) <= 1
                      ) {
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => handlePageChange(pageNum)}
                            style={{
                              minWidth: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              border: validCurrentPage === pageNum ? 'none' : '1px solid var(--border-color)',
                              background: validCurrentPage === pageNum ? 'var(--accent-service)' : 'transparent',
                              color: validCurrentPage === pageNum ? '#ffffff' : 'var(--text-main)',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {formatNum(pageNum, lang)}
                          </button>
                        );
                      }
                      if (pageNum === validCurrentPage - 2 || pageNum === validCurrentPage + 2) {
                        return <span key={pageNum} style={{ color: 'var(--text-dim)', padding: '0 2px' }}>...</span>;
                      }
                      return null;
                    })}

                    <button
                      type="button"
                      className="btn btn-icon"
                      disabled={validCurrentPage === totalPages}
                      onClick={() => handlePageChange(validCurrentPage + 1)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        opacity: validCurrentPage === totalPages ? 0.4 : 1,
                        cursor: validCurrentPage === totalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
