import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaClone, FaTrash } from "react-icons/fa";
import DeleteConfirmation from "../Modals/DeleteConfirmationModal";
import NewLandingPageModal from "../Modals/NewLandingPageModal";
import InfoBar from "../components/InfoBar";

const LandingPages = () => {
  const [landingPages, setLandingPages] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [editingPage, setEditingPage] = useState(null);

  // Function to refresh the list of landing pages
  const refreshLandingPages = async () => {
    try {
      const response = await fetch("http://161.97.104.136:5000/api/GetLandingPages");
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
        `http://161.97.104.136:5000/api/DeleteLandingPage/${selectedPage.id}`,
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
      const response = await fetch(`http://161.97.104.136:5000/api/GetLandingPage/${page.id}`);
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
    <div className="p-6">
      <h1 className="text-6xl font-bold text-slate-800">Landing Pages</h1>
      <hr className="my-4 bg-gray-300" />

      <button
        className="bg-teal-500 mt-8 mb-8 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-teal-400 cursor-pointer"
        onClick={handleOpenNewTemplateModal}
      >
        <FaPlus /> New Page
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
          {landingPages.length > 0 ? (
            landingPages.map((page) => (
              <tr key={page.id}>
                <td className="p-2">{page.page_name}</td>
                <td className="p-2">
                  {new Date(page.created_at).toLocaleString()}
                </td>
                <td className="p-2 flex gap-2">
                  <button
                    className="bg-teal-500 text-white p-2 rounded hover:bg-teal-600 cursor-pointer"
                    onClick={() => handleEditClick(page)}
                  >
                    <FaEdit />
                  </button>
                  <button className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 cursor-pointer">
                    <FaClone />
                  </button>
                  <button
                    className="bg-red-500 text-white p-2 rounded hover:bg-red-600 cursor-pointer"
                    onClick={() => openDeleteModal(page)}
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="3" className="p-4 text-center text-gray-600">
                <InfoBar text="Pages"/>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-4 flex justify-between items-center">
        <span className="text-gray-600">
          Showing{" "}
          {landingPages.length > 0
            ? "1 to " + landingPages.length
            : "0"}{" "}
          of {landingPages.length} entries
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

      {/* Confirmation Modal */}
      <DeleteConfirmation
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        name={selectedPage ? selectedPage.page_name : ""}
        text="landing page"
      />

      {/* New Template Modal */}
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