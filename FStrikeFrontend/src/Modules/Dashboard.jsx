import React, { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js";
import httpClient from "../services/httpClient";
import { fetchCampaigns } from "../services/apiService";
import CampaignStatistics from "../components/Charts/CampaignStatistics";
import LoginAttemptsList from "../components/LoginAttempts/LoginAttemptsList";
import CookiesListener from "../components/CookieListener";

// Register Chart.js components and plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

// Subtle Matrix Background Component
const MatrixBackground = () => {
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.className = 'matrix-bg';
    document.body.appendChild(canvas);
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const chars = '01';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = new Array(columns).fill(0);
    
    const draw = () => {
      ctx.fillStyle = 'rgba(10, 15, 20, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = 'rgba(0, 212, 170, 0.1)';
      ctx.font = `${fontSize}px monospace`;
      
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        
        ctx.fillText(char, x, y);
        
        if (y > canvas.height && Math.random() > 0.99) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };
    
    const interval = setInterval(draw, 100);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
      }
    };
  }, []);
  
  return null;
};

const Dashboard = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campaignStats, setCampaignStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshTimerRef = useRef(null);
  const REFRESH_INTERVAL = 30000; // 30 seconds

  // Fetch all campaigns on component mount and set up auto-refresh
  useEffect(() => {
    loadCampaigns();
    
    // Set up auto-refresh timer
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        loadCampaigns();
        if (selectedCampaign) {
          fetchCampaignStats(selectedCampaign.id);
        }
        setLastUpdated(new Date());
      }, REFRESH_INTERVAL);
    }
    
    // Clean up timer on component unmount
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh]); // Re-run when autoRefresh changes

  // Separate useEffect to handle selectedCampaign changes
  useEffect(() => {
    if (selectedCampaign) {
      fetchCampaignStats(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  // Function to load campaigns
  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const campaignsData = await fetchCampaigns();
      // Filter to only show In Progress campaigns
      const inProgressCampaigns = campaignsData.filter(
        (campaign) => campaign.status === "In Progress"
      );
      setCampaigns(inProgressCampaigns);
      
      // Select the first campaign by default if available and no campaign is selected yet
      if (inProgressCampaigns.length > 0 && !selectedCampaign) {
        setSelectedCampaign(inProgressCampaigns[0]);
      }
      
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics for the selected campaign
  const fetchCampaignStats = async (campaignId) => {
    try {
      const response = await httpClient.get(`/GetCampaignLogs/${campaignId}`);
      
      // Process campaign statistics 
      const statsData = response.data;
      
      // Use the stats object that we're now returning from the backend
      if (statsData.stats) {
        setCampaignStats({
          totalSent: statsData.stats.totalSent,
          totalOpened: statsData.stats.totalOpened,
          uniqueOpens: statsData.stats.uniqueOpens,
          totalClicks: statsData.stats.totalClicks,
          uniqueClicks: statsData.stats.uniqueClicks,
          sentEmails: statsData.sent,
          openedEmails: statsData.opened,
          clickData: statsData.clicks,
          campaign: statsData.campaign
        });
      } else {
        // Fallback to the old format for backward compatibility
        const totalSent = statsData.sent.length;
        const totalOpened = statsData.opened.length;
        
        // Count unique email opens
        const uniqueOpens = new Set(statsData.opened.map(item => item.email)).size;
        
        // Calculate link clicks - use empty array if clicks not available
        const clickData = statsData.clicks || [];
        const totalClicks = clickData.length;
        const uniqueClicks = new Set(clickData.map(item => item.ip)).size;

        setCampaignStats({
          totalSent,
          totalOpened,
          uniqueOpens,
          totalClicks,
          uniqueClicks,
          sentEmails: statsData.sent,
          openedEmails: statsData.opened,
          clickData,
          campaign: statsData.campaign,
        });
      }

    } catch (error) {
      console.error("Error fetching campaign statistics:", error);
      setCampaignStats(null);
    }
  };

  // Handle campaign selection change
  const handleCampaignChange = async (e) => {
    const campaignId = e.target.value;
    if (campaignId === "") {
      setSelectedCampaign(null);
      setCampaignStats(null);
      return;
    }
    
    const campaign = campaigns.find(c => c.id.toString() === campaignId);
    setSelectedCampaign(campaign);
    await fetchCampaignStats(campaignId);
  };

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    const newState = !autoRefresh;
    setAutoRefresh(newState);
    
    // Clear existing interval if turning off
    if (!newState && refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  // Format the last updated time
  const formatLastUpdated = () => {
    return lastUpdated.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen">
      <MatrixBackground />
      
      <div className="relative z-10 p-8">
        {/* Professional Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-8">
            {/* Title Section */}
            <div className="space-y-2">
              <div className="flex items-center space-x-4">
                <h1 className="text-4xl font-bold text-cyber-primary tracking-tight">
                  F-Strike Operations Analysis
                </h1>
              </div>
              <p className="text-cyber-muted">
                Advanced Phishing Campaign Management • Real-time Analytics
              </p>
            </div>
            
            {/* Control Panel */}
            <div className="flex items-center space-x-4">
              {/* System Status */}
              <div className="glass-card px-4 py-2">
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full status-indicator"></div>
                  <span className="text-cyber-muted">System Operational</span>
                  <span className="text-xs text-cyber-primary ml-2">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
              
              {/* Auto-refresh Toggle */}
              <div className="glass-card px-4 py-3">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-cyber-muted">Auto-scan</span>
                  <div 
                    className={`toggle-switch ${autoRefresh ? 'active' : ''}`}
                    onClick={toggleAutoRefresh}
                  >
                    <div className="toggle-slider"></div>
                  </div>
                  <button
                    onClick={() => {
                      loadCampaigns();
                      if (selectedCampaign) {
                        fetchCampaignStats(selectedCampaign.id);
                      }
                      setLastUpdated(new Date());
                    }}
                    className="glass-button p-2 rounded-lg"
                    title="Manual Refresh"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <div className="text-xs text-cyber-muted mt-1">
                  Last updated: {formatLastUpdated()}
                </div>
              </div>
              
              {/* Campaign Selector */}
              <div className="glass-card px-4 py-3 min-w-80">
                <label className="block text-sm text-cyber-muted mb-2">
                  Target Campaign
                </label>
                <select
                  className="glass-select w-full px-3 py-2 rounded-lg text-sm"
                  onChange={handleCampaignChange}
                  value={selectedCampaign?.id || ""}
                  disabled={loading}
                >
                  <option value="">Select Campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {selectedCampaign ? (
            <>
              {campaignStats ? (
                <>
                  {/* Campaign Analytics */}
                  <div className="glass-card p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-semibold text-cyber-primary mb-2">
                          {selectedCampaign.name}
                        </h2>
                        <p className="text-cyber-muted">Campaign Analytics & Metrics</p>
                      </div>
                      <div className="badge badge-success">
                        Active
                      </div>
                    </div>
                    <div className="chart-container">
                      <CampaignStatistics stats={campaignStats} />
                    </div>
                  </div>

                  {/* Credential Harvesting */}
                  <div className="glass-card p-8">
                    <div className="flex items-center space-x-3 mb-6">
                      <svg className="w-6 h-6 text-cyber-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <h3 className="text-xl font-semibold text-cyber-primary">
                        Credential Harvesting
                      </h3>
                    </div>
                    <CookiesListener campaignId={selectedCampaign.id} />
                  </div>
                  
                  {/* Security Events */}
                  <div className="glass-card p-8">
                    <div className="flex items-center space-x-3 mb-6">
                      <svg className="w-6 h-6 text-cyber-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <h3 className="text-xl font-semibold text-cyber-primary">
                        Authentication Events
                      </h3>
                    </div>
                    <LoginAttemptsList campaignId={selectedCampaign.id} />
                  </div>
                </>
              ) : (
                <div className="glass-card p-16 text-center">
                  <div className="loading-spinner mx-auto mb-6"></div>
                  <h3 className="text-xl text-cyber-primary mb-2">
                    Analyzing Campaign Data
                  </h3>
                  <p className="text-cyber-muted">
                    Processing campaign metrics and security events...
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card p-16 text-center">
              {loading ? (
                <>
                  <div className="loading-spinner mx-auto mb-6"></div>
                  <h3 className="text-xl text-cyber-primary mb-2">
                    Scanning Active Campaigns
                  </h3>
                  <p className="text-cyber-muted">
                    Initializing security framework...
                  </p>
                </>
              ) : campaigns.length === 0 ? (
                <>
                  <svg className="w-16 h-16 text-cyber-accent mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="text-xl text-cyber-accent mb-2">
                    No Active Operations
                  </h3>
                  <p className="text-cyber-muted">
                    Deploy a phishing campaign to begin monitoring security events
                  </p>
                </>
              ) : (
                <>
                  <svg className="w-16 h-16 text-cyber-secondary mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="text-xl text-cyber-primary mb-2">
                    Select Target Campaign
                  </h3>
                  <p className="text-cyber-muted">
                    Choose a campaign from the dropdown to view detailed analytics
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
