const { contextBridge, ipcRenderer } = require('electron');


// Set global language
window.language = 'en-US';

// Use `contextBridge` to securely expose limited APIs
contextBridge.exposeInMainWorld('electron', {
  getCurrentUrl: () => ipcRenderer.invoke('get-current-url'),

  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },

  onUpdateReady: (callback) => ipcRenderer.on('update-ready', (_, version) => callback(version)),
  installUpdate: () => ipcRenderer.send('install-update'),

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
  // Listen for BIOS data sent by the main process
  onBiosData: (callback) => ipcRenderer.on('bios-data', (event, data) => callback(data)),
  
  // Use ipcRenderer.invoke to handle promises and errors
  changeDbName: (newDbName) => {
    ipcRenderer.invoke('change-db-name', newDbName)
      .then((result) => {
        console.log(`Database updated: ${result}`);
      })
      .catch((err) => {
        console.error('Error updating DB name:', err);
      });
  },

  // Listen for custom events
  onCustomEvent: (channel, callback) => {
    ipcRenderer.on(channel, (event, data) => callback(data));
  },
});