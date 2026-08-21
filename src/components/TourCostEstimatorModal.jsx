import React, { useState } from 'react';
import {
  Calculator, X, MapPin, Users, Fuel, Hotel, UtensilsCrossed,
  Receipt, FileText, Download, ArrowRight, Sparkles, Check, Car
} from 'lucide-react';
import { translations } from '../utils/translations';
import { calculateCostEstimate } from '../utils/tourCalculations';

export default function TourCostEstimatorModal({ lang = 'bn', onClose, onConvertToTour }) {
  const t = translations[lang] || translations['bn'];

  const [tourName, setTourName] = useState('Sajek / Cox\'s Bazar Tour');
  const [distanceKm, setDistanceKm] = useState(400);
  const [numPeople, setNumPeople] = useState(4);
  const [numBikes, setNumBikes] = useState(4);
  const [kmPerLiter, setKmPerLiter] = useState(40);
  const [fuelPrice, setFuelPrice] = useState(135);
  const [numDays, setNumDays] = useState(3);
  const [numNights, setNumNights] = useState(2);
  const [foodPerDay, setFoodPerDay] = useState(350);
  const [hotelPerNight, setHotelPerNight] = useState(800);
  const [tollCost, setTollCost] = useState(150);
  const [parkingCost, setParkingCost] = useState(100);
  const [guideCost, setGuideCost] = useState(0);
  const [ticketCost, setTicketCost] = useState(200);
  const [miscCost, setMiscCost] = useState(500);

  // Live calculation
  const totalKmAllBikes = distanceKm * numBikes;
  const fuelLitersTotal = Math.round((totalKmAllBikes / (kmPerLiter || 40)) * 10) / 10;
  const fuelCostTotal = Math.round(fuelLitersTotal * (fuelPrice || 135));
  const fuelCostPerBike = Math.round(fuelCostTotal / (numBikes || 1));

  const foodCostTotal = Math.round((foodPerDay || 0) * (numDays || 1) * (numPeople || 1));
  const hotelCostTotal = Math.round((hotelPerNight || 0) * (numNights || 0) * (numPeople || 1));
  const otherCostTotal = Number(tollCost || 0) + Number(parkingCost || 0) + Number(guideCost || 0) + (Number(ticketCost || 0) * (numPeople || 1)) + Number(miscCost || 0);

  const totalCost = fuelCostTotal + foodCostTotal + hotelCostTotal + otherCostTotal;
  const costPerPerson = Math.round(totalCost / (numPeople || 1));
  const costPerKm = distanceKm > 0 ? (totalCost / distanceKm).toFixed(2) : '0.00';

  // Export Estimate PDF
  const downloadEstimatePdf = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule;

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text('RideLog BD — Tour Cost Estimate', 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Tour: ${tourName} | Generated: ${new Date().toLocaleDateString()}`, 14, 27);
      doc.text(`Distance: ${distanceKm} km | Members: ${numPeople} | Bikes: ${numBikes} | Duration: ${numDays} Days, ${numNights} Nights`, 14, 33);

      const tableData = [
        ['Fuel Cost (All Bikes)', `${fuelLitersTotal} L @ ৳${fuelPrice}/L (${numBikes} bikes)`, `BDT ${fuelCostTotal}`],
        ['Food Budget', `BDT ${foodPerDay}/day x ${numDays} days x ${numPeople} people`, `BDT ${foodCostTotal}`],
        ['Hotel Budget', `BDT ${hotelPerNight}/night x ${numNights} nights x ${numPeople} people`, `BDT ${hotelCostTotal}`],
        ['Tolls & Parking', `Tolls: BDT ${tollCost} | Parking: BDT ${parkingCost}`, `BDT ${Number(tollCost) + Number(parkingCost)}`],
        ['Tickets & Guide', `Tickets: BDT ${Number(ticketCost) * numPeople} | Guide: BDT ${guideCost}`, `BDT ${(Number(ticketCost) * numPeople) + Number(guideCost)}`],
        ['Emergency & Misc', `Contingency budget`, `BDT ${miscCost}`],
        ['TOTAL ESTIMATED COST', `Per Person: BDT ${costPerPerson} | Per Bike: BDT ${Math.round(totalCost / numBikes)}`, `BDT ${totalCost}`]
      ];

      autoTable(doc, {
        startY: 40,
        head: [['Expense Item', 'Calculation Breakdown', 'Estimated Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
        footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' }
      });

      doc.save(`Tour_Estimate_${tourName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Could not export PDF: ' + err.message);
    }
  };

  // Export Estimate Excel (CSV)
  const downloadEstimateExcel = () => {
    const rows = [
      ['RideLog BD — Tour Cost Estimate'],
      ['Tour Name', tourName],
      ['Date Generated', new Date().toLocaleString()],
      ['Total Distance (km)', distanceKm],
      ['Total Members', numPeople],
      ['Total Bikes', numBikes],
      ['Days / Nights', `${numDays} Days, ${numNights} Nights`],
      [],
      ['Category', 'Details', 'Estimated Cost (BDT)'],
      ['Fuel Cost', `${fuelLitersTotal} Liters for ${numBikes} bikes`, fuelCostTotal],
      ['Food Budget', `${numDays} days @ BDT ${foodPerDay}/day for ${numPeople} people`, foodCostTotal],
      ['Hotel Budget', `${numNights} nights @ BDT ${hotelPerNight}/night for ${numPeople} people`, hotelCostTotal],
      ['Toll Cost', 'Highway tolls', tollCost],
      ['Parking Cost', 'Bike parking', parkingCost],
      ['Entry & Guide', 'Spots ticket & guide fee', (Number(ticketCost) * numPeople) + Number(guideCost)],
      ['Emergency / Misc', 'Contingency fund', miscCost],
      ['TOTAL ESTIMATE', '', totalCost],
      ['Cost Per Person', '', costPerPerson],
      ['Cost Per Bike', '', Math.round(totalCost / numBikes)],
      ['Cost Per KM', '', costPerKm]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Tour_Estimate_${tourName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConvertToTour = () => {
    if (onConvertToTour) {
      onConvertToTour({
        title: tourName,
        estimatedDistanceKm: distanceKm,
        numMembers: numPeople,
        numBikes: numBikes,
        costEstimate: {
          totalCost,
          fuelCost: fuelCostTotal,
          foodCost: foodCostTotal,
          hotelCost: hotelCostTotal,
          tollCost: Number(tollCost) || 0,
          otherCost: Number(miscCost) + Number(parkingCost) + Number(guideCost) + (Number(ticketCost) * numPeople),
          perPerson: costPerPerson,
          kmPerLiter,
          fuelPricePerLiter: fuelPrice,
          days: numDays,
          nights: numNights
        }
      });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="tour-estimator-modal" style={{ maxWidth: '640px', width: '95%' }}>
        {/* Header */}
        <div className="tour-create-header">
          <div className="tour-create-title-row">
            <Calculator size={18} className="text-indigo-400" />
            <span>{t.costEstimatorTitle || 'ট্যুর খরচ ক্যালকুলেটর'}</span>
          </div>
          <button className="tour-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Notice */}
        <div className="tour-estimator-notice">
          ℹ️ {t.estimateNotice || 'এই ক্যালকুলেটরে হিসাব ডেটাবেজে সংরক্ষণ হয় না, তাৎক্ষণিক PDF/Excel ডাউনলোড করতে পারবেন।'}
        </div>

        {/* Body */}
        <div className="tour-create-body" style={{ maxHeight: '72vh' }}>
          <div className="tour-estimator-grid">
            <div className="form-group">
              <label>🎯 ট্যুরের নাম</label>
              <input
                type="text"
                className="form-input"
                value={tourName}
                onChange={e => setTourName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>📍 আনুমানিক দূরত্ব (কিমি)</label>
              <input
                type="number"
                className="form-input"
                value={distanceKm}
                onChange={e => setDistanceKm(Number(e.target.value))}
              />
            </div>

            <div className="tour-grid-2">
              <div className="form-group">
                <label>👥 সদস্য সংখ্যা</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={numPeople}
                  onChange={e => setNumPeople(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>🏍️ মোট বাইক সংখ্যা</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={numBikes}
                  onChange={e => setNumBikes(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="tour-grid-2">
              <div className="form-group">
                <label>⛽ বাইকের মাইলেজ (কিমি/লিটার)</label>
                <input
                  type="number"
                  className="form-input"
                  value={kmPerLiter}
                  onChange={e => setKmPerLiter(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>⛽ জ্বালানির দাম (৳/লিটার)</label>
                <input
                  type="number"
                  className="form-input"
                  value={fuelPrice}
                  onChange={e => setFuelPrice(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="tour-grid-2">
              <div className="form-group">
                <label>☀️ ট্যুরের দিন সংখ্যা</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={numDays}
                  onChange={e => setNumDays(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>🌙 রাত সংখ্যা</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  value={numNights}
                  onChange={e => setNumNights(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="tour-grid-2">
              <div className="form-group">
                <label>🍽️ জনপ্রতি খাবার বাজেট (৳/দিন)</label>
                <input
                  type="number"
                  className="form-input"
                  value={foodPerDay}
                  onChange={e => setFoodPerDay(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>🏨 প্রতি রাতের হোটেল বাজেট (৳/রাত)</label>
                <input
                  type="number"
                  className="form-input"
                  value={hotelPerNight}
                  onChange={e => setHotelPerNight(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="tour-grid-3">
              <div className="form-group">
                <label>🛣️ টোল (৳)</label>
                <input
                  type="number"
                  className="form-input"
                  value={tollCost}
                  onChange={e => setTollCost(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>🅿️ পার্কিং (৳)</label>
                <input
                  type="number"
                  className="form-input"
                  value={parkingCost}
                  onChange={e => setParkingCost(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>📦 অন্যান্য / ইমার্জেন্সি (৳)</label>
                <input
                  type="number"
                  className="form-input"
                  value={miscCost}
                  onChange={e => setMiscCost(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Live Summary Calculation Box */}
          <div className="tour-estimator-summary">
            <div className="tour-estimator-summary-header">
              <Sparkles size={16} className="text-amber-400" />
              <strong>সম্ভাব্য খরচের ফলাফল (Live Breakdown)</strong>
            </div>

            <div className="tour-cost-breakdown">
              <div className="tour-cost-row">
                <span>⛽ মোট ফুয়েল ({fuelLitersTotal} লিটার, {numBikes} বাইক)</span>
                <strong>৳{fuelCostTotal}</strong>
              </div>
              <div className="tour-cost-row">
                <span>🍽️ মোট খাবার খরচ ({numDays} দিন, {numPeople} জন)</span>
                <strong>৳{foodCostTotal}</strong>
              </div>
              <div className="tour-cost-row">
                <span>🏨 মোট হোটেল খরচ ({numNights} রাত)</span>
                <strong>৳{hotelCostTotal}</strong>
              </div>
              <div className="tour-cost-row">
                <span>🛣️ টোল, পার্কিং ও অন্যান্য</span>
                <strong>৳{otherCostTotal}</strong>
              </div>
              <div className="tour-cost-row total">
                <span className="tour-cost-total">মোট সম্ভাব্য ট্যুর বাজেট</span>
                <span className="tour-cost-total">৳{totalCost.toLocaleString()}</span>
              </div>
            </div>

            <div className="tour-estimator-kpi-grid">
              <div className="tour-estimator-kpi-box">
                <span className="label">👤 জনপ্রতি খরচ</span>
                <span className="val">৳{costPerPerson.toLocaleString()}</span>
              </div>
              <div className="tour-estimator-kpi-box">
                <span className="label">🏍️ প্রতি বাইকে খরচ</span>
                <span className="val">৳{Math.round(totalCost / numBikes).toLocaleString()}</span>
              </div>
              <div className="tour-estimator-kpi-box">
                <span className="label">📏 প্রতি কিমিতে খরচ</span>
                <span className="val">৳{costPerKm}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="tour-estimator-footer">
          <button className="tour-btn-ghost" onClick={downloadEstimatePdf} title="PDF Download">
            <Download size={14} />
            <span>PDF রিপোর্ট</span>
          </button>
          <button className="tour-btn-ghost" onClick={downloadEstimateExcel} title="Excel CSV Download">
            <FileText size={14} />
            <span>Excel ফাইল</span>
          </button>
          {onConvertToTour && (
            <button className="tour-btn-primary" onClick={handleConvertToTour} style={{ marginLeft: 'auto' }}>
              <span>{t.convertIntoTour || 'ট্যুর তৈরি করুন'}</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
