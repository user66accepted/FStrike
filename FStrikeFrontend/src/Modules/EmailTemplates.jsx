import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaClone, FaTrash } from "react-icons/fa";
import DeleteConfirmation from "../Modals/DeleteConfirmationModal";
import NewTemplateModal from "../Modals/NewTemplateModal";
import InfoBar from "../components/InfoBar";

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
      const res = await fetch("http://161.97.104.136:5000/api/GetEmailTemplates");
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
      const res = await fetch(`http://192.168.15.147:5000/api/DeleteEmailTemplate/${selectedTemplate.id}`, {
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
    <div className="p-6">
      <h1 className="text-6xl font-bold text-slate-800">Email Templates</h1>
      <hr className="my-4 bg-gray-300" />

      {/* New Template Button */}
      <button
        className="bg-teal-500 mt-8 mb-8 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-teal-400 cursor-pointer"
        onClick={handleOpenNewTemplateModal}
      >
        <FaPlus /> New Template
      </button>

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

      <table className="w-full mt-4">
        <thead>
          <tr className="border-b-2 border-gray-300 text-left">
            <th className="p-2">Name</th>
            <th className="p-2">Modified Date</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td className="p-2" colSpan="3">
                Loading...
              </td>
            </tr>
          ) : templates.length === 0 ? (
            <tr>
              <td colSpan="3" className="p-4 text-center text-gray-600">
                <InfoBar text="Templates"/>
              </td>
            </tr>
          ) : (
            templates.map((template) => (
              <tr key={template.id}>
                <td className="p-2">{template.template_name}</td>
                <td className="p-2">
                  {new Date(template.created_at).toLocaleString()}
                </td>
                <td className="p-2 flex gap-2">
                  <button
                    className="bg-teal-500 text-white p-2 rounded hover:bg-teal-600 cursor-pointer"
                    onClick={() => handleEditTemplate(template)}
                  >
                    <FaEdit />
                  </button>
                  <button className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 cursor-pointer">
                    <FaClone />
                  </button>
                  <button
                    className="bg-red-500 text-white p-2 rounded hover:bg-red-600 cursor-pointer"
                    onClick={() => openDeleteModal(template)}
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-4 flex justify-between items-center">
        <span className="text-gray-600">
          {templates.length > 0
            ? `Showing 1 to ${templates.length} of ${templates.length} entries`
            : "0 entries"}
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmation
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        name={selectedTemplate ? selectedTemplate.template_name : ""}
        text="email template"
      />

      {/* New Template Modal - pass initial template data for editing */}
      <NewTemplateModal
        isOpen={showNewTemplateModal}
        onClose={handleCloseNewTemplateModal}
        initialTemplate={editingTemplate}
      />
    </div>
  );
};

export default EmailTemplates;
