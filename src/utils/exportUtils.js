import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const isPdf = mimeType === 'application/pdf';

  if (Capacitor.isNativePlatform()) {
    try {
      const path = `exports/${filename}`;
      // For PDF binary data in base64 format, write directly without UTF8 encoding
      if (isPdf && typeof content === 'string') {
        await Filesystem.writeFile({
          path,
          data: content,
          directory: Directory.Cache,
          recursive: true
        });
      } else {
        await Filesystem.writeFile({
          path,
          data: content,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
          recursive: true
        });
      }

      const uriResult = await Filesystem.getUri({ directory: Directory.Cache, path });
      await Share.share({
        title: filename,
        text: `RideLog BD - ${filename}`,
        url: uriResult.uri,
        dialogTitle: `Open ${filename}`
      });
      return { success: true, uri: uriResult.uri };
    } catch (e) {
      console.warn('Native mobile export share fallback:', e);
    }
  }

  // Web Browser / Mobile Browser Fallback
  try {
    let blob;
    if (content instanceof Blob) {
      blob = content;
    } else if (isPdf && typeof content === 'string') {
      // Decode Base64 string into Uint8Array for valid PDF blob
      const byteCharacters = atob(content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: 'application/pdf' });
    } else {
      blob = new Blob([content], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { success: true, url };
  } catch (err) {
    console.error('File download error:', err);
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
//  1. OFFICIAL BRANDED PDF STATEMENT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function exportRiderComprehensiveStatementPDF({
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
  const statementDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const activeBike    = bike || { name: 'Motorcycle', regNumber: 'N/A', currentOdometer: 0 };

  const periodLabel = (dateFrom || dateTo)
    ? `${dateFrom || 'Start'} to ${dateTo || 'Present'}`
    : 'All Time Records';

  const sortedFuel    = [...filteredFuel].sort((a, b) => new Date(b.date) - new Date(a.date));
  const sortedService = [...filteredService].sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalFuelSpent    = filteredFuel.reduce((s, f) => s + Number(f.totalAmount || (f.liters * f.pricePerLiter) || 0), 0);
  const totalServiceSpent = filteredService.reduce((s, sv) => s + (Number(sv.partsCost) || 0) + (Number(sv.serviceCost) || 0), 0);
  const grandTotal        = totalFuelSpent + totalServiceSpent;

  // Conveyance calculations
  const monthlyAllowance = settings?.monthlyConveyance || conveyanceStats?.allowance || 0;
  const showConveyance   = settings?.jobHolderMode && monthlyAllowance > 0;
  const conveyanceRows   = showConveyance ? buildConveyanceMonthlyRows(filteredFuel, filteredService, monthlyAllowance) : [];
  const yearlyAllowance  = conveyanceRows.reduce((s, r) => s + r.allowance, 0);
  const yearlyExpense    = conveyanceRows.reduce((s, r) => s + r.totalExpense, 0);
  const yearlySavings    = yearlyAllowance - yearlyExpense;

  // Create A4 PDF in portrait mode
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // ── HEADER BRANDING ──
  // Top Blue accent line
  doc.setFillColor(2, 132, 199);
  doc.rect(margin, 10, contentWidth, 2, 'F');

  // Brand Badge
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, 15, 10, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RL', margin + 2.5, 21.5);

  // Brand Name & Subtitle
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('RideLog BD', margin + 13, 20);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Official Vehicle Telemetry & Expense Statement', margin + 13, 24);

  // Statement Meta Box (Right aligned)
  const metaRight = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(2, 132, 199);
  doc.text('VEHICLE STATEMENT', metaRight, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Statement No: ${statementNo}`, metaRight, 22, { align: 'right' });
  doc.text(`Issue Date: ${statementDate}  |  Period: ${periodLabel}`, metaRight, 25.5, { align: 'right' });

  // Divider line below header
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, 28, metaRight, 28);

  // ── 2-COLUMN PROFILE CARDS ──
  const cardWidth = (contentWidth - 6) / 2;
  const cardTop = 31;
  const cardHeight = 22;

  // Card 1: Rider Details
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, cardTop, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(2, 132, 199);
  doc.text('RIDER ACCOUNT DETAILS', margin + 4, cardTop + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Name: ${user?.displayName || 'App User'}`, margin + 4, cardTop + 10);
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.text(`Email: ${user?.email || 'N/A'}`, margin + 4, cardTop + 14.5);
  doc.text(`Account ID: ${(user?.uid || 'N/A').slice(0, 16)}...`, margin + 4, cardTop + 18.5);

  // Card 2: Vehicle Details
  const card2Left = margin + cardWidth + 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(card2Left, cardTop, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(2, 132, 199);
  doc.text('VEHICLE PROFILE', card2Left + 4, cardTop + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Model: ${activeBike.name || 'Motorcycle'}`, card2Left + 4, cardTop + 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.text(`Reg No: ${activeBike.regNumber || 'Not Registered'}`, card2Left + 4, cardTop + 14.5);
  doc.text(`Current Odometer: ${(activeBike.currentOdometer || 0).toLocaleString()} km`, card2Left + 4, cardTop + 18.5);

  // ── FINANCIAL SUMMARY KPI BOXES ──
  const kpiTop = 56;
  const kpiHeight = 15;
  const kpiWidth = (contentWidth - 9) / 4;

  const kpis = [
    { label: 'TOTAL FUEL SPEND', val: `Tk ${totalFuelSpent.toLocaleString()}`, color: [5, 150, 105], bg: [240, 253, 244], border: [187, 247, 208] },
    { label: 'TOTAL SERVICE SPEND', val: `Tk ${totalServiceSpent.toLocaleString()}`, color: [217, 119, 6], bg: [255, 251, 235], border: [254, 230, 138] },
    { label: 'GRAND TOTAL EXPENSE', val: `Tk ${grandTotal.toLocaleString()}`, color: [124, 58, 237], bg: [250, 245, 255], border: [233, 213, 255] },
    showConveyance
      ? { label: `NET CONVEYANCE ${yearlySavings >= 0 ? 'SAVINGS' : 'DEFICIT'}`, val: `${yearlySavings >= 0 ? '+' : ''}Tk ${Math.abs(yearlySavings).toLocaleString()}`, color: yearlySavings >= 0 ? [5, 150, 105] : [220, 38, 38], bg: [240, 249, 255], border: [186, 230, 253] }
      : { label: 'AVERAGE MILEAGE', val: fuelStats.avgMileage ? `${fuelStats.avgMileage} km/L` : 'N/A', color: [2, 132, 199], bg: [236, 254, 255], border: [165, 243, 252] }
  ];

  kpis.forEach((kpi, idx) => {
    const kpiLeft = margin + idx * (kpiWidth + 3);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
    doc.roundedRect(kpiLeft, kpiTop, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.label, kpiLeft + kpiWidth / 2, kpiTop + 4.5, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, kpiLeft + kpiWidth / 2, kpiTop + 10.5, { align: 'center' });
  });

  let currentY = kpiTop + kpiHeight + 6;

  // ── OPTIONAL CONVEYANCE TABLE ──
  if (showConveyance && conveyanceRows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Corporate Conveyance Summary (Monthly Allowance: Tk ${monthlyAllowance.toLocaleString()})`, margin, currentY);

    const convHeaders = [['Month', 'Fuel Cost (Tk)', 'Service Cost (Tk)', 'Total Expense (Tk)', 'Allowance (Tk)', 'Savings / Deficit (Tk)']];
    const convBody = conveyanceRows.map(r => [
      r.month,
      r.fuelCost.toLocaleString(),
      r.serviceCost.toLocaleString(),
      r.totalExpense.toLocaleString(),
      r.allowance.toLocaleString(),
      `${r.savings >= 0 ? '+' : ''}${r.savings.toLocaleString()}`
    ]);

    convBody.push([
      'TOTAL',
      conveyanceRows.reduce((s, r) => s + r.fuelCost, 0).toLocaleString(),
      conveyanceRows.reduce((s, r) => s + r.serviceCost, 0).toLocaleString(),
      yearlyExpense.toLocaleString(),
      yearlyAllowance.toLocaleString(),
      `${yearlySavings >= 0 ? '+' : ''}${yearlySavings.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: currentY + 2,
      head: convHeaders,
      body: convBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 1.8, halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left' },
        3: { fontStyle: 'bold' },
        5: { fontStyle: 'bold' }
      },
      margin: { left: margin, right: margin }
    });

    currentY = doc.lastAutoTable.finalY + 6;
  }

  // ── SECTION 1: FUEL REFILL LOGS TABLE ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Section 1: Detailed Fuel Refill Log Statement (${sortedFuel.length} Records)`, margin, currentY);

  const fuelHeaders = [['Date', 'Quantity', 'Rate', 'Total Cost', 'Odometer', 'Station / Notes', 'Mileage']];
  const fuelBody = sortedFuel.length === 0
    ? [['No fuel refill records found for the selected period.', '', '', '', '', '', '']]
    : sortedFuel.map(f => [
        f.date || 'N/A',
        `${f.liters || 0} L`,
        f.pricePerLiter ? `Tk ${f.pricePerLiter}` : '-',
        `Tk ${Number(f.totalAmount || (f.liters * f.pricePerLiter) || 0).toLocaleString()}`,
        f.odometer ? `${f.odometer} km` : '-',
        (f.stationName || f.notes || '-').slice(0, 30),
        f.calculatedMileage ? `${f.calculatedMileage} km/L` : (f.fullTank ? 'Full Tank' : '-')
      ]);

  autoTable(doc, {
    startY: currentY + 2,
    head: fuelHeaders,
    body: fuelBody,
    theme: 'grid',
    headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { fontStyle: 'bold', textColor: [5, 150, 105], halign: 'right' },
      4: { halign: 'right' },
      6: { fontStyle: 'bold', textColor: [2, 132, 199], halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 6;

  // ── SECTION 2: SERVICE & MAINTENANCE TABLE ──
  // Check if we need to add a page or start table
  if (currentY > 240) {
    doc.addPage();
    currentY = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Section 2: Maintenance & Workshop Records Statement (${sortedService.length} Records)`, margin, currentY);

  const serviceHeaders = [['Date', 'Service Items', 'Garage / Center', 'Odometer', 'Parts (Tk)', 'Labor (Tk)', 'Total (Tk)']];
  const serviceBody = sortedService.length === 0
    ? [['No service or maintenance records found for the selected period.', '', '', '', '', '', '']]
    : sortedService.map(s => [
        s.date || 'N/A',
        (s.serviceTypes?.join(', ') || s.notes || 'Routine Servicing').slice(0, 32),
        (s.garageName || 'Service Center').slice(0, 24),
        s.odometer ? `${s.odometer} km` : '-',
        (Number(s.partsCost) || 0).toLocaleString(),
        (Number(s.serviceCost) || 0).toLocaleString(),
        `Tk ${((Number(s.partsCost) || 0) + (Number(s.serviceCost) || 0)).toLocaleString()}`
      ]);

  autoTable(doc, {
    startY: currentY + 2,
    head: serviceHeaders,
    body: serviceBody,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { fontStyle: 'bold', textColor: [217, 119, 6], halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  // ── FOOTER ON EVERY PAGE ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 287, pageWidth - margin, 287);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Official Statement generated dynamically by RideLog BD Telemetry Engine. Authenticated with verified user records.',
      margin,
      291
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      291,
      { align: 'right' }
    );
  }

  // ── DELIVER AS REAL PDF FILE ──
  const cleanBikeName = (activeBike.name || 'Bike').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `RideLog_${cleanBikeName}_Statement_${Date.now().toString().slice(-6)}.pdf`;
  const base64Data = doc.output('datauristring').split(',')[1];

  return await deliverExportFile(fileName, base64Data, 'application/pdf');
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
