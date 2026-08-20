import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Universal Statement & Report Exporter for RideLog BD (Web, Android & iOS)
 * Generates:
 * 1. Official Branded Vehicle Statement / Expense Invoice PDF  (with Conveyance section)
 * 2. Formatted Multi-Sheet Excel Spreadsheet (.xls)            (with Conveyance sheet)
 * 3. UTF-8 CSV Data (.csv)                                     (with Conveyance rows)
 *
 * All exports support optional dateFrom / dateTo filters.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function deliverExportFile(filename, content, mimeType) {
  if (Capacitor.isNativePlatform()) {
    try {
      const path = `exports/${filename}`;
      await Filesystem.writeFile({
        path,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true
      });
      const uriResult = await Filesystem.getUri({ directory: Directory.Cache, path });
      await Share.share({
        title: filename,
        text: `RideLog BD - ${filename}`,
        url: uriResult.uri,
        dialogTitle: `Export ${filename}`
      });
      return { success: true };
    } catch (e) {
      console.warn('Native mobile export share fallback:', e);
    }
  }

  // Web Browser Fallback
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { success: true };
  } catch (err) {
    console.error('Web file download error:', err);
    return { success: false, error: err.message };
  }
}

/** Filter logs by optional dateFrom / dateTo (inclusive, YYYY-MM-DD strings) */
function applyDateFilter(logs, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return logs;
  return logs.filter(log => {
    const d = log.date || '';
    if (dateFrom && d < dateFrom) return false;
    if (dateTo   && d > dateTo)   return false;
    return true;
  });
}

