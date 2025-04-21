import React from "react";
import { FaExclamationCircle } from "react-icons/fa";

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, name = "", text = "" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-opacity-30 backdrop-blur-md">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 text-center">
        <FaExclamationCircle className="text-orange-300 text-6xl mx-auto mb-2" />
        <h2 className="text-xl font-semibold text-gray-800">Are you sure?</h2>
        <p className="text-gray-600 mt-2">This will delete the {text}. This can't be undone!</p>
        <div className="mt-4 flex justify-center gap-4">
          <button
            className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 border-2 border-blue-600 cursor-pointer"
            onClick={onConfirm}
          >
            Delete {name}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
