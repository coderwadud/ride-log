/**
 * Calculate precise mileage and statistics for Bike Fuel & Service logs
 */

// Format currency in BDT ৳ with proper digits based on lang ('bn' vs 'en')
export function formatCurrency(amount, lang = 'bn') {
  if (isNaN(amount) || amount === null || amount === undefined) return lang === 'bn' ? '৳০' : '৳0';
  const num = Number(amount);
  
  if (lang === 'en') {
    return '৳' + num.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }

  const bnFormatted = num.toLocaleString('bn-BD', { maximumFractionDigits: 1 });
  return '৳' + bnFormatted;
}

// Format numbers in Bengali or English based on lang
export function formatNum(num, lang = 'bn') {
  if (num === null || num === undefined || isNaN(num)) return lang === 'bn' ? '০' : '0';
  
  if (lang === 'en') {
    return typeof num === 'number' ? Number(num.toFixed(1)).toString() : String(num);
  }

  const formatted = typeof num === 'number' ? Number(num.toFixed(1)).toString() : String(num);
  const bnNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return formatted.replace(/[0-9]/g, (w) => bnNumbers[parseInt(w)]);
}

/**
 * Process fuel logs sorted chronologically to calculate mileage (km/l) for each entry
 * 
 * Algorithm:
 * - Trip i fuel consumed = Liters from fill i-1 (the fuel burned during trip i)
 * - Individual Mileage for entry i = (Odometer_i - Odometer_{i-1}) / Liters_{i-1}
 * - Overall Total Distance = Odometer_{last} - Odometer_0
 * - Overall Fuel Consumed = Sum of all fills from 0 to N-2 (excludes the last fill N-1 sitting in tank)
 * - Overall Avg Mileage = Overall Total Distance / Overall Fuel Consumed
 */
export function calculateFuelLogStats(fuelLogs = []) {
  if (!fuelLogs || fuelLogs.length === 0) {
    return {
      processedLogs: [],
      totalDistance: 0,
      totalFuelSpent: 0,
      totalLiters: 0,
      avgMileage: 0,
      costPerKm: 0,
      lastFuelLiters: 0,
      lastFuelCost: 0,
      lastMileage: 0
    };
  }

  // Sort logs by date & odometer ascending
  const sorted = [...fuelLogs].sort((a, b) => new Date(a.date) - new Date(b.date) || a.odometer - b.odometer);

  let totalFuelSpent = 0;
  let totalLiters = 0; // all liters summed (for total display)

  const processed = sorted.map((log, index) => {
    totalFuelSpent += Number(log.totalAmount || 0);
    totalLiters += Number(log.liters || 0);

    let tripDistance = 0;
    let calculatedMileage = null;

    if (index > 0) {
      const prevLog = sorted[index - 1];
      tripDistance = Math.max(0, Number(log.odometer) - Number(prevLog.odometer));

      // Fuel used for this trip is the liters refilled at the PREVIOUS stop (prevLog.liters)
      const prevLiters = Number(prevLog.liters || 0);
      if (prevLiters > 0 && tripDistance > 0) {
        calculatedMileage = tripDistance / prevLiters;
      }
    }

    return {
      ...log,
      tripDistance,
      calculatedMileage: calculatedMileage ? Number(calculatedMileage.toFixed(2)) : null
    };
  });

  // Calculate Overall Distance Driven
  const minOdo = sorted[0]?.odometer || 0;
  const maxOdo = sorted[sorted.length - 1]?.odometer || 0;
  const totalDistance = Math.max(0, maxOdo - minOdo);

  // Calculate overall fuel consumed (Sum of fills from index 0 to N-2, EXCLUDING the last fill N-1)
  let consumedLiters = 0;
  if (sorted.length >= 2) {
    for (let i = 0; i < sorted.length - 1; i++) {
      consumedLiters += Number(sorted[i].liters || 0);
    }
  }

  // Overall Average Mileage = Total Distance / Consumed Liters (excluding last fill)
  let avgMileage = 0;
  if (consumedLiters > 0 && totalDistance > 0) {
    avgMileage = totalDistance / consumedLiters;
  }

  // Cost per KM driven
  const costPerKm = totalDistance > 0 ? totalFuelSpent / totalDistance : 0;

  const processedLogs = processed.reverse();
  const latestLog = processedLogs[0] || null;
  const lastFuelLiters = latestLog ? Number(latestLog.liters || 0) : 0;
  const lastFuelCost = latestLog ? Number(latestLog.totalAmount || 0) : 0;

  const lastMileageLog = processedLogs.find(l => l.calculatedMileage !== null && l.calculatedMileage > 0);
  const lastMileage = lastMileageLog ? Number(lastMileageLog.calculatedMileage) : 0;

  return {
    processedLogs,
    totalDistance,
    totalFuelSpent,
    totalLiters,
    avgMileage: Number(avgMileage.toFixed(2)),
    costPerKm: Number(costPerKm.toFixed(2)),
    lastFuelLiters,
    lastFuelCost,
    lastMileage
  };
}


