import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaClone, FaTrash, FaFileAlt, FaGlobe, FaCalendarAlt } from "react-icons/fa";
import DeleteConfirmation from "../Modals/DeleteConfirmationModal";
import NewLandingPageModal from "../Modals/NewLandingPageModal";
import config from "../config/apiConfig";

const LandingPages = () => {
  const [landingPages, setLandingPages] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [editingPage, setEditingPage] = useState(null);

  // Function to refresh the list of landing pages
  const refreshLandingPages = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/GetLandingPages`);
      const data = await response.json();
      setLandingPages(data);
    } catch (error) {
      console.error("Error fetching landing pages:", error);
    }
  };

  // Fetch landing pages on component mount
  useEffect(() => {
    refreshLandingPages();
  }, []);

  // Delete Confirmation Modal Handlers
  const openDeleteModal = (page) => {
    setSelectedPage(page);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedPage(null);
  };

  const handleDelete = async () => {
    if (!selectedPage) return;
    try {
      const response = await fetch(
        `${config.API_BASE_URL}/DeleteLandingPage/${selectedPage.id}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error deleting page:", errorData.error);
      } else {
        console.log(`Page ${selectedPage.page_name} deleted successfully.`);
        refreshLandingPages();
      }
    } catch (error) {
      console.error("Error deleting page:", error);
    } finally {
      closeDeleteModal();
    }
  };

  // Handle edit button click
  const handleEditClick = async (page) => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/GetLandingPage/${page.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch page details');
      }
      const pageDetails = await response.json();
      setEditingPage(pageDetails);
      setShowNewTemplateModal(true);
    } catch (error) {
      console.error("Error fetching page details:", error);
      alert("Error loading page details");
    }
  };

  // New Template Modal Handlers
  const handleOpenNewTemplateModal = () => {
    setEditingPage(null);
    setShowNewTemplateModal(true);
  };

  const handleCloseNewTemplateModal = () => {
    setShowNewTemplateModal(false);
    setEditingPage(null);
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <h1 className="text-4xl font-bold text-cyber-primary tracking-tight">
            Landing Assets
          </h1>
        </div>
        <p className="text-cyber-muted">
          Manage phishing landing pages • Website mirroring and customization
        </p>
        <div className="w-full h-px bg-gradient-to-r from-cyber-primary via-cyber-secondary to-transparent mt-4"></div>
      </div>

      {/* New Page Button */}
      <button
        className="glass-button px-6 py-3 rounded-lg flex items-center space-x-2 mb-6 hover:scale-105 transition-transform"
        onClick={handleOpenNewTemplateModal}
      >
        <FaGlobe />
        <span className="font-medium">New Landing Page</span>
      </button>

      {/* Main Content Card */}
      <div className="glass-card p-6">
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
              placeholder="Filter landing pages..."
            />
          </div>
        </div>

        {/* Landing Pages Table */}
        {landingPages.length > 0 ? (
          <div className="data-table rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">Page Name</th>
                  <th className="text-left">Created Date</th>
                  <th className="text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {landingPages.map((page) => (
                  <tr key={page.id}>
                    <td>
                      <div className="flex items-center space-x-2">
                        <FaFileAlt className="text-cyber-secondary" />
                        <span className="font-semibold text-cyber-primary">{page.page_name}</span>
                      </div>
                    </td>
                    <td className="text-cyber-muted font-mono text-sm">
                      {new Date(page.created_at).toLocaleString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="glass-button p-2 rounded-lg text-cyber-secondary hover:text-cyber-primary"
                          onClick={() => handleEditClick(page)}
                          title="Edit Page"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          className="glass-button p-2 rounded-lg text-cyber-secondary hover:text-cyber-primary"
                          title="Clone Page"
                        >
                          <FaClone />
                        </button>
                        <button
                          className="glass-button p-2 rounded-lg text-cyber-accent hover:text-red-400"
                          onClick={() => openDeleteModal(page)}
                          title="Delete Page"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-cyber-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-cyber-muted text-lg">No landing pages found</p>
            <p className="text-cyber-muted text-sm mt-2">Create your first landing page to capture user credentials</p>
          </div>
        )}

        {/* Pagination */}
        {landingPages.length > 0 && (
          <div className="flex justify-between items-center mt-6 pt-6">
            <span className="text-cyber-muted text-sm">
              Showing 1 to {landingPages.length} of {landingPages.length} entries
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

      {/* Modals */}
      <DeleteConfirmation
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        name={selectedPage ? selectedPage.page_name : ""}
        text="landing page"
      />

      <NewLandingPageModal
        isOpen={showNewTemplateModal}
        onClose={handleCloseNewTemplateModal}
        onSave={refreshLandingPages}
        editData={editingPage}
      />
    </div>
  );
};

export default LandingPages;