import React, { useState, useMemo } from 'react';
import {
  Fuel, Plus, Edit2, Trash2, MapPin, Calendar, Gauge,
  Search, X, ChevronLeft, ChevronRight, Filter, ArrowUpDown, Clock
} from 'lucide-react';
import { translations } from '../utils/translations';
import { formatCurrency, formatNum } from '../utils/calculations';

export default function FuelLogsTab({ lang, fuelLogsStats, onOpenAddFuel, onEditFuel, onDeleteFuel }) {
  const isBn = lang === 'bn';
  const t = translations[lang] || translations.bn;
  const rawLogs = fuelLogsStats.processedLogs || [];

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTank, setFilterTank] = useState('all'); // 'all', 'full', 'partial'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest', 'highest_cost', 'lowest_cost'
  const [datePreset, setDatePreset] = useState('all'); // 'all', 'this_month', 'last_month', 'last_30_days', 'this_year', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter & Sort Logic
  const filteredLogs = useMemo(() => {
    let list = [...rawLogs];

    // Tank Type Filter
    if (filterTank === 'full') {
      list = list.filter(item => item.isFullTank);
    } else if (filterTank === 'partial') {
      list = list.filter(item => !item.isFullTank);
    }

    // Date & Date Range Filter
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let start = startDate;
    let end = endDate;

    if (datePreset === 'this_month') {
      start = new Date(currentYear, currentMonth, 1).toISOString().slice(0, 10);
      end = new Date(currentYear, currentMonth + 1, 0).toISOString().slice(0, 10);
    } else if (datePreset === 'last_month') {
      start = new Date(currentYear, currentMonth - 1, 1).toISOString().slice(0, 10);
      end = new Date(currentYear, currentMonth, 0).toISOString().slice(0, 10);
    } else if (datePreset === 'last_30_days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = d.toISOString().slice(0, 10);
      end = now.toISOString().slice(0, 10);
    } else if (datePreset === 'this_year') {
      start = `${currentYear}-01-01`;
      end = `${currentYear}-12-31`;
    }

    if (start) {
      list = list.filter(item => {
        const itemDate = (item.date || '').slice(0, 10);
        return itemDate >= start;
      });
    }
    if (end) {
      list = list.filter(item => {
        const itemDate = (item.date || '').slice(0, 10);
        return itemDate <= end;
      });
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => {
        const station = (item.stationName || '').toLowerCase();
        const date = (item.date || '').toLowerCase();
        const notes = (item.notes || '').toLowerCase();
        const odo = String(item.odometer || '');
        const liters = String(item.liters || '');
        const amount = String(item.totalAmount || '');
        return station.includes(q) || date.includes(q) || notes.includes(q) || odo.includes(q) || liters.includes(q) || amount.includes(q);
      });
    }

    // Sort Order
    if (sortOrder === 'oldest') {
      list.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    } else if (sortOrder === 'highest_cost') {
      list.sort((a, b) => (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0));
    } else if (sortOrder === 'lowest_cost') {
      list.sort((a, b) => (Number(a.totalAmount) || 0) - (Number(b.totalAmount) || 0));
    } else {
      // Default: Newest first
      list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }

    return list;
  }, [rawLogs, filterTank, datePreset, startDate, endDate, searchQuery, sortOrder]);

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

  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset === 'custom') {
      setShowCustomDate(true);
    } else {
      setShowCustomDate(false);
      setStartDate('');
      setEndDate('');
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterTank('all');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setShowCustomDate(false);
    setSortOrder('newest');
    setCurrentPage(1);
  };

  const isFilterActive = searchQuery || filterTank !== 'all' || datePreset !== 'all' || startDate || endDate;

  return (
    <div className="fuel-logs-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── HEADER & ADD BUTTON ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 2px' }}>{t.fuelLogs}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            {t.totalDistance}: <strong style={{ color: 'var(--text-main)' }}>{formatNum(fuelLogsStats.totalDistance, lang)} {t.km}</strong> • {isBn ? 'মোট রিফিল:' : 'Total Refills:'} <strong style={{ color: 'var(--accent-fuel)' }}>{formatNum(rawLogs.length, lang)}</strong>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenAddFuel}
          style={{ padding: '9px 14px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>{t.addFuel}</span>
        </button>
      </div>

      {rawLogs.length === 0 ? (
        <div className="card empty-state">
          <Fuel className="empty-icon" />
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
                placeholder={isBn ? 'পাম্পের নাম, তারিখ, ওডোমিটার দিয়ে খুঁজুন...' : 'Search station, date, odometer...'}
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
              {/* Tank Type Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => { setFilterTank('all'); setCurrentPage(1); }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    transition: 'all 0.2s ease',
                    background: filterTank === 'all' ? 'var(--accent-fuel)' : 'rgba(255, 255, 255, 0.04)',
                    color: filterTank === 'all' ? '#000000' : 'var(--text-muted)',
                    borderColor: filterTank === 'all' ? 'var(--accent-fuel)' : 'var(--border-color)'
                  }}
                >
                  {isBn ? 'সকল' : 'All'} ({formatNum(rawLogs.length, lang)})
                </button>

                <button
                  type="button"
                  onClick={() => { setFilterTank('full'); setCurrentPage(1); }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    transition: 'all 0.2s ease',
                    background: filterTank === 'full' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: filterTank === 'full' ? '#10b981' : 'var(--text-muted)',
                    borderColor: filterTank === 'full' ? '#10b981' : 'var(--border-color)'
                  }}
                >
                  {isBn ? '⛽ ফুল ট্যাংক' : '⛽ Full Tank'}
                </button>

                <button
                  type="button"
                  onClick={() => { setFilterTank('partial'); setCurrentPage(1); }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    transition: 'all 0.2s ease',
                    background: filterTank === 'partial' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: filterTank === 'partial' ? '#38bdf8' : 'var(--text-muted)',
                    borderColor: filterTank === 'partial' ? '#38bdf8' : 'var(--border-color)'
                  }}
                >
                  {isBn ? 'আংশিক' : 'Partial'}
                </button>
              </div>

              {/* Date Filter & Sort Selectors */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Date Presets Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} color="var(--text-dim)" />
                  <select
                    value={datePreset}
                    onChange={(e) => handleDatePresetChange(e.target.value)}
                    style={{
                      background: datePreset !== 'all' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card-hover)',
                      color: datePreset !== 'all' ? 'var(--accent-fuel)' : 'var(--text-main)',
                      border: `1px solid ${datePreset !== 'all' ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}`,
                      borderRadius: '8px',
                      padding: '5px 8px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">{isBn ? '📅 সব সময়' : '📅 All Time'}</option>
                    <option value="this_month">{isBn ? 'চলতি মাস' : 'This Month'}</option>
                    <option value="last_month">{isBn ? 'গত মাস' : 'Last Month'}</option>
                    <option value="last_30_days">{isBn ? 'বিগত ৩০ দিন' : 'Last 30 Days'}</option>
                    <option value="this_year">{isBn ? 'চলতি বছর' : 'This Year'}</option>
                    <option value="custom">{isBn ? 'তারিখ সীমা (Custom)...' : 'Custom Range...'}</option>
                  </select>
                </div>

                {/* Sort Order Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ArrowUpDown size={14} color="var(--text-dim)" />
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    style={{
                      background: 'var(--bg-card-hover)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '5px 8px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="newest">{isBn ? 'নতুন প্রথমে' : 'Newest First'}</option>
                    <option value="oldest">{isBn ? 'পুরাতন প্রথমে' : 'Oldest First'}</option>
                    <option value="highest_cost">{isBn ? 'সর্বোচ্চ খরচ' : 'Highest Cost'}</option>
                    <option value="lowest_cost">{isBn ? 'সর্বনিম্ন খরচ' : 'Lowest Cost'}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── CUSTOM DATE RANGE PICKER (EXPANDABLE) ── */}
            {showCustomDate && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{isBn ? 'শুরু:' : 'From:'}</span>
                    <input
                      type="date"
                      className="form-input"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                      style={{ padding: '4px 8px', fontSize: '0.78rem', height: '32px', width: 'auto' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{isBn ? 'শেষ:' : 'To:'}</span>
                    <input
                      type="date"
                      className="form-input"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                      style={{ padding: '4px 8px', fontSize: '0.78rem', height: '32px', width: 'auto' }}
                    />
                  </div>
                </div>

                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => { setStartDate(''); setEndDate(''); setCurrentPage(1); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <X size={14} />
                    <span>{isBn ? 'তারিখ মুছুন' : 'Clear Dates'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── LOGS LIST VIEW ── */}
          {filteredLogs.length === 0 ? (
            <div className="card empty-state" style={{ padding: '30px 16px' }}>
              <Filter className="empty-icon" style={{ opacity: 0.5 }} />
              <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: '0 0 6px' }}>
                {isBn ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No Matching Refill Logs'}
              </p>
              {isFilterActive && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetFilters}
                  style={{ padding: '6px 14px', fontSize: '0.8rem', marginTop: '6px' }}
                >
                  {isBn ? 'ফিল্টার রিসেট করুন' : 'Reset Filters'}
                </button>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="log-list">
                {paginatedLogs.map((log) => (
                  <div key={log.id} className="log-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--accent-fuel)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Fuel size={19} />
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
                          {log.tripDistance > 0 && <span style={{ color: 'var(--accent-fuel)', fontWeight: 600 }}>(+{formatNum(log.tripDistance, lang)} {t.km})</span>}
                        </div>

                        {log.stationName && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <MapPin size={11} color="var(--accent-fuel)" />
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
                        <button
                          type="button"
                          className="btn btn-icon"
                          onClick={() => onEditFuel(log)}
                          style={{ padding: '6px', color: 'var(--text-muted)' }}
                          title={isBn ? 'সম্পাদনা' : 'Edit'}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon"
                          onClick={() => onDeleteFuel(log.id)}
                          style={{ padding: '6px', color: '#ef4444' }}
                          title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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
                              background: validCurrentPage === pageNum ? 'var(--accent-fuel)' : 'transparent',
                              color: validCurrentPage === pageNum ? '#000000' : 'var(--text-main)',
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
