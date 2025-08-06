import React, { useState, useEffect } from "react";
import { FaPlus, FaClone, FaTrash, FaChartBar, FaRocket, FaCheck, FaEye, FaUsers, FaEnvelope } from "react-icons/fa";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import DeleteConfirmation from "../../Modals/DeleteConfirmationModal";
import NewCampaignModal from "../../Modals/NewCampaignModal";
import InfoBar from "../../components/InfoBar";
import { Modal, Button, message } from "antd";
import { fetchCampaigns, deleteCampaign, launchCampaign, closeCampaign } from "../../services/apiService";
import socketService from "../../services/socketService";

const Campaigns = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [launchingCampaign, setLaunchingCampaign] = useState(false);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchResults, setLaunchResults] = useState(null);
  const [recentOpenEvent, setRecentOpenEvent] = useState(null);

  useEffect(() => {
    loadCampaigns();
    
    // Set up real-time tracking for email opens
    const removeListener = socketService.addEventListener('email:opened', handleEmailOpened);
    
    // Clean up listener on unmount
    return () => {
      removeListener();
    };
  }, []);
  
  // Handle email open events from socket
  const handleEmailOpened = (data) => {
    console.log('🔔 Email opened event received in Campaign component:', data);
    
    // Show notification
    message.success({
      content: `Email opened by ${data.userEmail}`,
      key: `email-open-${Date.now()}`,
      duration: 5
    });
    
    // Update the recent open event
    setRecentOpenEvent(data);
    
    // Update the campaign count
    setCampaigns(currentCampaigns => {
      console.log('Updating campaign opens count for campaign:', data.campaignId);
      const updatedCampaigns = currentCampaigns.map(campaign => {
        if (campaign.id === data.campaignId) {
          console.log(`Updating opens for campaign ${campaign.id} from ${campaign.opens || 0} to ${(campaign.opens || 0) + 1}`);
          return { 
            ...campaign, 
            opens: (campaign.opens || 0) + 1 
          };
        }
        return campaign;
      });
      return updatedCampaigns;
    });
  };

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const campaignsData = await fetchCampaigns();
      setCampaigns(campaignsData || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
      setError("Failed to load campaigns. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (campaign) => {
    setSelectedCampaign(campaign);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCampaign(null);
  };

  const handleDelete = async () => {
    if (!selectedCampaign) return;
    try {
      await deleteCampaign(selectedCampaign.id);
      loadCampaigns();
      closeModal();
    } catch (err) {
      console.error("Error deleting campaign:", err);
      setError("Failed to delete campaign. Please try again.");
    }
  };

  const handleLaunchCampaign = (campaign) => {
    setSelectedCampaign(campaign);
    setShowLaunchModal(true);
  };

  const confirmLaunchCampaign = async () => {
    if (!selectedCampaign) return;
    try {
      setLaunchingCampaign(true);
      const response = await launchCampaign(selectedCampaign.id);
      setLaunchResults(response);
      message.success("Campaign launched successfully!");
      loadCampaigns();
    } catch (err) {
      console.error("Error launching campaign:", err);
      message.error(err.response?.data?.error || "Failed to launch campaign");
      setLaunchResults({
        error: true,
        message: err.response?.data?.error || "Failed to launch campaign",
        details: err.response?.data?.details || err.message,
      });
    } finally {
      setLaunchingCampaign(false);
    }
  };

  const closeLaunchModal = () => {
    setShowLaunchModal(false);
    setSelectedCampaign(null);
    setLaunchResults(null);
  };

  const handleCloseCampaign = async (campaign) => {
    try {
      await closeCampaign(campaign.id);
      message.success("Campaign archived successfully!");
      loadCampaigns();
    } catch (err) {
      console.error("Error archiving campaign:", err);
      message.error(err.response?.data?.error || "Failed to archive campaign");
    }
  };

  // Real-time tracking notification with cyber styling
  const renderTrackingNotification = () => {
    if (!recentOpenEvent) return null;
    
    return (
      <div className="mb-6 glass-card p-6 border-l-4 border-green-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-3 h-3 bg-green-400 rounded-full status-indicator"></div>
            <div>
              <h3 className="font-bold text-cyber-primary">Real-time Security Event</h3>
              <p className="text-cyber-muted">
                Email opened by <span className="font-semibold text-cyber-secondary">{recentOpenEvent.userEmail}</span>
              </p>
              <p className="text-sm text-cyber-muted">Campaign: {recentOpenEvent.campaignName}</p>
              <p className="text-xs text-cyber-muted">
                {new Date(recentOpenEvent.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setRecentOpenEvent(null)}
            className="glass-button p-2 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // Active: Draft + In Progress; Archived: Sent + Failed
  const activeCampaigns = campaigns.filter(
    (c) => c.status === "Draft" || c.status === "In Progress"
  );
  const archivedCampaigns = campaigns.filter(
    (c) => c.status === "Sent" || c.status === "Failed"
  );

  const renderTable = (filteredCampaigns) => (
    <div className="glass-card p-6 mt-6">
      {/* Table Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <label className="text-cyber-muted">Show</label>
          <select className="glass-select px-3 py-2 rounded-lg w-20">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span className="text-cyber-muted">entries</span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-cyber-muted">Search:</label>
          <input
            type="text"
            className="glass-select px-3 py-2 rounded-lg w-64"
            placeholder="Filter campaigns..."
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-cyber-muted">Loading campaign data...</p>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-cyber-accent mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-cyber-accent">{error}</p>
        </div>
      ) : (
        <div className="data-table rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Campaign Name</th>
                <th className="text-left">Template</th>
                <th className="text-left">Landing Page</th>
                <th className="text-left">Profile</th>
                <th className="text-left">Target Group</th>
                <th className="text-left">Launch Date</th>
                <th className="text-left">Status</th>
                <th className="text-left">Opens</th>
                <th className="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.length > 0 ? (
                filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <div className="flex items-center space-x-2">
                        <FaEnvelope className="text-cyber-secondary" />
                        <span className="font-semibold text-cyber-primary">{campaign.name}</span>
                      </div>
                    </td>
                    <td className="text-cyber-muted">{campaign.templateName}</td>
                    <td className="text-cyber-muted">{campaign.landingPageName}</td>
                    <td className="text-cyber-muted">{campaign.profileName}</td>
                    <td>
                      <div className="flex items-center space-x-1">
                        <FaUsers className="text-cyber-secondary text-sm" />
                        <span className="text-cyber-muted">{campaign.groupName}</span>
                      </div>
                    </td>
                    <td className="text-cyber-muted font-mono text-sm">{campaign.launchDate}</td>
                    <td>
                      <div
                        className={`badge ${
                          campaign.status === "Draft"
                            ? "badge-warning"
                            : campaign.status === "In Progress"
                            ? "badge-success"
                            : campaign.status === "Sent"
                            ? "bg-gray-500 text-white border-gray-500"
                            : campaign.status === "Failed"
                            ? "badge-danger"
                            : "bg-gray-500 text-white border-gray-500"
                        }`}
                      >
                        {campaign.status}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <FaEye className="text-cyber-secondary" />
                        <span className="font-bold text-cyber-primary">{campaign.opens || 0}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          className="glass-button p-2 rounded-lg text-cyber-secondary hover:text-cyber-primary"
                          title="View Analytics"
                        >
                          <FaChartBar />
                        </button>
                        <button 
                          className="glass-button p-2 rounded-lg text-cyber-secondary hover:text-cyber-primary"
                          title="Clone Campaign"
                        >
                          <FaClone />
                        </button>
                        {campaign.status === "Draft" && (
                          <button
                            className="glass-button p-2 rounded-lg text-yellow-400 hover:text-yellow-300"
                            onClick={() => handleLaunchCampaign(campaign)}
                            title="Launch Campaign"
                          >
                            <FaRocket />
                          </button>
                        )}
                        {campaign.status === "In Progress" && (
                          <button
                            className="glass-button p-2 rounded-lg text-green-400 hover:text-green-300"
                            onClick={() => handleCloseCampaign(campaign)}
                            title="Archive Campaign"
                          >
                            <FaCheck />
                          </button>
                        )}
                        <button
                          className="glass-button p-2 rounded-lg text-cyber-accent hover:text-red-400"
                          onClick={() => openModal(campaign)}
                          title="Delete Campaign"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center py-16">
                    <svg className="w-16 h-16 text-cyber-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-cyber-muted text-lg">No campaigns found</p>
                    <p className="text-cyber-muted text-sm mt-2">Create your first phishing campaign to get started</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {filteredCampaigns.length > 0 && (
        <div className="flex justify-between items-center mt-6 pt-6 ">
          <span className="text-cyber-muted text-sm">
            Showing 1 to {filteredCampaigns.length} of {filteredCampaigns.length} entries
          </span>
          <div className="flex items-center space-x-2">
            <button className="glass-button px-3 py-1 text-sm rounded">
              Previous
            </button>
            <button className="bg-cyber-primary text-black px-3 py-1 text-sm rounded font-medium">
              1
            </button>
            <button className="glass-button px-3 py-1 text-sm rounded">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <h1 className="text-4xl font-bold text-cyber-primary tracking-tight">
            Campaign Operations
          </h1>
        </div>
        <p className="text-cyber-muted">
          Manage and monitor phishing campaigns • Real-time tracking enabled
        </p>
        <div className="w-full h-px bg-gradient-to-r from-cyber-primary via-cyber-secondary to-transparent mt-4"></div>
      </div>

      {renderTrackingNotification()}

      {/* New Campaign Button */}
      <button
        onClick={() => setShowNewCampaignModal(true)}
        className="glass-button px-6 py-3 rounded-lg flex items-center space-x-2 mb-6 hover:scale-105 transition-transform"
      >
        <FaPlus />
        <span className="font-medium">New Campaign</span>
      </button>

      {/* Tabs with Custom Styling */}
      <div className="glass-card p-6">
        <Tabs>
          <TabList className="flex space-x-1 mb-6 bg-transparent ">
            <Tab className="px-6 py-3 text-cyber-muted hover:text-cyber-primary cursor-pointer transition-colors border-b-2 border-transparent data-[selected]:border-cyber-primary data-[selected]:text-cyber-primary">
              <div className="flex items-center space-x-2">
                <FaRocket />
                <span>Active Operations</span>
                <div className="badge badge-success ml-2">{activeCampaigns.length}</div>
              </div>
            </Tab>
            <Tab className="px-6 py-3 text-cyber-muted hover:text-cyber-primary cursor-pointer transition-colors border-b-2 border-transparent data-[selected]:border-cyber-primary data-[selected]:text-cyber-primary">
              <div className="flex items-center space-x-2">
                <FaCheck />
                <span>Archived Operations</span>
                <div className="badge bg-gray-500 text-white border-gray-500 ml-2">{archivedCampaigns.length}</div>
              </div>
            </Tab>
          </TabList>

          <TabPanel>{renderTable(activeCampaigns)}</TabPanel>
          <TabPanel>{renderTable(archivedCampaigns)}</TabPanel>
        </Tabs>
      </div>

      {/* Modals with updated styling */}
      <DeleteConfirmation
        isOpen={isModalOpen}
        onClose={closeModal}
        onConfirm={handleDelete}
        name={selectedCampaign?.name || ""}
        text="campaign"
      />

      <NewCampaignModal
        isOpen={showNewCampaignModal}
        onClose={() => setShowNewCampaignModal(false)}
        onSave={loadCampaigns}
      />

      {/* Launch Campaign Modal */}
      <Modal
        title={<span className="text-cyber-primary">Launch Campaign</span>}
        open={showLaunchModal}
        onCancel={closeLaunchModal}
        className="cyber-modal"
        footer={[
          <Button key="cancel" onClick={closeLaunchModal} className="glass-button">
            Close
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={launchingCampaign}
            onClick={confirmLaunchCampaign}
            disabled={launchingCampaign || launchResults !== null}
            className="bg-cyber-primary text-black border-cyber-primary hover:bg-cyber-secondary"
          >
            Launch Now
          </Button>,
        ]}
      >
        <div className="py-4">
          {launchingCampaign ? (
            <div className="text-center">
              <div className="loading-spinner mx-auto mb-4"></div>
              <p className="text-cyber-primary">Launching campaign, please wait...</p>
            </div>
          ) : launchResults ? (
            <div>
              {launchResults.error ? (
                <div className="glass-card p-4 border-l-4 border-red-400">
                  <p className="text-cyber-accent font-semibold">
                    <strong>Error:</strong> {launchResults.message}
                  </p>
                  {launchResults.details && (
                    <p className="text-sm text-cyber-muted mt-2">Details: {launchResults.details}</p>
                  )}
                </div>
              ) : (
                <div className="glass-card p-4 border-l-4 border-green-400">
                  <p className="text-green-400 font-semibold mb-3">
                    Campaign launched successfully!
                  </p>
                  <div className="space-y-2 text-cyber-muted">
                    <p>Total emails: <span className="text-cyber-primary font-mono">{launchResults.totalEmails}</span></p>
                    <p>Successfully sent: <span className="text-green-400 font-mono">{launchResults.successCount}</span></p>
                    {launchResults.errorCount > 0 && (
                      <div className="mt-3">
                        <p className="text-cyber-accent">
                          Failed to send: <span className="font-mono">{launchResults.errorCount}</span>
                        </p>
                        {launchResults.errors?.length > 0 && (
                          <ul className="text-sm mt-2 text-cyber-accent">
                            {launchResults.errors.slice(0, 5).map((err, idx) => (
                              <li key={idx} className="font-mono">
                                {err.user}: {err.error}
                              </li>
                            ))}
                            {launchResults.errors.length > 5 && (
                              <li className="text-cyber-muted">
                                ...and {launchResults.errors.length - 5} more
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-4">
              <p className="text-cyber-primary mb-3">
                You are about to launch the campaign:{" "}
                <strong className="text-cyber-secondary">{selectedCampaign?.name}</strong>
              </p>
              <p className="text-cyber-muted mb-3">
                This will send emails to all users in the group{" "}
                <strong className="text-cyber-primary">{selectedCampaign?.groupName}</strong>.
              </p>
              <p className="text-cyber-accent">Are you sure you want to proceed?</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Campaigns;
