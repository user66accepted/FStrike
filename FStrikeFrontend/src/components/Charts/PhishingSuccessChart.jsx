import React from 'react'
import { Line } from 'react-chartjs-2';

/* ----------------------------- Line Chart Data ----------------------------- */
const lineChartData = {
    labels: ["Feb 25 2:21 pm"], // Example label
    datasets: [
        {
            label: "Phishing Success Overview",
            data: [8], // Example data point
            borderColor: "#3B82F6", // Tailwind 'blue-500'
            backgroundColor: "#3B82F6",
            fill: false,
            tension: 0.1
        }
    ]
};

const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        tooltip: {
            callbacks: {
                // Customize tooltip content
                label: () => `camp1: 5 Success (8%)`
            }
        }
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: {
                stepSize: 2
            }
        }
    }
};

function PhishingSuccessChart() {
    return (
        <>
            {/* Phishing Success Overview (Line Chart) */}
            <div className="bg-white rounded shadow p-4 mb-6">
                <h2 className="text-xl font-semibold mb-4">Phishing Success Overview</h2>
                <div className="h-64">
                    <Line data={lineChartData} options={lineChartOptions} />
                </div>
            </div>
        </>
    )
}

export default PhishingSuccessChart