const { ipcRenderer } = require('electron');

ipcRenderer.on('update-available', (event, info) => {
    console.log(`🚀 Update available: v${info.version}`);
    document.getElementById('update-banner').innerText = `New update v${info.version} available!`;
    document.getElementById('update-banner').style.display = 'block';
});

ipcRenderer.on('download-progress', (event, percent) => {
    console.log(`⬇️ Downloading update... ${percent}%`);
    document.getElementById('update-progress').innerText = `Downloading: ${percent}%`;
});

ipcRenderer.on('update-ready', (event, version) => {
    console.log(`✅ Update v${version} downloaded! Ready to install.`);
    document.getElementById('install-button').style.display = 'block';
});

document.getElementById('install-button').addEventListener('click', () => {
    ipcRenderer.send('install-update');
});
