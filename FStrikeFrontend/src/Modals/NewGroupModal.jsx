import React, { useState, useRef, useEffect } from "react";
import { FaPlus, FaFileCsv, FaTrash, FaRobot } from "react-icons/fa";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import AISearchModal from "./AISearchModal";

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
      const response = await fetch("http://147.93.87.182:5000/api/SaveUserGroup", {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Background overlay */}
      <div
        className="absolute inset-0 bg-gray-900 opacity-50"
        onClick={onClose}
      ></div>

      {/* Modal content */}
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-3xl p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-3xl font-semibold">{editData ? 'Edit Group' : 'New Group'}</h2>
          <button
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div>
          {/* Group Name */}
          <div className="mb-4">
            <label className="block font-medium mb-1">Name:</label>
            <input
              type="text"
              className="border border-gray-300 rounded px-2 py-1 w-full"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          {/* Bulk Import & CSV Download */}
          <div className="flex space-x-2 mb-4">
            <button
              className="flex items-center justify-center gap-2 bg-red-400 hover:bg-red-600 text-white px-4 py-2 cursor-pointer rounded"
              onClick={handleBulkImportClick}
            >
              <FaPlus /> Bulk Import Users
            </button>
            <button className="flex items-center justify-center gap-2 text-gray-300 text-sm cursor-pointer px-4 py-2 rounded">
              <FaFileCsv /> Download CSV Template
            </button>
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
            />
          </div>

          {/* Add User Form */}
          <div className="border p-4 rounded-md mb-4">
            <h4 className="font-semibold mb-3">Add User</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
              <input
                type="text"
                placeholder="First Name"
                className="border border-gray-300 p-2 rounded"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Last Name"
                className="border border-gray-300 p-2 rounded"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <input
                type="email"
                placeholder="Email"
                className="border border-gray-300 p-2 rounded"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="text"
                placeholder="Position"
                className="border border-gray-300 p-2 rounded"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
              <div className="flex space-x-2">
                <button
                  className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded w-full flex items-center justify-center"
                  onClick={handleAddUser}
                >
                  <FaPlus className="mr-1" /> Add
                </button>
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded flex items-center justify-center"
                  title="Use AI to find person or organization"
                  onClick={() => setShowAISearch(true)}
                >
                  <FaRobot />
                </button>
              </div>
            </div>
          </div>

          {/* Table Controls (Show X entries, Search) */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <span>Show</span>
              <select
                className="mx-2 border border-gray-300 rounded px-1 py-1 text-sm w-16"
                disabled
              >
                <option value="4">4</option>
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center">
              <span>Search:</span>
              <input
                type="text"
                className="border border-gray-300 rounded px-2 py-1 ml-2 text-sm"
                style={{ width: "200px" }}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border-b border-gray-300 text-left">First Name</th>
                  <th className="p-2 border-b border-gray-300 text-left">Last Name</th>
                  <th className="p-2 border-b border-gray-300 text-left">Email</th>
                  <th className="p-2 border-b border-gray-300 text-left">Position</th>
                  <th className="p-2 border-b border-gray-300 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentUsers.length > 0 ? (
                  currentUsers.map((user, idx) => {
                    const userIndex = startIndex + idx;
                    return (
                      <tr key={userIndex} className="border-b border-gray-300">
                        <td className="p-2">{user.firstName}</td>
                        <td className="p-2">{user.lastName}</td>
                        <td className="p-2">{user.email}</td>
                        <td className="p-2">{user.position}</td>
                        <td className="p-2 text-center">
                          <button
                            className="text-red-500 hover:text-red-700"
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
                    <td colSpan="5" className="p-2 text-center">
                      No data available in table
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="flex justify-between items-center">
              <div className="text-sm">
                Showing {startIndex + 1} to{" "}
                {endIndex > filteredUsers.length ? filteredUsers.length : endIndex} of{" "}
                {filteredUsers.length} entries
              </div>
              <div className="space-x-2">
                <button
                  className="border border-gray-300 px-2 py-1 rounded text-sm hover:bg-gray-100"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <button
                  className="border border-gray-300 px-2 py-1 rounded text-sm hover:bg-gray-100"
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
        <div className="mt-4 flex justify-end space-x-2">
          <button
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded cursor-pointer"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded cursor-pointer"
            onClick={handleSaveChanges}
          >
            Save changes
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
