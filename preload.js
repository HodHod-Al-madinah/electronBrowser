const { contextBridge, remote } = require('electron');
const $ = require('jquery');

contextBridge.exposeInMainWorld('electron', {
  closeWindow: () => remote.getCurrentWindow().close()
});

// Expose a function to send scaleFactor to the main process
contextBridge.exposeInMainWorld('electron', {
  setScaleFactor: (scaleFactor) => ipcRenderer.send('set-scale-factor', scaleFactor)
});
contextBridge.exposeInMainWorld('api', {
  onBiosData: (callback) => ipcRenderer.on('bios-data', (event, data) => callback(data)),
});
contextBridge.exposeInMainWorld('$', $);
contextBridge.exposeInMainWorld('jQuery', $);