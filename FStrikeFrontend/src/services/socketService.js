import { io } from 'socket.io-client';
import config from '../config/apiConfig';

// Extract the base URL without /api
const baseUrl = config.API_BASE_URL.replace(/\/api$/, '');
console.log('Socket.io connecting to:', baseUrl);

// Create socket instance with reconnection options
const socket = io(baseUrl, {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
  withCredentials: true,
  autoConnect: true,
  transports: ['polling', 'websocket'],
  extraHeaders: {
    'Origin': 'http://192.168.15.147:5173'
  }
});

// Event listeners
const eventListeners = {
  'email:opened': []
};

// Initialize the socket connection
const initSocket = () => {
  socket.on('connect', () => {
    console.log('Socket connected successfully, ID:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log(`Socket reconnected after ${attemptNumber} attempts`);
  });

  socket.on('reconnect_failed', () => {
    console.error('Socket failed to reconnect after maximum attempts');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  // Listen for email opened events
  socket.on('email:opened', (data) => {
    console.log('Email opened event received:', data);
    
    // Notify all listeners
    eventListeners['email:opened'].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in email:opened listener:', error);
      }
    });
  });

  return socket;
};

// Add event listener
const addEventListener = (event, callback) => {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  
  eventListeners[event].push(callback);
  console.log(`Added listener for ${event}, total listeners: ${eventListeners[event].length}`);
  
  // Return a function to remove the listener
  return () => {
    eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
    console.log(`Removed listener for ${event}, remaining listeners: ${eventListeners[event].length}`);
  };
};

// Remove event listener
const removeEventListener = (event, callback) => {
  if (eventListeners[event]) {
    eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
    console.log(`Removed listener for ${event}, remaining listeners: ${eventListeners[event].length}`);
  }
};

// Force socket reconnection
const reconnect = () => {
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
  console.log('Forcing socket reconnection...');
};

// Initialize socket
const socketInstance = initSocket();

export default {
  socket: socketInstance,
  addEventListener,
  removeEventListener,
  reconnect
};