import React from 'react'

function RecentCampaigns() {
    return (
        <>
            {/* Recent Campaigns Section */}
            <div className="bg-white rounded shadow p-4">
                {/* Header with "View All" button */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Recent Campaigns</h2>
                    <button className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-400">
                        View All
                    </button>
                </div>

                {/* Show entries & Search row */}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-2">
                        <label className="text-gray-700">Show</label>
                        <input
                            type="number"
                            className="border border-gray-300 rounded px-2 py-1 w-16"
                            defaultValue={10}
                        />
                        <span>entries</span>
                    </div>
                    <div className="flex items-center">
                        <label className="text-gray-700 mr-2">Search:</label>
                        <input
                            type="text"
                            className="border border-gray-300 rounded px-2 py-1"
                        />
                    </div>
                </div>

                {/* Table */}
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2 border-gray-300 text-left">
                            <th className="p-2">Name</th>
                            <th className="p-2">Created Date</th>
                            <th className="p-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="p-2">camp1</td>
                            <td className="p-2">February 25th 2025, 2:21:18 pm</td>
                            <td className="p-2">
                                <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm">
                                    In progress
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="mt-4 flex justify-between items-center">
                    <span className="text-gray-600">Showing 1 to 1 of 1 entries</span>
                    <div className="flex items-center space-x-2">
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
            </div>
        </>
    )
}

export default RecentCampaigns