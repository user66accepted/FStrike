import React from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';

const CampaignStatistics = ({ stats }) => {
  // If no stats available yet, show loading or empty state
  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-lg text-gray-600">No statistics available</p>
      </div>
    );
  }

  // Colors for charts
  const colors = {
    blue: '#3B82F6',
    lightBlue: '#93C5FD',
    green: '#10B981',
    amber: '#F59E0B',
    red: '#EF4444',
    gray: '#E5E7EB',
    purple: '#8B5CF6',
    indigo: '#6366F1'
  };

  // Data for email metrics bar chart
  const barChartData = {
    labels: ['Emails Sent', 'Emails Opened', 'Unique Opens', 'Links Clicked', 'Unique Clicks'],
    datasets: [
      {
        label: 'Count',
        data: [
          stats.totalSent,
          stats.totalOpened,
          stats.uniqueOpens,
          stats.totalClicks,
          stats.uniqueClicks
        ],
        backgroundColor: [
          colors.blue,
          colors.green,
          colors.lightBlue,
          colors.amber,
          colors.purple
        ],
        borderWidth: 1
      }
    ]
  };

  // Options for bar chart
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => `Count: ${context.raw}`
        }
      },
      datalabels: {
        color: '#fff',
        font: {
          weight: 'bold'
        },
        formatter: (value) => value
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Count'
        }
      }
    }
  };

  // Data for doughnut charts
  const createDoughnutData = (value, total, label) => ({
    labels: [label, 'Remaining'],
    datasets: [{
      data: [value, Math.max(0, total - value)],
      backgroundColor: [getColorForMetric(label), colors.gray],
      borderWidth: 0
    }]
  });

  // Get appropriate color based on metric type
  const getColorForMetric = (metricName) => {
    const metricColors = {
      'Emails Opened': colors.green,
      'Unique Opens': colors.lightBlue,
      'Links Clicked': colors.amber,
      'Unique Clicks': colors.purple,
    };
    return metricColors[metricName] || colors.blue;
  };

  // Options for doughnut charts
  const doughnutOptions = {
    cutout: '70%',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label;
            const value = context.raw;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      },
      datalabels: {
        color: '#000',
        font: {
          size: 12,
          weight: 'bold'
        },
        formatter: (value, ctx) => {
          if (ctx.dataIndex === 0) { // Only show percentage for the first slice
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${percentage}%`;
          }
          return '';
        }
      }
    }
  };

  // Calculate percentages for displaying in the stats
  const calculatePercentage = (value, total) => {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Campaign header */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Campaign: {stats.campaign?.name || 'Unknown Campaign'}
        </h2>
        <p className="text-gray-600">
          {stats.totalSent} emails sent • {stats.totalOpened} opened • {stats.totalClicks} link clicks
        </p>
      </div>

      {/* Main metrics charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart for overall metrics */}
        <div className="bg-white rounded-lg shadow p-4 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-2">Email Engagement Metrics</h3>
          <div className="h-80">
            <Bar data={barChartData} options={barOptions} />
          </div>
        </div>

        {/* Key metrics summary */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Open Rate</p>
                <p className="text-2xl font-bold">{calculatePercentage(stats.totalOpened, stats.totalSent)}</p>
              </div>
              <div className="w-16 h-16">
                <Doughnut 
                  data={createDoughnutData(stats.totalOpened, stats.totalSent, 'Emails Opened')} 
                  options={doughnutOptions} 
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Click Rate</p>
                <p className="text-2xl font-bold">{calculatePercentage(stats.totalClicks, stats.totalSent)}</p>
              </div>
              <div className="w-16 h-16">
                <Doughnut 
                  data={createDoughnutData(stats.totalClicks, stats.totalSent, 'Links Clicked')} 
                  options={doughnutOptions} 
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Unique Opens</p>
                <p className="text-2xl font-bold">{calculatePercentage(stats.uniqueOpens, stats.totalSent)}</p>
              </div>
              <div className="w-16 h-16">
                <Doughnut 
                  data={createDoughnutData(stats.uniqueOpens, stats.totalSent, 'Unique Opens')} 
                  options={doughnutOptions} 
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Unique Clicks</p>
                <p className="text-2xl font-bold">{calculatePercentage(stats.uniqueClicks, stats.totalSent)}</p>
              </div>
              <div className="w-16 h-16">
                <Doughnut 
                  data={createDoughnutData(stats.uniqueClicks, stats.totalSent, 'Unique Clicks')} 
                  options={doughnutOptions} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline and details */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Email Activity Timeline</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opened At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.sentEmails.slice(0, 10).map((email, index) => {
                // Find if this email has been opened
                const openInfo = stats.openedEmails.find(o => o.email === email.email);
                
                return (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {email.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(email.sentAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {openInfo ? new Date(openInfo.openedAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {openInfo ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Opened
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Sent
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {stats.sentEmails.length > 10 && (
            <div className="mt-4 text-center text-sm text-gray-600">
              Showing 10 of {stats.sentEmails.length} emails
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignStatistics;
