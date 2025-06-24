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
import { Bar, Doughnut, Line } from "react-chartjs-2";
import httpClient from "../services/httpClient";
import { fetchCampaigns } from "../services/apiService";
import CampaignStatistics from "../components/Charts/CampaignStatistics";
import FormDataList from "../components/FormSubmissions/FormDataList";
import LoginAttemptsList from "../components/LoginAttempts/LoginAttemptsList";
import RecentCampaigns from "./Campaigns/RecentCampaigns";
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
    <div className="p-6">
      {/* Title and Campaign Selector */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-800">Dashboard</h1>
        
        <div className="flex items-center space-x-4">
          {/* Auto-refresh toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              Auto-refresh: 
              <span className="text-xs ml-1">
                (Last updated: {formatLastUpdated()})
              </span>
            </span>
            <button
              onClick={toggleAutoRefresh}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                autoRefresh ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <button
              onClick={() => {
                loadCampaigns();
                if (selectedCampaign) {
                  fetchCampaignStats(selectedCampaign.id);
                }
                setLastUpdated(new Date());
              }}
              className="ml-2 p-1 rounded-full bg-gray-100 hover:bg-gray-200"
              title="Refresh now"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          
          <label htmlFor="campaignSelect" className="mr-2 font-medium text-gray-700">
            Select Campaign:
          </label>
          <select
            id="campaignSelect"
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={handleCampaignChange}
            value={selectedCampaign?.id || ""}
            disabled={loading}
          >
            <option value="">Select a campaign</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name} - In Progress
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 gap-6">
        {selectedCampaign ? (
          <>
            {campaignStats ? (
              <>
                <CampaignStatistics stats={campaignStats} />

                <CookiesListener />
                
                {/* Login Attempts Section */}
                <LoginAttemptsList campaignId={selectedCampaign.id} />
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-6 flex justify-center items-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading campaign statistics...</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-xl text-center text-gray-500">
              {loading
                ? "Loading campaigns..."
                : campaigns.length === 0
                ? "No active campaigns found. Please launch a campaign to see statistics."
                : "Please select a campaign to view statistics."}
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