/** Build a monthly conveyance summary array from fuelLogs + serviceLogs + monthly allowance */
function buildConveyanceMonthlyRows(fuelLogs, serviceLogs, monthlyAllowance) {
  const map = {};

  fuelLogs.forEach(f => {
    const m = (f.date || '').slice(0, 7); // YYYY-MM
    if (!m) return;
    if (!map[m]) map[m] = { month: m, fuelCost: 0, serviceCost: 0 };
    map[m].fuelCost += Number(f.totalAmount || (f.liters * f.pricePerLiter) || 0);
  });

  serviceLogs.forEach(s => {
    const m = (s.date || '').slice(0, 7);
    if (!m) return;
    if (!map[m]) map[m] = { month: m, fuelCost: 0, serviceCost: 0 };
    map[m].serviceCost += (Number(s.partsCost) || 0) + (Number(s.serviceCost) || 0);
  });

  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(row => ({
    ...row,
    totalExpense: row.fuelCost + row.serviceCost,
    allowance: monthlyAllowance,
    savings: monthlyAllowance - (row.fuelCost + row.serviceCost)
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. PDF STATEMENT
// ─────────────────────────────────────────────────────────────────────────────

export function exportRiderComprehensiveStatementPDF({
  user,
  bike,
  fuelLogs = [],
  serviceLogs = [],
  fuelStats = {},
  serviceStats = {},
  conveyanceStats = null,
  settings = null,
  dateFrom = '',
  dateTo = '',
  lang = 'bn'
}) {
  const isBn = lang === 'bn';
  const filteredFuel    = applyDateFilter(fuelLogs, dateFrom, dateTo);
  const filteredService = applyDateFilter(serviceLogs, dateFrom, dateTo);

  const statementNo   = `RLBD-STM-${(user?.uid || 'USER').slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  const statementDate = new Date().toLocaleDateString(isBn ? 'bn-BD' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const activeBike    = bike || { name: 'Motorcycle', regNumber: 'N/A', currentOdometer: 0 };

  const periodLabel = (dateFrom || dateTo)
    ? `${dateFrom || '∞'} → ${dateTo || '∞'}`
    : (isBn ? 'সমস্ত সময়কাল' : 'All Time');

  const sortedFuel    = [...filteredFuel].sort((a, b) => new Date(b.date) - new Date(a.date));
  const sortedService = [...filteredService].sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalFuelSpent    = filteredFuel.reduce((s, f) => s + Number(f.totalAmount || (f.liters * f.pricePerLiter) || 0), 0);
  const totalServiceSpent = filteredService.reduce((s, sv) => s + (Number(sv.partsCost) || 0) + (Number(sv.serviceCost) || 0), 0);
  const grandTotal        = totalFuelSpent + totalServiceSpent;

  const fuelRowsHtml = sortedFuel.length === 0
    ? `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:12px;">${isBn ? 'কোন ফুয়েল লগ নেই' : 'No fuel refill records logged.'}</td></tr>`
    : sortedFuel.map(f => `
      <tr>
        <td style="font-weight:600;">${f.date || 'N/A'}</td>
        <td style="font-weight:700;color:#0f172a;">${f.liters} L</td>
        <td>৳${f.pricePerLiter || '-'}/L</td>
        <td style="font-weight:700;color:#059669;">৳${Number(f.totalAmount || (f.liters * f.pricePerLiter) || 0).toLocaleString()}</td>
        <td>${f.odometer ? f.odometer + ' km' : '-'}</td>
        <td>${f.stationName || f.notes || '-'}</td>
        <td style="font-weight:700;color:#0284c7;">${f.calculatedMileage ? f.calculatedMileage + ' km/L' : (f.fullTank ? 'Full Tank' : '-')}</td>
      </tr>
    `).join('');

  const serviceRowsHtml = sortedService.length === 0
    ? `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:12px;">${isBn ? 'কোন সার্ভিস লগ নেই' : 'No maintenance records logged.'}</td></tr>`
    : sortedService.map(s => `
      <tr>
        <td style="font-weight:600;">${s.date || 'N/A'}</td>
        <td style="font-weight:700;color:#0f172a;">${s.serviceTypes?.join(', ') || s.notes || 'Routine Servicing'}</td>
        <td>${s.garageName || 'Service Center'}</td>
        <td>${s.odometer ? s.odometer + ' km' : '-'}</td>
        <td>৳${(Number(s.partsCost) || 0).toLocaleString()}</td>
        <td>৳${(Number(s.serviceCost) || 0).toLocaleString()}</td>
        <td style="font-weight:700;color:#d97706;">৳${((Number(s.partsCost) || 0) + (Number(s.serviceCost) || 0)).toLocaleString()}</td>
      </tr>
    `).join('');

  // ── Conveyance Section (only if job holder mode is active) ──
  const monthlyAllowance = settings?.monthlyConveyance || conveyanceStats?.allowance || 0;
  const showConveyance   = settings?.jobHolderMode && monthlyAllowance > 0;
  const conveyanceRows   = showConveyance ? buildConveyanceMonthlyRows(filteredFuel, filteredService, monthlyAllowance) : [];
  const yearlyAllowance  = conveyanceRows.reduce((s, r) => s + r.allowance, 0);
  const yearlyExpense    = conveyanceRows.reduce((s, r) => s + r.totalExpense, 0);
  const yearlySavings    = yearlyAllowance - yearlyExpense;

  const conveyanceTableHtml = showConveyance ? `
    <div class="section-title" style="border-left-color:#38bdf8;">
      <span>💼 ${isBn ? 'কর্পোরেট কনভেয়েন্স সারসংক্ষেপ (মাসিক ভাতা: ৳' + monthlyAllowance.toLocaleString() + ')' : 'Corporate Conveyance Summary (Monthly Allowance: ৳' + monthlyAllowance.toLocaleString() + ')'}</span>
      <span style="font-size:10px;font-weight:normal;color:${yearlySavings >= 0 ? '#059669' : '#dc2626'};">
        ${isBn ? (yearlySavings >= 0 ? 'মোট সাশ্রয়' : 'মোট ঘাটতি') : (yearlySavings >= 0 ? 'Net Savings' : 'Net Deficit')}: ৳${Math.abs(yearlySavings).toLocaleString()}
      </span>
    </div>
    <table>
      <thead>
        <tr>
          <th>${isBn ? 'মাস' : 'Month'}</th>
          <th>${isBn ? 'ফুয়েল খরচ' : 'Fuel Cost'}</th>
          <th>${isBn ? 'সার্ভিস খরচ' : 'Service Cost'}</th>
          <th>${isBn ? 'মোট খরচ' : 'Total Expense'}</th>
          <th>${isBn ? 'কনভেয়েন্স ভাতা' : 'Allowance'}</th>
          <th>${isBn ? 'সাশ্রয় / ঘাটতি' : 'Savings / Deficit'}</th>
        </tr>
      </thead>
      <tbody>
        ${conveyanceRows.length === 0
          ? `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:10px;">${isBn ? 'কোন ডেটা নেই' : 'No data for selected period.'}</td></tr>`
          : conveyanceRows.map(r => `
          <tr>
            <td style="font-weight:700;">${r.month}</td>
            <td style="color:#059669;">৳${r.fuelCost.toLocaleString()}</td>
            <td style="color:#d97706;">৳${r.serviceCost.toLocaleString()}</td>
            <td style="font-weight:700;">৳${r.totalExpense.toLocaleString()}</td>
            <td style="color:#0284c7;font-weight:700;">৳${r.allowance.toLocaleString()}</td>
            <td style="font-weight:800;color:${r.savings >= 0 ? '#059669' : '#dc2626'};">
              ${r.savings >= 0 ? '+' : ''}৳${r.savings.toLocaleString()}
            </td>
          </tr>
        `).join('')}
        <tr style="background:#f0fdf4;font-weight:800;border-top:2px solid #e2e8f0;">
          <td><strong>${isBn ? 'মোট' : 'TOTAL'}</strong></td>
          <td>৳${conveyanceRows.reduce((s,r)=>s+r.fuelCost,0).toLocaleString()}</td>
          <td>৳${conveyanceRows.reduce((s,r)=>s+r.serviceCost,0).toLocaleString()}</td>
          <td style="color:#0f172a;font-weight:900;">৳${yearlyExpense.toLocaleString()}</td>
          <td style="color:#0284c7;font-weight:900;">৳${yearlyAllowance.toLocaleString()}</td>
          <td style="font-weight:900;color:${yearlySavings >= 0 ? '#059669' : '#dc2626'};">
            ${yearlySavings >= 0 ? '+' : ''}৳${yearlySavings.toLocaleString()}
          </td>
        </tr>
      </tbody>
    </table>
  ` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Vehicle Statement - ${user?.displayName || 'Rider'} (${statementNo})</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @page { size: A4; margin: 12mm 14mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, sans-serif; color: #0f172a; background: #ffffff; margin: 0; padding: 0; font-size: 11px; line-height: 1.5; }
        .statement-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0284c7; padding-bottom: 14px; margin-bottom: 18px; }
        .brand-logo { display: flex; align-items: center; gap: 10px; }
        .logo-badge { width: 38px; height: 38px; background: linear-gradient(135deg, #0284c7, #0369a1); border-radius: 10px; color: white; font-size: 20px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
        .brand-name { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
        .brand-sub { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .statement-meta { text-align: right; }
        .meta-title { font-size: 16px; font-weight: 900; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0; }
        .meta-row { font-size: 11px; color: #475569; }
        .meta-bold { font-weight: 700; color: #0f172a; font-family: monospace; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
        .card-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; }
        .card-title { font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-val { font-weight: 700; color: #0f172a; }
        .financial-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
        .kpi-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 10px; text-align: center; }
        .kpi-box.cyan { background: #ecfeff; border-color: #a5f3fc; }
        .kpi-box.amber { background: #fffbeb; border-color: #fde68a; }
        .kpi-box.purple { background: #faf5ff; border-color: #e9d5ff; }
        .kpi-box.blue { background: #eff6ff; border-color: #bfdbfe; }
        .kpi-label { font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .kpi-value { font-size: 14px; font-weight: 900; color: #0f172a; }
        .section-title { font-size: 12px; font-weight: 900; color: #0f172a; margin: 18px 0 8px 0; display: flex; align-items: center; justify-content: space-between; border-left: 3px solid #0284c7; padding-left: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 14px; }
        th { background: #0f172a; color: #ffffff; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 7px 9px; text-align: left; font-size: 9px; border: 1px solid #1e293b; }
        td { padding: 6px 9px; border: 1px solid #e2e8f0; color: #334155; }
        tr:nth-child(even) { background: #f8fafc; }
        .statement-footer { margin-top: 24px; padding-top: 12px; border-top: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; }
        .audit-text { font-size: 9px; color: #64748b; max-width: 65%; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <!-- Top Action Bar (hidden in print) -->
      <div class="no-print" style="background:#0f172a;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-radius:8px;">
        <span style="font-weight:700;">📄 RideLog BD Official Vehicle Statement</span>
        <button onclick="window.print()" style="background:#0284c7;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-weight:700;cursor:pointer;font-size:12px;">
          🖨️ Print / Save as PDF
        </button>
      </div>

      <!-- Statement Header -->
      <div class="statement-header">
        <div class="brand-logo">
          <div class="logo-badge">🏍️</div>
          <div>
            <div class="brand-name">RideLog BD</div>
            <div class="brand-sub">Comprehensive Vehicle Expense &amp; Service Statement</div>
          </div>
        </div>
        <div class="statement-meta">
          <div class="meta-title">Vehicle Statement</div>
          <div class="meta-row">Statement No: <span class="meta-bold">${statementNo}</span></div>
          <div class="meta-row">Issue Date: <span class="meta-bold">${statementDate}</span></div>
          <div class="meta-row">Period: <span class="meta-bold">${periodLabel}</span></div>
        </div>
      </div>

      <!-- Profile & Vehicle Details -->
      <div class="grid-2">
        <div class="card-box">
          <div class="card-title">Rider Account Details</div>
          <div class="info-row"><span class="info-label">Rider Name:</span><span class="info-val">${user?.displayName || 'App User'}</span></div>
          <div class="info-row"><span class="info-label">Email:</span><span class="info-val">${user?.email || 'N/A'}</span></div>
          <div class="info-row"><span class="info-label">Account ID:</span><span class="info-val" style="font-family:monospace;">${(user?.uid || 'N/A').slice(0, 12)}...</span></div>
        </div>
        <div class="card-box">
          <div class="card-title">Vehicle Profile</div>
          <div class="info-row"><span class="info-label">Bike Model:</span><span class="info-val">${activeBike.name || 'Motorcycle'}</span></div>
          <div class="info-row"><span class="info-label">Registration No:</span><span class="info-val">${activeBike.regNumber || 'Not Registered'}</span></div>
          <div class="info-row"><span class="info-label">Current Odometer:</span><span class="info-val">${(activeBike.currentOdometer || 0).toLocaleString()} km</span></div>
        </div>
      </div>

      <!-- Financial & Mileage Summary KPIs -->
      <div class="financial-summary-grid">
        <div class="kpi-box">
          <div class="kpi-label">Total Fuel Cost</div>
          <div class="kpi-value" style="color:#059669;">৳${totalFuelSpent.toLocaleString()}</div>
        </div>
        <div class="kpi-box amber">
          <div class="kpi-label">Total Service Cost</div>
          <div class="kpi-value" style="color:#d97706;">৳${totalServiceSpent.toLocaleString()}</div>
        </div>
        <div class="kpi-box purple">
          <div class="kpi-label">Grand Total Spend</div>
          <div class="kpi-value" style="color:#7c3aed;">৳${grandTotal.toLocaleString()}</div>
        </div>
        ${showConveyance ? `
        <div class="kpi-box blue">
          <div class="kpi-label">Net Conveyance ${yearlySavings >= 0 ? 'Savings' : 'Deficit'}</div>
          <div class="kpi-value" style="color:${yearlySavings >= 0 ? '#059669' : '#dc2626'};">${yearlySavings >= 0 ? '+' : ''}৳${Math.abs(yearlySavings).toLocaleString()}</div>
        </div>
        ` : `
        <div class="kpi-box cyan">
          <div class="kpi-label">Average Mileage</div>
          <div class="kpi-value" style="color:#0284c7;">${fuelStats.avgMileage ? fuelStats.avgMileage + ' km/L' : 'N/A'}</div>
        </div>
        `}
      </div>

      <!-- Corporate Conveyance Section -->
      ${conveyanceTableHtml}

      <!-- Fuel Refills Table -->
      <div class="section-title">
        <span>Fuel Refill Logs (${sortedFuel.length} Records)</span>
        <span style="font-size:10px;font-weight:normal;color:#64748b;">Total: ${filteredFuel.reduce((s,f)=>s+(Number(f.liters)||0),0).toFixed(1)} L</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Quantity</th><th>Rate</th><th>Total Cost</th><th>Odometer</th><th>Station / Notes</th><th>Mileage</th>
          </tr>
        </thead>
        <tbody>${fuelRowsHtml}</tbody>
      </table>

      <!-- Service & Maintenance Table -->
      <div class="section-title">
        <span>Service &amp; Maintenance History (${sortedService.length} Records)</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Service Details</th><th>Garage / Center</th><th>Odometer</th><th>Parts Cost</th><th>Labor Cost</th><th>Total Spent</th>
          </tr>
        </thead>
        <tbody>${serviceRowsHtml}</tbody>
      </table>

      <!-- Statement Footer -->
      <div class="statement-footer">
        <div class="audit-text">
          <strong>Official Vehicle Audit Report</strong><br />
          Generated dynamically by RideLog BD System. All logged odometer readings, expenses, and service histories are self-maintained by the vehicle owner.
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;font-weight:800;color:#0284c7;">RideLog BD Verified</div>
          <div style="font-size:9px;color:#94a3b8;">ridelog-bd.web.app</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            setTimeout(function() { window.print(); }, 400);
          }
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    deliverExportFile(`RideLog_${(activeBike.name || 'Bike').replace(/\s+/g, '_')}_Statement.html`, htmlContent, 'text/html');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. EXCEL (.XLS)
// ─────────────────────────────────────────────────────────────────────────────

export async function exportFuelAndServiceToExcel({
  bike,
  fuelLogs = [],
  serviceLogs = [],
  fuelStats = {},
  serviceStats = {},
  conveyanceStats = null,
  settings = null,
  dateFrom = '',
  dateTo = '',
  lang = 'bn'
}) {
  const isBn = lang === 'bn';
  const filteredFuel    = applyDateFilter(fuelLogs, dateFrom, dateTo);
  const filteredService = applyDateFilter(serviceLogs, dateFrom, dateTo);

  const bikeName    = bike?.name || 'My Bike';
  const regNumber   = bike?.regNumber || 'N/A';
  const periodLabel = (dateFrom || dateTo) ? `${dateFrom || '∞'} → ${dateTo || '∞'}` : 'All Time';

  const totalFuelSpent    = filteredFuel.reduce((s, f) => s + Number(f.totalAmount || (f.liters * f.pricePerLiter) || 0), 0);
  const totalServiceSpent = filteredService.reduce((s, sv) => s + (Number(sv.partsCost) || 0) + (Number(sv.serviceCost) || 0), 0);

  const monthlyAllowance = settings?.monthlyConveyance || conveyanceStats?.allowance || 0;
  const showConveyance   = settings?.jobHolderMode && monthlyAllowance > 0;
  const conveyanceRows   = showConveyance ? buildConveyanceMonthlyRows(filteredFuel, filteredService, monthlyAllowance) : [];
  const yearlyAllowance  = conveyanceRows.reduce((s, r) => s + r.allowance, 0);
  const yearlyExpense    = conveyanceRows.reduce((s, r) => s + r.totalExpense, 0);
  const yearlySavings    = yearlyAllowance - yearlyExpense;

  const fuelRowsHtml = filteredFuel.map(f => `
    <tr>
      <td style="padding:6px;border:1px solid #cbd5e1;">${f.date || ''}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;">${f.liters || 0}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;">${f.pricePerLiter || 0}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;color:#059669;">${f.totalAmount || (f.liters * f.pricePerLiter) || 0}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;">${f.odometer || ''}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;">${f.tripDistance || ''}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;color:#0284c7;">${f.calculatedMileage || ''}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;">${f.stationName || ''}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;">${f.notes || ''}</td>
    </tr>
  `).join('');

  const serviceRowsHtml = filteredService.map(s => `
    <tr>
      <td style="padding:6px;border:1px solid #cbd5e1;">${s.date || ''}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;">${s.serviceTypes?.join(', ') || s.notes || 'Servicing'}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;">${s.garageName || ''}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;">${s.odometer || ''}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;">${s.partsCost || 0}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;">${s.serviceCost || 0}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;color:#d97706;">${(Number(s.partsCost) || 0) + (Number(s.serviceCost) || 0)}</td>
      <td style="padding:6px;border:1px solid #cbd5e1;">${s.notes || ''}</td>
    </tr>
  `).join('');

  const conveyanceSheetHtml = showConveyance ? `
    <h2 style="color:#0284c7;">💼 ${isBn ? 'কর্পোরেট কনভেয়েন্স রিপোর্ট' : 'Corporate Conveyance Report'}</h2>
    <p style="color:#64748b;font-size:12px;">
      ${isBn ? 'মাসিক ভাতা' : 'Monthly Allowance'}: ৳${monthlyAllowance.toLocaleString()} | 
      ${isBn ? 'মোট সাশ্রয়' : 'Net'}: ${yearlySavings >= 0 ? '+' : ''}৳${yearlySavings.toLocaleString()}
    </p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:30px;">
      <thead>
        <tr style="background:#0f172a;color:#fff;font-weight:bold;">
          <th style="padding:8px;border:1px solid #1e293b;">${isBn ? 'মাস' : 'Month'}</th>
          <th style="padding:8px;border:1px solid #1e293b;">${isBn ? 'ফুয়েল খরচ (৳)' : 'Fuel Cost (৳)'}</th>
          <th style="padding:8px;border:1px solid #1e293b;">${isBn ? 'সার্ভিস খরচ (৳)' : 'Service Cost (৳)'}</th>
          <th style="padding:8px;border:1px solid #1e293b;">${isBn ? 'মোট খরচ (৳)' : 'Total Expense (৳)'}</th>
          <th style="padding:8px;border:1px solid #1e293b;">${isBn ? 'কনভেয়েন্স ভাতা (৳)' : 'Allowance (৳)'}</th>
          <th style="padding:8px;border:1px solid #1e293b;">${isBn ? 'সাশ্রয় / ঘাটতি (৳)' : 'Savings / Deficit (৳)'}</th>
        </tr>
      </thead>
      <tbody>
        ${conveyanceRows.map(r => `
          <tr>
            <td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;">${r.month}</td>
            <td style="padding:6px;border:1px solid #cbd5e1;color:#059669;">${r.fuelCost}</td>
            <td style="padding:6px;border:1px solid #cbd5e1;color:#d97706;">${r.serviceCost}</td>
            <td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;">${r.totalExpense}</td>
            <td style="padding:6px;border:1px solid #cbd5e1;color:#0284c7;font-weight:bold;">${r.allowance}</td>
            <td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;color:${r.savings >= 0 ? '#059669' : '#dc2626'};">${r.savings >= 0 ? '+' : ''}${r.savings}</td>
          </tr>
        `).join('')}
        <tr style="background:#f0fdf4;font-weight:900;">
          <td style="padding:6px;border:1px solid #cbd5e1;">TOTAL</td>
          <td style="padding:6px;border:1px solid #cbd5e1;">${conveyanceRows.reduce((s,r)=>s+r.fuelCost,0)}</td>
          <td style="padding:6px;border:1px solid #cbd5e1;">${conveyanceRows.reduce((s,r)=>s+r.serviceCost,0)}</td>
          <td style="padding:6px;border:1px solid #cbd5e1;">${yearlyExpense}</td>
          <td style="padding:6px;border:1px solid #cbd5e1;">${yearlyAllowance}</td>
          <td style="padding:6px;border:1px solid #cbd5e1;color:${yearlySavings >= 0 ? '#059669' : '#dc2626'};">${yearlySavings >= 0 ? '+' : ''}${yearlySavings}</td>
        </tr>
      </tbody>
    </table>
    <hr/>
  ` : '';

  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8" /></head>
    <body style="font-family:Arial,sans-serif;">
      <h2>RideLog BD - ${bikeName} (${regNumber})</h2>
      <p style="color:#64748b;font-size:12px;">Period: ${periodLabel} | Export Date: ${new Date().toLocaleString('en-US')}</p>

      <table style="margin-bottom:20px;border-collapse:collapse;">
        <tr style="background:#0284c7;color:#fff;font-weight:bold;">
          <th style="padding:8px 12px;border:1px solid #cbd5e1;">Metric</th>
          <th style="padding:8px 12px;border:1px solid #cbd5e1;">Value</th>
        </tr>
        <tr><td style="padding:6px;border:1px solid #cbd5e1;">Total Fuel Spend</td><td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;">৳${totalFuelSpent.toLocaleString()}</td></tr>
        <tr><td style="padding:6px;border:1px solid #cbd5e1;">Total Service Spend</td><td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;">৳${totalServiceSpent.toLocaleString()}</td></tr>
        <tr><td style="padding:6px;border:1px solid #cbd5e1;">Grand Total Expenses</td><td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;">৳${(totalFuelSpent + totalServiceSpent).toLocaleString()}</td></tr>
        <tr><td style="padding:6px;border:1px solid #cbd5e1;">Avg Mileage</td><td style="padding:6px;border:1px solid #cbd5e1;">${fuelStats.avgMileage || 0} km/L</td></tr>
        <tr><td style="padding:6px;border:1px solid #cbd5e1;">Total Distance Logged</td><td style="padding:6px;border:1px solid #cbd5e1;">${fuelStats.totalDistance || 0} km</td></tr>
        ${showConveyance ? `
        <tr><td style="padding:6px;border:1px solid #cbd5e1;">Monthly Conveyance Allowance</td><td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;">৳${monthlyAllowance.toLocaleString()}</td></tr>
        <tr><td style="padding:6px;border:1px solid #cbd5e1;">Total Allowance (Period)</td><td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;color:#0284c7;">৳${yearlyAllowance.toLocaleString()}</td></tr>
        <tr><td style="padding:6px;border:1px solid #cbd5e1;">Net Conveyance Savings/Deficit</td><td style="padding:6px;border:1px solid #cbd5e1;font-weight:bold;color:${yearlySavings >= 0 ? '#059669' : '#dc2626'};">${yearlySavings >= 0 ? '+' : ''}৳${yearlySavings.toLocaleString()}</td></tr>
        ` : ''}
      </table>

      ${conveyanceSheetHtml}

      <h3>1. Fuel Refill Logs (${filteredFuel.length} Records)</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:30px;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;font-weight:bold;">
            <th style="padding:8px;border:1px solid #1e293b;">Date</th>
            <th style="padding:8px;border:1px solid #1e293b;">Quantity (L)</th>
            <th style="padding:8px;border:1px solid #1e293b;">Price/Liter (৳)</th>
            <th style="padding:8px;border:1px solid #1e293b;">Total (৳)</th>
            <th style="padding:8px;border:1px solid #1e293b;">Odometer (km)</th>
            <th style="padding:8px;border:1px solid #1e293b;">Trip (km)</th>
            <th style="padding:8px;border:1px solid #1e293b;">Mileage (km/L)</th>
            <th style="padding:8px;border:1px solid #1e293b;">Station</th>
            <th style="padding:8px;border:1px solid #1e293b;">Notes</th>
          </tr>
        </thead>
        <tbody>${fuelRowsHtml}</tbody>
      </table>

      <h3>2. Service &amp; Maintenance Logs (${filteredService.length} Records)</h3>
      <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;font-weight:bold;">
            <th style="padding:8px;border:1px solid #1e293b;">Date</th>
            <th style="padding:8px;border:1px solid #1e293b;">Service Items</th>
            <th style="padding:8px;border:1px solid #1e293b;">Garage / Center</th>
            <th style="padding:8px;border:1px solid #1e293b;">Odometer (km)</th>
            <th style="padding:8px;border:1px solid #1e293b;">Parts Cost (৳)</th>
            <th style="padding:8px;border:1px solid #1e293b;">Labor Cost (৳)</th>
            <th style="padding:8px;border:1px solid #1e293b;">Total (৳)</th>
            <th style="padding:8px;border:1px solid #1e293b;">Notes</th>
          </tr>
        </thead>
        <tbody>${serviceRowsHtml}</tbody>
      </table>
    </body>
    </html>
  `;

  const fileName = `RideLog_${bikeName.replace(/\s+/g, '_')}_Report${dateFrom ? '_' + dateFrom : ''}${dateTo ? '_to_' + dateTo : ''}.xls`;
  return await deliverExportFile(fileName, excelTemplate, 'application/vnd.ms-excel;charset=utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. CSV
// ─────────────────────────────────────────────────────────────────────────────

export async function exportCombinedToCSV({
  bike,
  fuelLogs = [],
  serviceLogs = [],
  settings = null,
  conveyanceStats = null,
  dateFrom = '',
  dateTo = ''
}) {
  const filteredFuel    = applyDateFilter(fuelLogs, dateFrom, dateTo);
  const filteredService = applyDateFilter(serviceLogs, dateFrom, dateTo);
  const bikeName        = bike?.name || 'Bike';

  const rows = [];
  rows.push(['TYPE', 'DATE', 'ODOMETER (KM)', 'LITERS', 'RATE (TK)', 'TOTAL AMOUNT (TK)', 'FUEL COST', 'SERVICE COST', 'SERVICE ITEMS', 'GARAGE / STATION', 'MILEAGE (KM/L)', 'CONVEYANCE ALLOWANCE (TK)', 'SAVINGS / DEFICIT (TK)', 'NOTES']);

  const monthlyAllowance = settings?.monthlyConveyance || conveyanceStats?.allowance || 0;
  const showConveyance   = settings?.jobHolderMode && monthlyAllowance > 0;

  filteredFuel.forEach(f => {
    rows.push([
      'FUEL', f.date || '', f.odometer || '', f.liters || '',
      f.pricePerLiter || '',
      f.totalAmount || (f.liters * f.pricePerLiter) || 0,
      f.totalAmount || (f.liters * f.pricePerLiter) || 0, '', '', f.stationName || '',
      f.calculatedMileage || '', '', '', f.notes || ''
    ]);
  });

  filteredService.forEach(s => {
    const total = (Number(s.partsCost) || 0) + (Number(s.serviceCost) || 0);
    rows.push([
      'SERVICE', s.date || '', s.odometer || '', '', '', total, '', total,
      s.serviceTypes?.join('; ') || '', s.garageName || '', '', '', '', s.notes || ''
    ]);
  });

  // Conveyance monthly summary rows
  if (showConveyance) {
    rows.push([]);
    rows.push(['--- CONVEYANCE MONTHLY SUMMARY ---']);
    rows.push(['MONTH', 'FUEL COST', 'SERVICE COST', 'TOTAL EXPENSE', 'ALLOWANCE', 'SAVINGS / DEFICIT']);
    const convRows = buildConveyanceMonthlyRows(filteredFuel, filteredService, monthlyAllowance);
    convRows.forEach(r => {
      rows.push([r.month, r.fuelCost, r.serviceCost, r.totalExpense, r.allowance, r.savings]);
    });
    if (convRows.length > 0) {
      rows.push([
        'TOTAL',
        convRows.reduce((s,r)=>s+r.fuelCost,0),
        convRows.reduce((s,r)=>s+r.serviceCost,0),
        convRows.reduce((s,r)=>s+r.totalExpense,0),
        convRows.reduce((s,r)=>s+r.allowance,0),
        convRows.reduce((s,r)=>s+r.savings,0)
      ]);
    }
  }

  const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const fileName   = `RideLog_${bikeName.replace(/\s+/g, '_')}_Logs${dateFrom ? '_' + dateFrom : ''}${dateTo ? '_to_' + dateTo : ''}.csv`;
  return await deliverExportFile(fileName, csvContent, 'text/csv;charset=utf-8;');
}
