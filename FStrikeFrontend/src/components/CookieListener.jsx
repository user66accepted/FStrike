// src/components/CookiesListener.jsx
import React, { useState, useEffect } from 'react';
import socketService from '../services/socketService';
import { ClipboardCopy } from 'lucide-react';
import { downloadCookies } from '../services/apiService';

const CookiesListener = () => {
  // state holds a map: attemptId → full cookies array
  const [captures, setCaptures] = useState({});
  const { addEventListener } = socketService;

  useEffect(() => {
    const handleCookies = (data) => {
      const attemptId = data.attemptId ?? data.id ?? data.attempt_id;
      const incoming = Array.isArray(data.cookies) ? data.cookies : [];

      setCaptures(prev => ({
        ...prev,
        [attemptId]: incoming  // overwrite or add new full array
      }));
    };

    const unsubscribe = addEventListener('cookies:captured', handleCookies);
    return () => unsubscribe();
  }, [addEventListener]);

  const handleCopy = (attemptId) => {
    const payload = captures[attemptId] || [];
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    alert('Copied to clipboard');
  };

  if (Object.keys(captures).length === 0) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Real-Time Cookie Capture</h2>
        <p className="text-gray-500">Waiting for cookies…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(captures).map(([attemptId, cookies]) => (
        <div key={attemptId} className="p-4 bg-white rounded shadow">
          <div className="flex justify-between items-center mb-3">
            <span className="font-medium">Attempt ID: {attemptId}</span>
            <div className="flex space-x-2">
              <button
                onClick={() => downloadCookies(attemptId)}
                className="px-2 py-1 bg-blue-600 text-white text-sm rounded"
              >
                Download
              </button>
              <button
                onClick={() => handleCopy(attemptId)}
                className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                title="Copy JSON"
              >
                <ClipboardCopy size={16} />
              </button>
            </div>
          </div>

          <pre className="bg-gray-100 p-3 rounded max-h-60 overflow-auto text-xs">
            {JSON.stringify(cookies, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
};

export default CookiesListener;
