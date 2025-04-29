import React, { useState } from "react";
import { FaSearch, FaSpinner, FaBuilding, FaUser, FaCheck, FaTimes } from "react-icons/fa";

/**
 * AI Search Modal Component for searching individuals or organizations
 */
function AISearchModal({ show, onClose, onSelectPerson, onSelectOrganization }) {
  const [searchType, setSearchType] = useState("person"); // "person" or "organization"
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  // Handle search submission
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError("Please enter a search term");
      return;
    }

    setLoading(true);
    setError("");
    setSearchResults([]);
    
    try {
      const endpoint = searchType === "person" ? 
        "http://161.97.104.136:5000/api/search-person" : 
        "http://161.97.104.136:5000/api/search-organization";
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: searchTerm })
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        setSearchResults(data.data);
      } else {
        setError("No results found. Try a different search term.");
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle person selection
  const handleSelectPerson = (person) => {
    setSelectedItem(person);
    onSelectPerson(person);
    onClose();
  };

  // Handle organization employees selection
  const handleSelectOrganization = (employees) => {
    onSelectOrganization(employees);
    onClose();
  };

  // Handle key press for search input
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-11/12 md:w-3/4 lg:w-2/3 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">
              AI Search: {searchType === "person" ? "Individual" : "Organization"}
            </h2>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={onClose}
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        {/* Search Controls */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex space-x-4">
              <button
                className={`px-4 py-2 rounded-md ${
                  searchType === "person"
                    ? "bg-teal-500 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
                onClick={() => setSearchType("person")}
              >
                <FaUser className="inline mr-2" />
                Person
              </button>
              <button
                className={`px-4 py-2 rounded-md ${
                  searchType === "organization"
                    ? "bg-teal-500 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
                onClick={() => setSearchType("organization")}
              >
                <FaBuilding className="inline mr-2" />
                Organization
              </button>
            </div>
            <div className="flex-1 flex">
              <input
                type="text"
                placeholder={`Enter ${
                  searchType === "person" ? "person name" : "organization name"
                }`}
                className="flex-1 border border-gray-300 rounded-l-md px-4 py-2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button
                className="bg-teal-500 text-white px-4 py-2 rounded-r-md hover:bg-teal-600 disabled:bg-gray-300"
                onClick={handleSearch}
                disabled={loading || !searchTerm.trim()}
              >
                {loading ? <FaSpinner className="animate-spin" /> : <FaSearch />}
              </button>
            </div>
          </div>
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>

        {/* Results */}
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <FaSpinner className="animate-spin text-teal-500 text-3xl" />
              <span className="ml-2 text-gray-600">Searching...</span>
            </div>
          ) : (
            <div>
              {searchResults.length > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    Found {searchResults.length} results:
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchResults.map((result, index) => (
                      <div
                        key={index}
                        className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                          selectedItem === result
                            ? "border-teal-500 bg-teal-50"
                            : "hover:border-gray-400"
                        }`}
                        onClick={() => {
                          if (searchType === "person") {
                            handleSelectPerson(result);
                          } else {
                            handleSelectOrganization([result]);
                          }
                        }}
                      >
                        <div className="flex items-start">
                          {result.imageUrl ? (
                            <img
                              src={result.imageUrl}
                              alt={`${result.firstName} ${result.lastName}`}
                              className="w-12 h-12 rounded-full object-cover mr-3"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                              {searchType === "person" ? (
                                <FaUser className="text-gray-500" />
                              ) : (
                                <FaBuilding className="text-gray-500" />
                              )}
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold">
                              {result.firstName} {result.lastName}
                            </h4>
                            {result.position && (
                              <p className="text-sm text-gray-600">
                                {result.position}
                              </p>
                            )}
                            {result.email && (
                              <p className="text-sm text-blue-600 truncate">
                                {result.email}
                              </p>
                            )}
                            {searchType === "organization" && result.organization && (
                              <p className="text-sm text-gray-500 mt-1">
                                {result.organization}
                              </p>
                            )}
                          </div>
                          <button
                            className="ml-2 text-teal-500 hover:text-teal-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (searchType === "person") {
                                handleSelectPerson(result);
                              } else {
                                handleSelectOrganization([result]);
                              }
                            }}
                          >
                            <FaCheck size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                !loading &&
                !error && (
                  <p className="text-center text-gray-500 py-8">
                    Enter a search term and click Search to find {searchType === "person" ? "people" : "organizations"}
                  </p>
                )
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <div className="text-sm text-gray-500">
            {searchType === "person"
              ? "Search for individuals to add to your group"
              : "Search for organizations to find employees"}
          </div>
          <div className="space-x-2">
            <button
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
              onClick={onClose}
            >
              Cancel
            </button>
            {searchType === "organization" && searchResults.length > 0 && (
              <button
                className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded"
                onClick={() => handleSelectOrganization(searchResults)}
              >
                Add All Results
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AISearchModal;
