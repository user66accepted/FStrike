import React, { useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';

const CampaignStatistics = ({ stats }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // If no stats available yet, show loading or empty state
  if (!stats) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-lg text-cyber-muted">No statistics available</p>
      </div>
    );
  }

  // Professional color scheme for charts
  const colors = {
    primary: '#00d4aa',
    secondary: '#00a8ff',
    accent: '#ff3838',
    warning: '#ffa726',
    success: '#4caf50',
    muted: '#8ea5b0',
    purple: '#9c27b0',
    indigo: '#3f51b5'
  };

  // Data for email metrics bar chart with cyber theme
  const barChartData = {
    labels: ['Emails Sent', 'Emails Opened', 'Links Clicked', 'Unique Clicks', 'Spam Opens'],
    datasets: [
      {
        label: 'Count',
        data: [
          stats.totalSent,
          stats.totalOpened,
          stats.totalClicks,
          stats.uniqueClicks,
          stats.spamOpens
        ],
        backgroundColor: [
          colors.primary,
          colors.success,
          colors.warning,
          colors.secondary,
          colors.accent
        ],
        borderColor: [
          colors.primary,
          colors.success,
          colors.warning,
          colors.secondary,
          colors.accent
        ],
        borderWidth: 1
      }
    ]
  };

  // Calculate legitimate opens
  const legitimateOpens = stats.totalOpened - stats.spamOpens;

  // Data for email quality doughnut chart
  const emailQualityData = {
    labels: ['Legitimate Opens', 'Spam Opens'],
    datasets: [{
      data: [legitimateOpens, stats.spamOpens],
      backgroundColor: [colors.success, colors.accent],
      borderColor: [colors.success, colors.accent],
      borderWidth: 2
    }]
  };

  // Professional chart options
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(10, 15, 20, 0.9)',
        titleColor: colors.primary,
        bodyColor: '#e8f4f8',
        borderColor: colors.primary,
        borderWidth: 1,
        callbacks: {
          label: (context) => `Count: ${context.raw}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 212, 170, 0.1)'
        },
        ticks: {
          color: colors.muted
        },
        title: {
          display: true,
          text: 'Count',
          color: colors.primary
        }
      },
      x: {
        grid: {
          color: 'rgba(0, 212, 170, 0.1)'
        },
        ticks: {
          color: colors.muted
        }
      }
    }
  };

  // Professional doughnut options
  const doughnutOptions = {
    cutout: '70%',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: colors.muted,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: 'rgba(10, 15, 20, 0.9)',
        titleColor: colors.primary,
        bodyColor: '#e8f4f8',
        borderColor: colors.primary,
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const label = context.label;
            const value = context.raw;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  // Calculate percentages for displaying in the stats
  const calculatePercentage = (value, total) => {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  // Pagination calculations
  const totalPages = Math.ceil((stats?.sentEmails?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEmails = stats?.sentEmails?.slice(startIndex, endIndex) || [];

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div className="space-y-8">
      {/* Campaign Summary Header */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-cyber-primary">
            {stats.campaign?.name || 'Campaign Analytics'}
          </h2>
          <div className="badge badge-success">Active</div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-cyber-primary mb-1">{stats.totalSent}</div>
            <div className="text-sm text-cyber-muted">Emails Sent</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-cyber-secondary mb-1">{stats.totalOpened}</div>
            <div className="text-sm text-cyber-muted">Emails Opened</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-cyber-accent mb-1">{stats.totalClicks}</div>
            <div className="text-sm text-cyber-muted">Link Clicks</div>
          </div>
        </div>
      </div>

      {/* Main metrics charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bar chart for overall metrics */}
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="text-xl font-semibold text-cyber-primary mb-4">Engagement Metrics</h3>
          <div className="h-80">
            <Bar data={barChartData} options={barOptions} />
          </div>
        </div>

        {/* Email Quality Analysis */}
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold text-cyber-primary mb-6">Quality Analysis</h3>
          <div className="space-y-6">
            <div className="h-48">
              <Doughnut 
                data={emailQualityData} 
                options={doughnutOptions} 
              />
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="glass-card p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-cyber-muted">Legitimate Opens</span>
                  <span className="text-xl font-bold text-cyber-primary">
                    {stats.legitimateOpenPercentage || calculatePercentage(legitimateOpens, stats.totalOpened)}%
                  </span>
                </div>
              </div>
              <div className="glass-card p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-cyber-muted">Spam Detection</span>
                  <span className="text-xl font-bold text-cyber-accent">
                    {stats.spamOpenPercentage || calculatePercentage(stats.spamOpens, stats.totalOpened)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-cyber-primary mb-6">Activity Timeline</h3>
        <div className="data-table rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Email Address</th>
                <th className="text-left">Sent At</th>
                <th className="text-left">Opened At</th>
                <th className="text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentEmails.map((email, index) => {
                const openInfo = stats.openedEmails.find(o => o.email === email.email);
                
                return (
                  <tr key={startIndex + index}>
                    <td className="font-mono text-sm">{email.email}</td>
                    <td className="text-sm">
                      {new Date(email.sentAt).toLocaleString()}
                    </td>
                    <td className="text-sm">
                      {openInfo ? new Date(openInfo.openedAt).toLocaleString() : '-'}
                    </td>
                    <td>
                      {openInfo ? (
                        openInfo.isSpam ? (
                          <div className="badge badge-danger">Spam Open</div>
                        ) : (
                          <div className="badge badge-success">Legitimate</div>
                        )
                      ) : (
                        <div className="badge badge-warning">Sent</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Professional Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-cyber-primary/20">
              <div className="text-sm text-cyber-muted">
                Showing {startIndex + 1} to {Math.min(endIndex, stats?.sentEmails?.length || 0)} of {stats?.sentEmails?.length || 0} results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="glass-button px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 text-sm rounded ${
                        currentPage === pageNum 
                          ? 'bg-cyber-primary text-black' 
                          : 'glass-button'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="glass-button px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignStatistics;
