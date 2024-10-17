const { contextBridge, remote } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  closeWindow: () => remote.getCurrentWindow().close()
});

// Expose a function to send scaleFactor to the main process
contextBridge.exposeInMainWorld('electron', {
  setScaleFactor: (scaleFactor) => ipcRenderer.send('set-scale-factor', scaleFactor)
});