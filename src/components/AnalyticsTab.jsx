import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Briefcase, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, FileText, FileSpreadsheet, Download, Table, Printer, Sparkles } from 'lucide-react';
import { translations } from '../utils/translations';
import { getMonthlyAnalytics, formatCurrency, formatNum } from '../utils/calculations';
import { exportRiderComprehensiveStatementPDF, exportFuelAndServiceToExcel, exportCombinedToCSV } from '../utils/exportUtils';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AnalyticsTab({
  lang,
  user,
  activeBike,
  fuelLogs,
  serviceLogs,
  fuelStats,
  serviceStats,
  conveyanceStats,
  showConveyanceAnalytics = false,
  settings = null
}) {
  const t = translations[lang] || translations.bn;
  const isBn = lang === 'bn';
  const [exportingType, setExportingType] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleExportPDF = async () => {
    setExportingType('pdf');
    try {
      await exportRiderComprehensiveStatementPDF({
        user,
        bike: activeBike,
        fuelLogs,
        serviceLogs,
        fuelStats,
        serviceStats,
        conveyanceStats,
        settings,
        dateFrom,
        dateTo,
        lang
      });
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportExcel = async () => {
    setExportingType('excel');
    try {
      await exportFuelAndServiceToExcel({
        bike: activeBike,
        fuelLogs,
        serviceLogs,
        fuelStats,
        serviceStats,
        conveyanceStats,
        settings,
        dateFrom,
        dateTo,
        lang
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleExportCSV = async () => {
    setExportingType('csv');
    try {
      await exportCombinedToCSV({
        bike: activeBike,
        fuelLogs,
        serviceLogs,
        conveyanceStats,
        settings,
        dateFrom,
        dateTo
      });
    } finally {
      setExportingType(null);
    }
  };
  const monthlyData = getMonthlyAnalytics(fuelLogs, serviceLogs);

  // Mileage Trend Chart Data
  const sortedLogs = [...((fuelStats?.processedLogs) || [])]
    .reverse()
    .filter(log => log.calculatedMileage !== null && log.calculatedMileage > 0);

  const mileageLabels = sortedLogs.map(log => log.date);
  const mileageValues = sortedLogs.map(log => log.calculatedMileage);

  const lineChartData = {
    labels: mileageLabels.length > 0 ? mileageLabels : ['No Data'],
    datasets: [
      {
        label: `${t.avgMileage} (Km/L)`,
        data: mileageValues.length > 0 ? mileageValues : [0],
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#38bdf8',
        pointRadius: 5
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: { color: '#94a3b8' }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` Mileage: ${ctx.raw} Km/L`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      y: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        suggestedMin: 20,
        suggestedMax: 60
      }
    }
  };

  // Bar Chart Data (Monthly Fuel vs Service Expense)
  const barLabels = monthlyData.map(item => item.month);
  const fuelExpenses = monthlyData.map(item => item.fuel);
  const serviceExpenses = monthlyData.map(item => item.service);

  const barChartData = {
    labels: barLabels.length > 0 ? barLabels : ['Current Month'],
    datasets: [
      {
        label: t.fuelLogs,
        data: fuelExpenses.length > 0 ? fuelExpenses : [0],
        backgroundColor: '#10b981',
        borderRadius: 6
      },
      {
        label: t.serviceLogs,
        data: serviceExpenses.length > 0 ? serviceExpenses : [0],
        backgroundColor: '#8b5cf6',
        borderRadius: 6
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: { color: '#94a3b8' }
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      y: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      }
    }
  };

  // Conveyance vs Expense Chart Data
  const conveyanceHistory = conveyanceStats?.comparisonHistory || [];
  const convLabels = conveyanceHistory.map(item => item.month);
  const convAllowanceValues = conveyanceHistory.map(item => item.allowance);
  const convExpenseValues = conveyanceHistory.map(item => item.totalExpense);

  const convChartData = {
    labels: convLabels.length > 0 ? convLabels : ['Current Month'],
    datasets: [
      {
        label: t.totalAllowanceReceived || 'Allowance',
        data: convAllowanceValues.length > 0 ? convAllowanceValues : [0],
        backgroundColor: '#38bdf8',
        borderRadius: 6
      },
      {
        label: t.totalBikeExpenses || 'Bike Expense',
        data: convExpenseValues.length > 0 ? convExpenseValues : [0],
        backgroundColor: '#f59e0b',
        borderRadius: 6
      }
    ]
  };

  return (
    <div className="analytics-view">
      <h2 style={{ marginBottom: '20px' }}>{t.analytics}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ===== Corporate Conveyance vs Expense Section ===== */}
        {showConveyanceAnalytics && conveyanceStats && (
          <div className="card" style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '16px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Briefcase size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', color: '#38bdf8', margin: 0, fontWeight: 700 }}>
                  {t.yearlyIncomeVsExpense}
                </h3>
                <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '2px 0 0' }}>
                  {t.corporateModeDesc}
                </p>
              </div>
            </div>

            {/* Annual KPI Cards Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
              marginBottom: '16px'
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t.totalAllowanceReceived}</span>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8', margin: '4px 0 0' }}>
                  {formatCurrency(conveyanceStats.yearlyTotalAllowance, lang)}
                </h4>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{t.totalBikeExpenses}</span>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b', margin: '4px 0 0' }}>
                  {formatCurrency(conveyanceStats.yearlyTotalExpense, lang)}
                </h4>
              </div>

              <div style={{
                background: conveyanceStats.isYearlySurplus ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                padding: '10px 12px',
                borderRadius: '12px',
                border: `1px solid ${conveyanceStats.isYearlySurplus ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                <span style={{ fontSize: '0.72rem', color: conveyanceStats.isYearlySurplus ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {conveyanceStats.isYearlySurplus ? t.netSavings : t.netDeficit}
                </span>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: conveyanceStats.isYearlySurplus ? '#10b981' : '#ef4444', margin: '4px 0 0' }}>
                  {formatCurrency(conveyanceStats.yearlyNetSavings, lang)}
                </h4>
              </div>
            </div>

            {/* Conveyance vs Expense Chart */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.85rem', color: '#ffffff', marginBottom: '10px' }}>
                📊 {t.conveyanceVsExpense}
              </h4>
              <Bar data={convChartData} options={barChartOptions} height={110} />
            </div>

            {/* Monthly Breakdown Table */}
            {conveyanceHistory.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                      <th style={{ padding: '6px 8px' }}>{t.date}</th>
                      <th style={{ padding: '6px 8px' }}>{t.allowanceIncome}</th>
                      <th style={{ padding: '6px 8px' }}>{t.totalExpenses}</th>
                      <th style={{ padding: '6px 8px' }}>{t.netSavings}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conveyanceHistory.slice(-6).map((row, idx) => (
                      <tr key={row.month || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600, color: '#ffffff' }}>{row.month}</td>
                        <td style={{ padding: '6px 8px', color: '#38bdf8' }}>{formatCurrency(row.allowance, lang)}</td>
                        <td style={{ padding: '6px 8px', color: '#f59e0b' }}>{formatCurrency(row.totalExpense, lang)}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: row.isSurplus ? '#10b981' : '#ef4444' }}>
                          {row.isSurplus ? `+${formatCurrency(row.netSavings, lang)}` : `-${formatCurrency(Math.abs(row.netSavings), lang)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Line Chart Card */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem', color: 'var(--accent-mileage)' }}>
            📈 {t.mileageTrend}
          </h3>
          <Line data={lineChartData} options={lineChartOptions} height={120} />
        </div>

        {/* Bar Chart Card */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '1rem', color: 'var(--accent-service)' }}>
            📊 {t.monthlyExpenses}
          </h3>
          <Bar data={barChartData} options={barChartOptions} height={120} />
        </div>

        {/* ===== Statement & Invoice Export Section ===== */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.95))',
          border: '1px solid rgba(2, 132, 199, 0.3)',
          borderRadius: '16px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: 'rgba(2, 132, 199, 0.15)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.98rem', color: '#38bdf8', margin: 0, fontWeight: 700 }}>
                {t.downloadStatement}
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '2px 0 0' }}>
                {t.downloadStatementDesc}
              </p>
            </div>
          </div>

          {/* ── Date Range Filter ── */}
          <div style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 12px' }}>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 8px 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              📅 {isBn ? 'তারিখ রেঞ্জ ফিল্টার (ঐচ্ছিক)' : 'Date Range Filter (optional)'}
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '3px', display: 'block' }}>{isBn ? 'শুরুর তারিখ' : 'From Date'}</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 8px', fontSize: '0.8rem',
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px', color: 'var(--text-main)', outline: 'none'
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '3px', display: 'block' }}>{isBn ? 'শেষ তারিখ' : 'To Date'}</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 8px', fontSize: '0.8rem',
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px', color: 'var(--text-main)', outline: 'none'
                  }}
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  style={{
                    marginTop: '16px', padding: '6px 10px', fontSize: '0.72rem', fontWeight: 600,
                    background: 'rgba(239, 68, 68, 0.15)', color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  ✕ {isBn ? 'ক্লিয়ার' : 'Clear'}
                </button>
              )}
            </div>
            {(dateFrom || dateTo) && (
              <p style={{ fontSize: '0.7rem', color: '#38bdf8', margin: '6px 0 0', fontWeight: 600 }}>
                📌 {isBn ? 'ফিল্টার সক্রিয়:' : 'Filter active:'} {dateFrom || '∞'} → {dateTo || '∞'}
              </p>
            )}
          </div>

          {/* Job Holder conveyance note */}
          {settings?.jobHolderMode && (settings?.monthlyConveyance || 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                💼 {isBn ? 'কর্পোরেট কনভেয়েন্স রিপোর্ট (৳' + (settings?.monthlyConveyance || 0).toLocaleString() + '/মাস) এক্সপোর্টে অন্তর্ভুক্ত হবে' : 'Corporate Conveyance Report (৳' + (settings?.monthlyConveyance || 0).toLocaleString() + '/mo) will be included in export'}
              </span>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px',
            marginTop: '4px'
          }}>
            {/* Button 1: PDF Statement */}
            <button
              type="button"
              className="btn"
              disabled={exportingType === 'pdf'}
              onClick={handleExportPDF}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 10px',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: exportingType === 'pdf' ? 'not-allowed' : 'pointer',
                opacity: exportingType === 'pdf' ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              <FileText size={20} className={exportingType === 'pdf' ? 'animate-spin' : ''} />
              <span>{exportingType === 'pdf' ? (isBn ? 'PDF তৈরি হচ্ছে...' : 'Generating PDF...') : t.pdfStatement}</span>
            </button>

            {/* Button 2: Excel (.xls) */}
            <button
              type="button"
              className="btn"
              disabled={exportingType === 'excel'}
              onClick={handleExportExcel}
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.25))',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '12px',
                padding: '12px 10px',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: exportingType === 'excel' ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <FileSpreadsheet size={20} />
              <span>{exportingType === 'excel' ? t.exportingFile : t.excelExport}</span>
            </button>

            {/* Button 3: CSV Data */}
            <button
              type="button"
              className="btn"
              disabled={exportingType === 'csv'}
              onClick={handleExportCSV}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '12px 10px',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: exportingType === 'csv' ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Download size={20} />
              <span>{exportingType === 'csv' ? t.exportingFile : t.csvExport}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
