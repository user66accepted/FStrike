import React, { useState, useEffect } from "react";
import { FaPlus, FaClone, FaTrash, FaChartBar, FaRocket, FaCheck } from "react-icons/fa";
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

  // Real-time tracking notification
  const renderTrackingNotification = () => {
    if (!recentOpenEvent) return null;
    
    return (
      <div className="mb-4 p-4 bg-green-100 border border-green-400 rounded-md flex items-center">
        <div className="flex-1">
          <h3 className="font-bold">Real-time Tracking Update</h3>
          <p>Email opened by <span className="font-semibold">{recentOpenEvent.userEmail}</span></p>
          <p className="text-sm">Campaign: {recentOpenEvent.campaignName}</p>
          <p className="text-xs text-gray-500">
            {new Date(recentOpenEvent.timestamp).toLocaleString()}
          </p>
        </div>
        <button 
          onClick={() => setRecentOpenEvent(null)}
          className="text-gray-500 hover:text-gray-700"
        >
          Dismiss
        </button>
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
    <>
      <div className="mt-4 flex items-center">
        <label className="text-gray-700 mr-2">Show</label>
        <input
          type="number"
          className="border border-gray-300 rounded-lg px-2 py-1 w-16"
          defaultValue={10}
        />
        <span className="ml-2">entries</span>
        <div className="ml-auto flex items-center">
          <label className="text-gray-700 mr-2">Search:</label>
          <input
            type="text"
            className="border border-gray-300 rounded-lg px-2 py-1"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Loading campaigns...</div>
      ) : error ? (
        <div className="text-center py-10 text-red-500">{error}</div>
      ) : (
        <table className="w-full mt-4">
          <thead>
            <tr className="border-b-2 border-gray-300 text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Template</th>
              <th className="p-2">Landing Page</th>
              <th className="p-2">Profile</th>
              <th className="p-2">Group</th>
              <th className="p-2">Launch Date</th>
              <th className="p-2">Status</th>
              <th className="p-2">Opens</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCampaigns.length > 0 ? (
              filteredCampaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="p-2">{campaign.name}</td>
                  <td className="p-2">{campaign.templateName}</td>
                  <td className="p-2">{campaign.landingPageName}</td>
                  <td className="p-2">{campaign.profileName}</td>
                  <td className="p-2">{campaign.groupName}</td>
                  <td className="p-2">{campaign.launchDate}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-1 text-sm rounded ${
                        campaign.status === "Draft"
                          ? "bg-blue-500 text-white"
                          : campaign.status === "In Progress"
                          ? "bg-yellow-500 text-white"
                          : campaign.status === "Sent"
                          ? "bg-gray-400 text-white"
                          : campaign.status === "Failed"
                          ? "bg-red-500 text-white"
                          : "bg-gray-400 text-white"
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </td>
                  <td className="p-2">{campaign.opens}</td>
                  <td className="p-2 flex gap-2">
                    <button className="bg-green-500 text-white p-2 rounded hover:bg-green-600">
                      <FaChartBar />
                    </button>
                    <button className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
                      <FaClone />
                    </button>
                    {campaign.status === "Draft" && (
                      <button
                        className="bg-yellow-500 text-white p-2 rounded hover:bg-yellow-600"
                        onClick={() => handleLaunchCampaign(campaign)}
                        title="Launch Campaign"
                      >
                        <FaRocket />
                      </button>
                    )}
                    {campaign.status === "In Progress" && (
                      <button
                        className="bg-gray-400 text-white p-2 rounded hover:bg-gray-500"
                        onClick={() => handleCloseCampaign(campaign)}
                        title="Archive Campaign"
                      >
                        <FaCheck />
                      </button>
                    )}
                    <button
                      className="bg-red-500 text-white p-2 rounded hover:bg-red-600"
                      onClick={() => openModal(campaign)}
                      title="Delete Campaign"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="p-4 text-center text-gray-600">
                  <InfoBar text="Campaigns" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div className="mt-4 flex justify-between items-center">
        <span className="text-gray-600">
          {filteredCampaigns.length > 0
            ? `Showing 1 to ${filteredCampaigns.length} of ${filteredCampaigns.length} entries`
            : "Showing 0 to 0 of 0 entries"}
        </span>
        <div className="flex items-center gap-2">
          <button className="border px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">
            Previous
          </button>
          <button className="border px-3 py-1 rounded bg-blue-500 text-white">
            1
          </button>
          <button className="border px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">
            Next
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="p-6">
      <h1 className="text-6xl font-bold text-slate-800">Campaigns</h1>
      <hr className="my-4 bg-gray-300" />

      {renderTrackingNotification()}

      <button
        onClick={() => setShowNewCampaignModal(true)}
        className="bg-teal-500 mt-8 mb-4 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-teal-400"
      >
        <FaPlus /> New Campaign
      </button>

      <Tabs>
        <TabList>
          <Tab>Active Campaigns</Tab>
          <Tab>Archived Campaigns</Tab>
        </TabList>

        <TabPanel>{renderTable(activeCampaigns)}</TabPanel>
        <TabPanel>{renderTable(archivedCampaigns)}</TabPanel>
      </Tabs>

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

      <Modal
        title="Launch Campaign"
        open={showLaunchModal}
        onCancel={closeLaunchModal}
        footer={[
          <Button key="cancel" onClick={closeLaunchModal}>
            Close
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={launchingCampaign}
            onClick={confirmLaunchCampaign}
            disabled={launchingCampaign || launchResults !== null}
          >
            Launch Now
          </Button>,
        ]}
      >
        {launchingCampaign ? (
          <div className="text-center py-4">
            <p>Launching campaign, please wait...</p>
          </div>
        ) : launchResults ? (
          <div className="py-2">
            {launchResults.error ? (
              <div className="text-red-500">
                <p>
                  <strong>Error:</strong> {launchResults.message}
                </p>
                {launchResults.details && (
                  <p className="text-sm mt-2">Details: {launchResults.details}</p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-green-600 font-semibold">
                  Campaign launched successfully!
                </p>
                <div className="mt-2">
                  <p>Total emails: {launchResults.totalEmails}</p>
                  <p>Successfully sent: {launchResults.successCount}</p>
                  {launchResults.errorCount > 0 && (
                    <div className="mt-2">
                      <p className="text-red-500">
                        Failed to send: {launchResults.errorCount}
                      </p>
                      {launchResults.errors?.length > 0 && (
                        <ul className="text-sm mt-1 text-red-500">
                          {launchResults.errors.slice(0, 5).map((err, idx) => (
                            <li key={idx}>
                              {err.user}: {err.error}
                            </li>
                          ))}
                          {launchResults.errors.length > 5 && (
                            <li>
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
          <div className="py-2">
            <p>
              You are about to launch the campaign:{" "}
              <strong>{selectedCampaign?.name}</strong>
            </p>
            <p className="mt-2">
              This will send emails to all users in the group{" "}
              <strong>{selectedCampaign?.groupName}</strong>.
            </p>
            <p className="mt-2">Are you sure you want to proceed?</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Campaigns;
