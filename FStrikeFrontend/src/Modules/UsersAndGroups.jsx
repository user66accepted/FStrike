import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaTrash, FaUsers, FaUserPlus, FaCalendarAlt } from "react-icons/fa";
import NewGroupModal from "../Modals/NewGroupModal";
import DeleteConfirmationModal from "../Modals/DeleteConfirmationModal";
import config from "../config/apiConfig";

const UsersAndGroups = () => {
  const [showModal, setShowModal] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [groupToEdit, setGroupToEdit] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch groups from the backend
  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.API_BASE_URL}/GetUserGroups`);
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

  // Fetch group details for editing
  const fetchGroupDetails = async (groupId) => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/GetGroupUsers/${groupId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch group details");
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching group details:", error);
      return null;
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Close the NewGroupModal
  const handleClose = () => {
    setShowModal(false);
    setGroupToEdit(null);
  };

  // Handle saving data from the NewGroupModal and refresh groups list
  const handleSave = (data) => {
    console.log("Modal Data:", data);
    setShowModal(false);
    setGroupToEdit(null);
    fetchGroups();
  };

  // When edit button is clicked
  const handleEditClick = async (group) => {
    const groupDetails = await fetchGroupDetails(group.id);
    if (groupDetails) {
      setGroupToEdit({
        id: group.id,
        name: group.group_name,
        users: groupDetails.users.map(user => ({
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          position: user.position
        }))
      });
      setShowModal(true);
    }
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
        `${config.API_BASE_URL}/DeleteUserGroup/${groupToDelete.id}`,
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
    <div className="min-h-screen p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-3 h-3 bg-green-400 status-indicator"></div>
          <h1 className="text-4xl font-bold text-cyber-primary tracking-tight">
            Target Management
          </h1>
        </div>
        <p className="text-cyber-muted">
          Manage user groups and target databases • Organize phishing campaigns
        </p>
        <div className="w-full h-px bg-gradient-to-r from-cyber-primary via-cyber-secondary to-transparent mt-4"></div>
      </div>

      {/* New Group Button */}
      <button
        className="glass-button px-6 py-3 rounded-lg flex items-center space-x-2 mb-6 hover:scale-105 transition-transform"
        onClick={() => setShowModal(true)}
      >
        <FaUserPlus />
        <span className="font-medium">New Target Group</span>
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
              placeholder="Filter groups..."
            />
          </div>
        </div>

        {/* Groups Table */}
        {loading ? (
          <div className="text-center py-16">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-cyber-muted">Loading target groups...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-cyber-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-cyber-muted text-lg">No target groups found</p>
            <p className="text-cyber-muted text-sm mt-2">Create your first target group to organize users</p>
          </div>
        ) : (
          <div className="data-table rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">Group Name</th>
                  <th className="text-left">Members</th>
                  <th className="text-left">Created Date</th>
                  <th className="text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <div className="flex items-center space-x-2">
                        <FaUsers className="text-cyber-secondary" />
                        <span className="font-semibold text-cyber-primary">{group.group_name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <div className="badge badge-success">{group.memberCount || 0}</div>
                        <span className="text-cyber-muted text-sm">targets</span>
                      </div>
                    </td>
                    <td className="text-cyber-muted font-mono text-sm">
                      {new Date(group.created_at).toLocaleString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          className="glass-button p-2 rounded-lg text-cyber-secondary hover:text-cyber-primary"
                          onClick={() => handleEditClick(group)}
                          title="Edit Group"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="glass-button p-2 rounded-lg text-cyber-accent hover:text-red-400"
                          onClick={() => handleDeleteClick(group)}
                          title="Delete Group"
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
        {groups.length > 0 && (
          <div className="flex justify-between items-center mt-6 pt-6">
            <span className="text-cyber-muted text-sm">
              Showing 1 to {groups.length} of {groups.length} entries
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
      {showModal && (
        <NewGroupModal
          show={showModal}
          onClose={handleClose}
          onSave={handleSave}
          editData={groupToEdit}
        />
      )}

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
