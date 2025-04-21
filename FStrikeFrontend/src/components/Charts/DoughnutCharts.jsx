import React from 'react'
import { Doughnut } from 'react-chartjs-2';

function DoughnutCharts() {

     /* ----------------------------- Donut Chart Data ---------------------------- */
  // Utility function to build a donut dataset. 
  // For example, (1,5) means "1" is the highlighted slice, total 5 => the other slice is 4.
  const getDonutData = (value, total) => ({
    labels: ["Value", "Remainder"],
    datasets: [
      {
        data: [value, total - value],
        backgroundColor: ["#10B981", "#E5E7EB"], // green-500 and gray-200
        borderWidth: 0
      }
    ]
  });

  // Shared donut chart options
  const donutOptions = {
    cutout: "65%", // thickness of the donut
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      datalabels: {
        // Only display the label on the first slice (index 0).
        display: (ctx) => ctx.dataIndex === 0,
        color: "#000",
        formatter: (value) => value,
        anchor: "center",
        align: "center",
        offset: 0,
        font: {
          size: 14,
          weight: "bold"
        }
      }
    }
  };


  return (
    <>
    {/* Donut Charts Section */}
    <div className="grid grid-cols-5 gap-4 mb-6">
        {/* 1. Email Sent */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20">
            <Doughnut data={getDonutData(1, 5)} options={donutOptions} />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-700">Email Sent</p>
        </div>

        {/* 2. Email Opened */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20">
            <Doughnut data={getDonutData(1, 5)} options={donutOptions} />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-700">Email Opened</p>
        </div>

        {/* 3. Clicked Link */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20">
            <Doughnut data={getDonutData(1, 5)} options={donutOptions} />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-700">Clicked Link</p>
        </div>

        {/* 4. Submitted Data */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20">
            <Doughnut data={getDonutData(1, 5)} options={donutOptions} />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-700">Submitted Data</p>
        </div>

        {/* 5. Email Reported */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20">
            <Doughnut data={getDonutData(1, 5)} options={donutOptions} />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-700">Email Reported</p>
        </div>
      </div>
    </>
  )
}

export default DoughnutCharts