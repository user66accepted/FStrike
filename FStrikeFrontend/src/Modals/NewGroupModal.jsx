import React, { useState, useRef, useEffect } from "react";
import { FaPlus, FaFileCsv, FaTrash, FaRobot, FaTimes, FaUsers, FaDownload, FaSearch, FaUser, FaEnvelope, FaBriefcase } from "react-icons/fa";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import AISearchModal from "./AISearchModal";
import config from "../config/apiConfig";

// Simple email validation regex function
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

function NewGroupModal({ show, onClose, onSave, editData }) {
  // Group name
  const [groupName, setGroupName] = useState("");

  // Table data
  const [users, setUsers] = useState([]);

  // New user form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 4;

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // AI Search modal
  const [showAISearch, setShowAISearch] = useState(false);

  // Ref for hidden file input
  const fileInputRef = useRef(null);

  // Load edit data if provided
  useEffect(() => {
    if (editData) {
      setGroupName(editData.name);
      setUsers(editData.users);
    } else {
      // Reset form when opening for new group
      setGroupName("");
      setUsers([]);
    }
  }, [editData]);

  // Filter users based on search
  const filteredUsers = users.filter((user) => {
    const fullString = `${user.firstName} ${user.lastName} ${user.email} ${user.position}`.toLowerCase();
    return fullString.includes(searchTerm.toLowerCase());
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredUsers.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  const handleAddUser = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !position.trim()) {
      return; // Simple validation for empty fields
    }
    if (!isValidEmail(email)) {
      alert("Invalid email format.");
      return;
    }
    const newUser = { firstName, lastName, email, position };
    setUsers((prevUsers) => [...prevUsers, newUser]);
    // Reset fields
    setFirstName("");
    setLastName("");
    setEmail("");
    setPosition("");
  };

  const handleDeleteUser = (userIndex) => {
    setUsers((prevUsers) => prevUsers.filter((_, idx) => idx !== userIndex));
  };

  // Updated save handler with validations and POST/PUT request
  const handleSaveChanges = async () => {
    if (!groupName.trim()) {
      alert("Please provide a group name.");
      return;
    }
    if (users.length === 0) {
      alert("Please add at least one user.");
      return;
    }

    const payload = { groupName, users };
    if (editData?.id) {
      payload.groupId = editData.id;
    }

    try {
      const response = await fetch(`${config.API_BASE_URL}/SaveUserGroup`, {
        method: editData?.id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error("Failed to save group. Server responded with an error.");
      }
      
      // Call the onSave callback with the response data
      const data = await response.json();
      onSave(data);
      onClose();
    } catch (error) {
      alert("Error saving group: " + error.message);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Trigger file input when Bulk Import button is clicked
  const handleBulkImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
  };

  // Process the file after selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validHeaders = ["First Name", "Last Name", "Email", "Position"];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          const headers = results.meta.fields;
          if (!headers || validHeaders.some((header) => !headers.includes(header))) {
            alert("CSV file does not contain the required columns.");
            return;
          }
          
          const importedUsers = results.data.reduce((acc, row) => {
            if (isValidEmail(row["Email"])) {
              acc.push({
                firstName: row["First Name"],
                lastName: row["Last Name"],
                email: row["Email"],
                position: row["Position"],
              });
            }
            return acc;
          }, []);

          if (importedUsers.length === 0) {
            alert("No valid users found in the CSV file.");
            return;
          }
          setUsers((prevUsers) => [...prevUsers, ...importedUsers]);
        },
        error: function (error) {
          alert("Error parsing CSV file: " + error.message);
        },
      });
    } else if (fileName.endsWith(".xls") || fileName.endsWith(".xlsx")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        
        if (jsonData.length === 0) {
          alert("Excel file is empty.");
          return;
        }

        const headers = jsonData[0];
        if (validHeaders.some((header, idx) => headers[idx] !== header)) {
          alert("Excel file does not contain the required columns in the correct order.");
          return;
        }

        const importedUsers = jsonData.slice(1).reduce((acc, row) => {
          const emailValue = row[2];
          if (isValidEmail(emailValue)) {
            acc.push({
              firstName: row[0],
              lastName: row[1],
              email: emailValue,
              position: row[3],
            });
          }
          return acc;
        }, []);

        if (importedUsers.length === 0) {
          alert("No valid users found in the Excel file.");
          return;
        }

        setUsers((prevUsers) => [...prevUsers, ...importedUsers]);
      };
      reader.onerror = () => {
        alert("Error reading Excel file.");
      };
      reader.readAsBinaryString(file);
    } else {
      alert("Please select a CSV or Excel file.");
    }
  };

  // Handle AI person selection
  const handleSelectPerson = (person) => {
    if (person) {
      setUsers((prevUsers) => [
        ...prevUsers,
        {
          firstName: person.firstName || "",
          lastName: person.lastName || "",
          email: person.email || "",
          position: person.position || "",
        },
      ]);
    }
  };

  // Handle AI organization selection (multiple employees)
  const handleSelectOrganization = (employees) => {
    if (employees && employees.length > 0) {
      const newUsers = employees.map((employee) => ({
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        email: employee.email || "",
        position: employee.position || "",
      }));
      setUsers((prevUsers) => [...prevUsers, ...newUsers]);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50">
      <div className="glass-card w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative p-6 border-b border-cyber-primary/20">
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-primary/10 to-cyber-secondary/10"></div>
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <FaUsers className="text-cyber-primary text-2xl" />
              <h2 className="text-2xl font-bold text-cyber-primary">
                {editData ? "Edit Group" : "Create New Group"}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="glass-button p-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
            >
              <FaTimes size={20} />
            </button>
          </div>
          <p className="text-cyber-muted text-sm mt-2 relative z-10">
            Create and manage user groups for targeted campaigns
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Group Name */}
          <div>
            <label className="block text-cyber-muted text-sm font-medium mb-2 flex items-center space-x-2">
              <FaUsers />
              <span>Group Name</span>
            </label>
            <input
              type="text"
              className="glass-select w-full px-4 py-3 rounded-lg"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          {/* Import Actions */}
          <div className="glass-card p-4">
            <h3 className="text-cyber-secondary font-medium mb-4">Import Options</h3>
            <div className="flex flex-wrap gap-3">
              <button
                className="glass-button px-4 py-2 rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform"
                onClick={handleBulkImportClick}
              >
                <FaPlus />
                <span>Bulk Import Users</span>
              </button>
              <button className="glass-button px-4 py-2 rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform">
                <FaDownload />
                <span>Download CSV Template</span>
              </button>
              <button
                className="glass-button px-4 py-2 rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform"
                onClick={() => setShowAISearch(true)}
              >
                <FaRobot />
                <span>AI Search</span>
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
            />
          </div>

          {/* Add User Form */}
          <div className="glass-card p-4">
            <h3 className="text-cyber-secondary font-medium mb-4 flex items-center space-x-2">
              <FaUser />
              <span>Add Individual User</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="First Name"
                className="glass-select px-3 py-2 rounded-lg"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Last Name"
                className="glass-select px-3 py-2 rounded-lg"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <input
                type="email"
                placeholder="Email"
                className="glass-select px-3 py-2 rounded-lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="text"
                placeholder="Position"
                className="glass-select px-3 py-2 rounded-lg"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
              <button
                className="glass-button px-4 py-2 rounded-lg flex items-center justify-center space-x-2 hover:scale-105 transition-transform"
                onClick={handleAddUser}
              >
                <FaPlus />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Table Controls */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 text-cyber-muted">
              <span>Show</span>
              <select className="glass-select px-2 py-1 rounded text-sm w-16" disabled>
                <option value="4">4</option>
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center space-x-2">
              <FaSearch className="text-cyber-muted" />
              <input
                type="text"
                className="glass-select px-3 py-2 rounded-lg w-64"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="data-table rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cyber-primary/20">
                  <th className="p-3 text-left text-cyber-primary font-medium">
                    <div className="flex items-center space-x-2">
                      <FaUser />
                      <span>First Name</span>
                    </div>
                  </th>
                  <th className="p-3 text-left text-cyber-primary font-medium">Last Name</th>
                  <th className="p-3 text-left text-cyber-primary font-medium">
                    <div className="flex items-center space-x-2">
                      <FaEnvelope />
                      <span>Email</span>
                    </div>
                  </th>
                  <th className="p-3 text-left text-cyber-primary font-medium">
                    <div className="flex items-center space-x-2">
                      <FaBriefcase />
                      <span>Position</span>
                    </div>
                  </th>
                  <th className="p-3 text-center text-cyber-primary font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentUsers.length > 0 ? (
                  currentUsers.map((user, idx) => {
                    const userIndex = startIndex + idx;
                    return (
                      <tr key={userIndex} className="border-b border-cyber-primary/10 hover:bg-cyber-primary/5">
                        <td className="p-3 text-cyber-secondary">{user.firstName}</td>
                        <td className="p-3 text-cyber-secondary">{user.lastName}</td>
                        <td className="p-3 text-cyber-muted">{user.email}</td>
                        <td className="p-3 text-cyber-muted">{user.position}</td>
                        <td className="p-3 text-center">
                          <button
                            className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-400/10 transition-colors"
                            onClick={() => handleDeleteUser(userIndex)}
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-cyber-muted italic">
                      No users added to this group yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="flex justify-between items-center text-cyber-muted text-sm">
              <div>
                Showing {startIndex + 1} to{" "}
                {endIndex > filteredUsers.length ? filteredUsers.length : endIndex} of{" "}
                {filteredUsers.length} entries
              </div>
              <div className="flex space-x-2">
                <button
                  className="glass-button px-3 py-1 rounded text-sm hover:scale-105 transition-transform"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <button
                  className="glass-button px-3 py-1 rounded text-sm hover:scale-105 transition-transform"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 border-t border-cyber-primary/20 px-6 py-4">
          <button
            className="glass-button px-6 py-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="glass-button px-6 py-2 rounded-lg hover:scale-105 transition-transform"
            onClick={handleSaveChanges}
          >
            <div className="flex items-center space-x-2">
              <FaUsers />
              <span>{editData ? "Update Group" : "Save Group"}</span>
            </div>
          </button>
        </div>
      </div>

      {/* AI Search Modal */}
      <AISearchModal
        show={showAISearch}
        onClose={() => setShowAISearch(false)}
        onSelectPerson={handleSelectPerson}
        onSelectOrganization={handleSelectOrganization}
      />
    </div>
  );
}

export default NewGroupModal;
