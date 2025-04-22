import React, { useState, useEffect } from 'react';
import httpClient from '../../services/httpClient';

const ENTRIES_PER_PAGE = 3;

const FormDataList = ({ campaignId }) => {
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!campaignId) return;

    const fetchFormData = async () => {
      try {
        setLoading(true);
        const response = await httpClient.get(
          `/GetFormSubmissions/${campaignId}?page=1&pageSize=1000`
        );
        setFormData(response.data.formData);
        setError(null);
        setCurrentPage(1); // reset page on new campaign
      } catch (err) {
        console.error('Error fetching form data:', err);
        setError('Failed to load form submissions');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [campaignId]);

  const totalPages = formData
    ? Math.ceil(formData.submissions.length / ENTRIES_PER_PAGE)
    : 0;

  const paginatedSubmissions = formData
    ? formData.submissions.slice(
        (currentPage - 1) * ENTRIES_PER_PAGE,
        currentPage * ENTRIES_PER_PAGE
      )
    : [];

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 my-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Form Submissions</h2>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 my-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Form Submissions</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!formData || formData.submissions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 my-4">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Form Submissions</h2>
        <p className="text-gray-500">No form submissions have been received yet for this campaign.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 my-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Form Submissions</h2>

      <div className="space-y-6">
        {paginatedSubmissions.map((submission) => (
          <div key={submission.id} className="border rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-gray-700">
                Submission from {submission.ip_address}
              </h3>
              <span className="text-sm text-gray-500">{formatDate(submission.timestamp)}</span>
            </div>

            <div className="mt-3">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Field
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {submission.fields.map((field, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        {field.field_name}
                      </td>
                      <td className="px-4 py-2 whitespace-normal text-sm text-gray-500 break-all">
                        {field.field_value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              User Agent: {submission.user_agent.substring(0, 100)}...
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6">
          <button
            className={`px-4 py-2 border rounded-md ${
              currentPage === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-blue-500 hover:bg-blue-50'
            }`}
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>

          <button
            className={`px-4 py-2 border rounded-md ${
              currentPage === totalPages
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-blue-500 hover:bg-blue-50'
            }`}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default FormDataList;