/**
 * Calculate total service expenses and latest engine oil change info
 */
export function calculateServiceStats(serviceLogs = [], currentOdometer = 0, oilIntervalKm = 1000) {
  if (!serviceLogs || serviceLogs.length === 0) {
    return {
      totalServiceSpent: 0,
      totalLaborSpent: 0,
      totalPartsSpent: 0,
      lastOilChangeKm: 0,
      kmSinceLastOilChange: currentOdometer,
      kmUntilNextOilChange: oilIntervalKm,
      oilHealthPercentage: 100,
      oilStatus: 'good'
    };
  }

  let totalLaborSpent = 0;
  let totalPartsSpent = 0;
  let lastOilChangeKm = 0;
  let lastOilChangeDate = null;

  // Sort logs by odometer descending
  const sorted = [...serviceLogs].sort((a, b) => b.odometer - a.odometer || new Date(b.date) - new Date(a.date));

  sorted.forEach(log => {
    totalLaborSpent += Number(log.serviceCost || 0);
    totalPartsSpent += Number(log.partsCost || 0);

    // Track latest engine oil change
    if ((log.isEngineOilChange || log.types?.includes('catEngineOil')) && !lastOilChangeKm) {
      lastOilChangeKm = Number(log.odometer || 0);
      lastOilChangeDate = log.date;
    }
  });

  const totalServiceSpent = totalLaborSpent + totalPartsSpent;

  // Calculate engine oil status
  const kmSinceLastOilChange = lastOilChangeKm ? Math.max(0, currentOdometer - lastOilChangeKm) : currentOdometer;
  const kmUntilNextOilChange = Math.max(0, oilIntervalKm - kmSinceLastOilChange);
  const oilHealthPercentage = Math.max(0, Math.min(100, Math.round(((oilIntervalKm - kmSinceLastOilChange) / oilIntervalKm) * 100)));

  let oilStatus = 'good';
  if (oilHealthPercentage <= 15) {
    oilStatus = 'danger';
  } else if (oilHealthPercentage <= 35) {
    oilStatus = 'warning';
  }

  return {
    totalServiceSpent,
    totalLaborSpent,
    totalPartsSpent,
    lastOilChangeKm,
    lastOilChangeDate,
    kmSinceLastOilChange,
    kmUntilNextOilChange,
    oilHealthPercentage,
    oilStatus
  };
}

/**
 * Monthly analytics aggregator for charts
 */
export function getMonthlyAnalytics(fuelLogs = [], serviceLogs = []) {
  const monthsMap = {};

  fuelLogs.forEach(log => {
    if (!log.date) return;
    const dateObj = new Date(log.date);
    const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    if (!monthsMap[key]) monthsMap[key] = { month: key, fuel: 0, service: 0 };
    monthsMap[key].fuel += Number(log.totalAmount || 0);
  });

  serviceLogs.forEach(log => {
    if (!log.date) return;
    const dateObj = new Date(log.date);
    const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    if (!monthsMap[key]) monthsMap[key] = { month: key, fuel: 0, service: 0 };
    monthsMap[key].service += Number(log.serviceCost || 0) + Number(log.partsCost || 0);
  });

  const sortedMonths = Object.keys(monthsMap).sort().slice(-6); // last 6 months
  return sortedMonths.map(key => ({
    month: key,
    fuel: monthsMap[key].fuel,
    service: monthsMap[key].service,
    total: monthsMap[key].fuel + monthsMap[key].service
  }));
}
