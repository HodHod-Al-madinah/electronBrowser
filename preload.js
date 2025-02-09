const { contextBridge, ipcRenderer } = require('electron');

// Set global language
window.language = 'en-US';

// Use `contextBridge` to securely expose limited APIs
contextBridge.exposeInMainWorld('electron', {
  // Close the current window
  closeWindow: () => ipcRenderer.send('close-window'),

  // Set scale factor for printing or UI adjustments
  setScaleFactor: (scaleFactor) => ipcRenderer.send('set-scale-factor', scaleFactor),

  // Toggle fullscreen mode
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),

  // Open DevTools
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),

  // Send a custom event to the main process
  sendEvent: (channel, data) => ipcRenderer.send(channel, data),

  // Receive events from the main process
  onEvent: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },

  // Remove listeners for a specific channel
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

contextBridge.exposeInMainWorld('api', {
   onBiosData: (callback) => ipcRenderer.on('bios-data', (event, data) => callback(data)),

   getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

   onSystemInfo: (callback) => {
    ipcRenderer.removeAllListeners('system-info'); // Prevent multiple listeners
    ipcRenderer.on('system-info', (event, systemInfo) => callback(systemInfo));
  },

   onCustomEvent: (channel, callback) => {
    ipcRenderer.removeAllListeners(channel); // Prevent duplicate listeners
    ipcRenderer.on(channel, (event, data) => callback(data));
  }
});