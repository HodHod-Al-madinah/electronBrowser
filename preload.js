const { contextBridge, ipcRenderer } = require('electron');

// Language (global fallback, safe only in dev)
window.language = 'en-US';

// Secure contextBridge exposure
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    // Safely send events to main process
    send: (channel, ...args) => {
      const validChannels = [
        'minimize-window',
        'maximize-window',
        'close-window',
        'change-db-name',
        'toggle-fullscreen',
        'install-update',
        'set-scale-factor',
        'toggle-devtools',
       ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },

    // Safely invoke channels expecting a response
    invoke: (channel, ...args) => {
      const validChannels = [
        'prompt-scale-factor',
        'get-current-url',
        'change-db-name',
      ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
    },

    // Listen for events from main
    on: (channel, callback) => {
      const validChannels = [
        'update-ready',
        'download-progress',
        'update-started',
        'bios-data'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
      }
    },

    // Remove all listeners
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  },

  // Shortcuts for common events
  onUpdateReady: (callback) => ipcRenderer.on('update-ready', (_, version) => callback(version)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, percent) => callback(percent)),
  installUpdate: () => ipcRenderer.send('install-update'),

  closeWindow: () => ipcRenderer.send('close-window'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
});

// Optional second namespace if needed
contextBridge.exposeInMainWorld('api', {
  onBiosData: (callback) => {
    ipcRenderer.on('bios-data', (event, data) => callback(data));
  },

  // DB change with built-in error handling
  changeDbName: (newDbName) => {
    ipcRenderer.invoke('change-db-name', newDbName)
      .then((result) => {
        console.log(`✅ Database changed to: ${result}`);
      })
      .catch((err) => {
        console.error('❌ Failed to change DB:', err);
      });
  },

  // Catch-all custom listener
  onCustomEvent: (channel, callback) => {
    ipcRenderer.on(channel, (event, data) => callback(data));
  }
});


window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  const { channel, payload } = event.data || {};

  if (channel === 'log-attempt' && payload) {
    ipcRenderer.send('log-attempt', payload);
  }
});