import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import NewGroupModal from "../Modals/NewGroupModal";
import DeleteConfirmationModal from "../Modals/DeleteConfirmationModal";
import InfoBar from "../components/InfoBar"

const UsersAndGroups = () => {
  const [showModal, setShowModal] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch groups from the backend
  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://161.97.104.136:5000/api/GetUserGroups");
      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }
      const data = await response.json();
      // Assuming response format: { groups: [{ id, group_name, created_at, memberCount }] }
      setGroups(data.groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Close the NewGroupModal
  const handleClose = () => setShowModal(false);

  // Handle saving data from the NewGroupModal and refresh groups list
  const handleSave = (data) => {
    console.log("Modal Data:", data);
    setShowModal(false);
    fetchGroups();
  };

  // When delete icon is clicked, open the delete modal
  const handleDeleteClick = (group) => {
    setGroupToDelete(group);
    setDeleteModalOpen(true);
  };

  // Confirm deletion and call backend DELETE endpoint
  const confirmDelete = async () => {
    if (!groupToDelete) return;

    try {
      const response = await fetch(
        `http://192.168.15.147:5000/api/DeleteUserGroup/${groupToDelete.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error("Failed to delete group");
      }
      // Refresh groups after deletion
      fetchGroups();
      setDeleteModalOpen(false);
      setGroupToDelete(null);
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-6xl font-bold text-slate-800">Users &amp; Groups</h1>
      <hr className="my-4 bg-gray-300" />

      {/* Button that opens the NewGroupModal */}
      <button
        className="bg-teal-500 mt-8 mb-8 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-teal-400 cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        <FaPlus /> New Group
      </button>

      {/* Table Controls */}
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

      {/* Groups Table */}
      <table className="w-full mt-4">
        <thead>
          <tr className="border-b-2 border-gray-300 text-left">
            <th className="p-2">Name</th>
            <th className="p-2"># of Members</th>
            <th className="p-2">Modified Date</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="p-2" colSpan="4">
                Loading...
              </td>
            </tr>
          ) : groups.length === 0 ? (
            <tr>
              <td colSpan="3" className="p-4 text-center text-gray-600">
                <InfoBar text="Groups"/>
              </td>
            </tr>
          ) : (
            groups.map((group) => (
              <tr key={group.id}>
                <td className="p-2">{group.group_name}</td>
                <td className="p-2">{group.memberCount}</td>
                <td className="p-2">
                  {new Date(group.created_at).toLocaleString()}
                </td>
                <td className="p-2 flex gap-2">
                  <button className="bg-teal-500 text-white p-2 rounded hover:bg-teal-600 cursor-pointer">
                    <FaEdit />
                  </button>
                  <button
                    className="bg-red-500 text-white p-2 rounded hover:bg-red-600 cursor-pointer"
                    onClick={() => handleDeleteClick(group)}
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination (static for now) */}
      <div className="mt-4 flex justify-between items-center">
        <span className="text-gray-600">
          {groups.length > 0
            ? `Showing 1 to ${groups.length} of ${groups.length} entries`
            : "0 entries"}
        </span>
        <div className="flex items-center gap-2">
          <button className="border px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer">
            Previous
          </button>
          <button className="border px-3 py-1 rounded bg-blue-500 text-white">
            1
          </button>
          <button className="border px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer">
            Next
          </button>
        </div>
      </div>

      {/* Render NewGroupModal conditionally */}
      {showModal && (
        <NewGroupModal
          show={showModal}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        name={groupToDelete ? groupToDelete.group_name : ""}
        text="group"
      />
    </div>
  );
};

export default UsersAndGroups;
