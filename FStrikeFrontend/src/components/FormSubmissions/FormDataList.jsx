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
        console.log(`Fetching form data for campaign ${campaignId}, page ${currentPage}`);
        setLoading(true);
        const response = await httpClient.get(
          `/GetFormSubmissions/${campaignId}?page=${currentPage}&pageSize=${ENTRIES_PER_PAGE}`
        );
        console.log('API Response:', response.data);
        
        if (response.data.formData) {
          console.log('Setting form data:', {
            totalCount: response.data.formData.totalCount,
            currentPage: response.data.formData.currentPage,
            totalPages: response.data.formData.totalPages,
            submissionCount: response.data.formData.submissions.length
          });
          setFormData(response.data.formData);
          setError(null);
        } else {
          console.error('No form data in response');
          setError('No form data received from server');
        }
      } catch (err) {
        console.error('Error fetching form data:', err);
        setError(err.response?.data?.message || 'Failed to load form submissions');
      } finally {
        setLoading(false);
      }
    };

    const intervalId = setInterval(fetchFormData, 10000); // Refresh every 10 seconds
    fetchFormData(); // Initial fetch

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [campaignId, currentPage]);

  const handlePageChange = (newPage) => {
    if (!formData || newPage < 1 || newPage > formData.totalPages) return;
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
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Form Submissions ({formData.totalCount} total)
      </h2>

      <div className="space-y-6">
        {formData.submissions.map((submission) => (
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
                      Type
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
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {field.field_type || 'text'}
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
              <div>IP Address: {submission.ip_address}</div>
              <div>User Agent: {submission.user_agent}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {formData.totalPages > 1 && (
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
            Page {currentPage} of {formData.totalPages}
          </span>

          <button
            className={`px-4 py-2 border rounded-md ${
              currentPage === formData.totalPages
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-blue-500 hover:bg-blue-50'
            }`}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === formData.totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default FormDataList;
