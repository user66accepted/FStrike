import React from "react";
import { FaExclamationTriangle, FaTimes, FaTrash } from "react-icons/fa";
import { motion } from "framer-motion";

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, name = "", text = "" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="glass-card w-full max-w-md mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="relative p-6 border-b border-red-400/20">
          <div className="absolute inset-0 bg-gradient-to-r from-red-400/10 to-orange-400/10"></div>
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <FaExclamationTriangle className="text-red-400 text-2xl" />
              <h2 className="text-xl font-bold text-red-400">Confirm Deletion</h2>
            </div>
            <button 
              onClick={onClose}
              className="glass-button p-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
            >
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center">
              <FaTrash className="text-red-400 text-2xl" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-cyber-primary">
              Delete {name || text}?
            </h3>
            <p className="text-cyber-muted">
              This action cannot be undone. The {text || "item"} will be permanently removed from the system.
            </p>
          </div>

          <div className="bg-red-400/5 border border-red-400/20 p-3 rounded-lg">
            <p className="text-red-400 text-sm font-medium">
              ⚠️ This operation is irreversible
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-cyber-primary/20 px-6 py-4 space-x-3">
          <button
            onClick={onClose}
            className="glass-button px-6 py-2 rounded-lg text-cyber-muted hover:text-cyber-primary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="glass-button px-6 py-2 rounded-lg bg-red-400/10 border border-red-400/30 text-red-400 hover:bg-red-400/20 hover:scale-105 transition-all duration-200"
          >
            <div className="flex items-center space-x-2">
              <FaTrash />
              <span>Delete {name}</span>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DeleteConfirmationModal;
