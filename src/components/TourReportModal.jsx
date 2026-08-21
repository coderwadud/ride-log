import React, { useState } from 'react';
import { X, FileText, Download, Loader } from 'lucide-react';
import { translations } from '../utils/translations';
import { Capacitor } from '@capacitor/core';
import { summarizeExpensesByCategory, getTotalExpenses, getTotalFundCollected, EXPENSE_CATEGORIES } from '../utils/tourCalculations';

export default function TourReportModal({ tourId, tour, members, expenses, contributions, balances, transactions, settledKeys, lang = 'bn', onClose }) {
  const t = translations[lang] || translations['bn'];
  const [generating, setGenerating] = useState(false);

  const total = getTotalExpenses(expenses);
  const totalFund = getTotalFundCollected(contributions);
  const catSummary = summarizeExpensesByCategory(expenses);

  const formatDate = (iso) => {
    try { return new Date(iso).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso || ''; }
  };

  const handleExportPdf = async () => {
    setGenerating(true);
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();

      // ── Header ──
      doc.setFillColor(79, 70, 229); // indigo
      doc.rect(0, 0, pageW, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('RideLog BD', 14, 14);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Tour Report', 14, 22);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString('en-BD')}`, 14, 29);

      // ── Tour info ──
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(tour?.title || 'Tour', 14, 48);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const destLine = tour?.destinations?.map(d => d.name).join(' → ') || '';
      if (destLine) doc.text(destLine, 14, 55);
      doc.text(`${formatDate(tour?.startDate)} → ${formatDate(tour?.endDate)}`, 14, 61);
      doc.text(`Members: ${(tour?.memberIds?.length || 0) + (tour?.guestMembers?.length || 0)} | Distance: ${tour?.estimatedDistanceKm || 0} km`, 14, 67);

      // ── Cost summary table ──
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Expense Summary', 14, 78);

      autoTable(doc, {
        startY: 82,
        head: [['Category', 'Count', 'Amount (৳)']],
        body: [
          ...catSummary.map(c => [c.labelEn, c.count.toString(), c.total.toLocaleString('en-IN')]),
          [{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, { content: '', styles: { fontStyle: 'bold' } }, { content: `৳${total.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold' } }]
        ],
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 }
      });

      const y1 = doc.lastAutoTable.finalY + 8;

      // ── Expense details ──
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('All Expenses', 14, y1);

      autoTable(doc, {
        startY: y1 + 4,
        head: [['Date', 'Title', 'Category', 'Paid By', 'Amount (৳)']],
        body: expenses.map(e => [
          formatDate(e.date),
          e.title,
          EXPENSE_CATEGORIES[e.category]?.labelEn || e.category,
          e.paidBy?.name || '?',
          Number(e.amount).toLocaleString('en-IN')
        ]),
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8 }
      });

      const y2 = doc.lastAutoTable.finalY + 8;

      // ── Fund contributions ──
      if (contributions.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Common Fund (Total: ৳${totalFund.toLocaleString('en-IN')})`, 14, y2);
        autoTable(doc, {
          startY: y2 + 4,
          head: [['Date', 'Contributed By', 'Amount (৳)']],
          body: contributions.map(c => [formatDate(c.date), c.contributedBy?.name || '?', Number(c.amount).toLocaleString('en-IN')]),
          headStyles: { fillColor: [16, 185, 129] },
          styles: { fontSize: 8 }
        });
      }

      const y3 = doc.lastAutoTable?.finalY + 8 || y2 + 8;

      // ── Settlement ──
      if (transactions.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Settlement', 14, y3);
        autoTable(doc, {
          startY: y3 + 4,
          head: [['From', 'To', 'Amount (৳)', 'Status']],
          body: transactions.map(tx => [
            tx.from.name,
            tx.to.name,
            tx.amount.toLocaleString('en-IN'),
            settledKeys.has(tx.key) ? 'Settled ✓' : 'Pending'
          ]),
          headStyles: { fillColor: [245, 158, 11] },
          styles: { fontSize: 8 }
        });
      }

      // ── Footer ──
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`RideLog BD Tour Report — Page ${i} of ${pageCount}`, pageW / 2, 290, { align: 'center' });
      }

      const fileName = `RideLog_Tour_${(tour?.title || 'Report').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        const path = `exports/${fileName}`;
        await Filesystem.writeFile({ path, data: pdfBase64, directory: Directory.Cache, recursive: true });
        const uriResult = await Filesystem.getUri({ directory: Directory.Cache, path });
        await Share.share({ title: fileName, url: uriResult.uri, dialogTitle: `Open ${fileName}` });
      } else {
        doc.save(fileName);
      }
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportExcel = async () => {
    setGenerating(true);
    try {
      // Build simple TSV / HTML-based XLS
      const lines = [
        `Tour: ${tour?.title || ''}`,
        `Dates: ${formatDate(tour?.startDate)} - ${formatDate(tour?.endDate)}`,
        `Route: ${tour?.destinations?.map(d => d.name).join(' → ') || ''}`,
        '',
        'EXPENSES',
        'Date\tTitle\tCategory\tPaid By\tAmount',
        ...expenses.map(e => `${formatDate(e.date)}\t${e.title}\t${EXPENSE_CATEGORIES[e.category]?.labelEn || e.category}\t${e.paidBy?.name || '?'}\t${e.amount}`),
        '',
        `Total\t\t\t\t${total}`,
        '',
        'FUND CONTRIBUTIONS',
        'Date\tContributed By\tAmount',
        ...contributions.map(c => `${formatDate(c.date)}\t${c.contributedBy?.name || '?'}\t${c.amount}`),
        '',
        `Total Fund\t\t${totalFund}`,
        '',
        'SETTLEMENT',
        'From\tTo\tAmount\tStatus',
        ...transactions.map(tx => `${tx.from.name}\t${tx.to.name}\t${tx.amount}\t${settledKeys.has(tx.key) ? 'Settled' : 'Pending'}`)
      ];

      const content = lines.join('\n');
      const fileName = `RideLog_Tour_${(tour?.title || 'Report').replace(/[^a-zA-Z0-9]/g, '_')}.xls`;

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        await Filesystem.writeFile({ path: `exports/${fileName}`, data: content, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
        const uriResult = await Filesystem.getUri({ directory: Directory.Cache, path: `exports/${fileName}` });
        await Share.share({ title: fileName, url: uriResult.uri });
      } else {
        const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Excel export error:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tour-report-modal">
        <div className="tour-create-header">
          <div className="tour-create-title-row"><FileText size={20} /> {t.tourReport}</div>
          <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="tour-report-body">
          {/* Summary preview */}
          <div className="tour-report-preview">
            <h3>{tour?.title}</h3>
            <p>{formatDate(tour?.startDate)} → {formatDate(tour?.endDate)}</p>
            <div className="tour-report-stats">
              <div className="tour-report-stat"><span>{lang === 'bn' ? 'মোট খরচ' : 'Total Expenses'}</span><strong>৳{total.toLocaleString('en-IN')}</strong></div>
              <div className="tour-report-stat"><span>{t.totalCollected}</span><strong>৳{totalFund.toLocaleString('en-IN')}</strong></div>
              <div className="tour-report-stat"><span>{lang === 'bn' ? 'সদস্য' : 'Members'}</span><strong>{members.length + (tour?.guestMembers?.length || 0)}</strong></div>
              <div className="tour-report-stat"><span>{lang === 'bn' ? 'লেনদেন' : 'Transactions'}</span><strong>{transactions.length}</strong></div>
            </div>
          </div>

          {/* Export buttons */}
          <div className="tour-report-actions">
            <button className="tour-report-btn pdf" onClick={handleExportPdf} disabled={generating}>
              {generating ? <Loader size={18} className="spin" /> : <Download size={18} />}
              <span>PDF {lang === 'bn' ? 'রিপোর্ট' : 'Report'}</span>
            </button>
            <button className="tour-report-btn excel" onClick={handleExportExcel} disabled={generating}>
              {generating ? <Loader size={18} className="spin" /> : <Download size={18} />}
              <span>Excel (.xls)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
