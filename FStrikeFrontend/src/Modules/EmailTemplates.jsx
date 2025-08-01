import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaClone, FaTrash, FaEnvelope, FaCode, FaCalendarAlt } from "react-icons/fa";
import DeleteConfirmation from "../Modals/DeleteConfirmationModal";
import NewTemplateModal from "../Modals/NewTemplateModal";
import config from "../config/apiConfig";

const EmailTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Fetch templates from the backend
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}/GetEmailTemplates`);
      if (!res.ok) {
        throw new Error("Failed to fetch templates");
      }
      const data = await res.json();
      setTemplates(data.templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Delete Confirmation Modal Handlers
  const openDeleteModal = (template) => {
    setSelectedTemplate(template);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedTemplate(null);
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    try {
      const res = await fetch(`${config.API_BASE_URL}/DeleteEmailTemplate/${selectedTemplate.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete template");
      }
      // Refresh templates after deletion
      fetchTemplates();
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  };

  // New Template Modal Handlers
  const handleOpenNewTemplateModal = () => {
    // If not editing, clear editingTemplate
    setEditingTemplate(null);
    setShowNewTemplateModal(true);
  };

  // When clicking edit, set the template to be edited
  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setShowNewTemplateModal(true);
  };

  const handleCloseNewTemplateModal = () => {
    setShowNewTemplateModal(false);
    setEditingTemplate(null);
    // Refresh templates after closing modal if a new one was added/edited
    fetchTemplates();
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-3 h-3 bg-green-400 status-indicator"></div>
          <h1 className="text-4xl font-bold text-cyber-primary tracking-tight">
            Payload Templates
          </h1>
        </div>
        <p className="text-cyber-muted">
          Design and manage email templates • Social engineering toolkit
        </p>
        <div className="w-full h-px bg-gradient-to-r from-cyber-primary via-cyber-secondary to-transparent mt-4"></div>
      </div>

      {/* New Template Button */}
      <button
        className="glass-button px-6 py-3 rounded-lg flex items-center space-x-2 mb-6 hover:scale-105 transition-transform"
        onClick={handleOpenNewTemplateModal}
      >
        <FaCode />
        <span className="font-medium">New Template</span>
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
              placeholder="Filter templates..."
            />
          </div>
        </div>

        {/* Templates Table */}
        {loading ? (
          <div className="text-center py-16">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-cyber-muted">Loading email templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-cyber-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.82 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-cyber-muted text-lg">No email templates found</p>
            <p className="text-cyber-muted text-sm mt-2">Create your first email template to start crafting phishing campaigns</p>
          </div>
        ) : (
          <div className="data-table rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">Template Name</th>
                  <th className="text-left">Created Date</th>
                  <th className="text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>
                      <div className="flex items-center space-x-2">
                        <FaEnvelope className="text-cyber-secondary" />
                        <span className="font-semibold text-cyber-primary">{template.template_name}</span>
                      </div>
                    </td>
                    <td className="text-cyber-muted font-mono text-sm">
                      {new Date(template.created_at).toLocaleString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="glass-button p-2 rounded-lg text-cyber-secondary hover:text-cyber-primary"
                          onClick={() => handleEditTemplate(template)}
                          title="Edit Template"
                        >
                          <FaEdit />
                        </button>
                        <button 
                          className="glass-button p-2 rounded-lg text-cyber-secondary hover:text-cyber-primary"
                          title="Clone Template"
                        >
                          <FaClone />
                        </button>
                        <button
                          className="glass-button p-2 rounded-lg text-cyber-accent hover:text-red-400"
                          onClick={() => openDeleteModal(template)}
                          title="Delete Template"
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
        )}

        {/* Pagination */}
        {templates.length > 0 && (
          <div className="flex justify-between items-center mt-6 pt-6">
            <span className="text-cyber-muted text-sm">
              Showing 1 to {templates.length} of {templates.length} entries
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
        name={selectedTemplate ? selectedTemplate.template_name : ""}
        text="email template"
      />

      <NewTemplateModal
        isOpen={showNewTemplateModal}
        onClose={handleCloseNewTemplateModal}
        initialTemplate={editingTemplate}
      />
    </div>
  );
};

export default EmailTemplates;
