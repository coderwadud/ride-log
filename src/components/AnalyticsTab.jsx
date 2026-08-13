import React from 'react';
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
import { translations } from '../utils/translations';
import { getMonthlyAnalytics, formatNum } from '../utils/calculations';

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

export default function AnalyticsTab({ lang, fuelLogs, serviceLogs, fuelStats }) {
  const t = translations[lang];
  const monthlyData = getMonthlyAnalytics(fuelLogs, serviceLogs);

  // Mileage Trend Chart Data
  const sortedLogs = [...(fuelStats.processedLogs || [])]
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

  return (
    <div className="analytics-view">
      <h2 style={{ marginBottom: '20px' }}>{t.analytics}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
      </div>
    </div>
  );
}
