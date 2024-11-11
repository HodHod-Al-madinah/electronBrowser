const { contextBridge, ipcRenderer, remote } = require('electron');
const $ = require('jquery');

// Expose all functions and libraries in a single contextBridge call
contextBridge.exposeInMainWorld('electron', {
  closeWindow: () => remote.getCurrentWindow().close(),
  setScaleFactor: (scaleFactor) => ipcRenderer.send('set-scale-factor', scaleFactor)
});

contextBridge.exposeInMainWorld('api', {
  onBiosData: (callback) => ipcRenderer.on('bios-data', (event, data) => callback(data))
});

// Expose jQuery globally
contextBridge.exposeInMainWorld('$', $);
contextBridge.exposeInMainWorld('jQuery', $);
