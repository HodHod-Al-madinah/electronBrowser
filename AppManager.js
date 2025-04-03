const { app, autoUpdater } = require('electron');
const path = require('path');
const NetworkManager = require('./NetworkManager');
const TimeManager = require('./TimeManager');
const WindowManager = require('./WindowManager');

class AppManager {
    constructor() {
        this.windowManager = new WindowManager(100, "mobi", path.join(__dirname, '../preload.js'));
    }

    async start() {
        await app.whenReady();

        await this.windowManager.createWindow();

        NetworkManager.checkOnlineAlert();
        await TimeManager.checkDateTime();

        setInterval(() => {
            NetworkManager.checkOnlineAlert();
            TimeManager.checkDateTime();
        }, 10 * 1000);

        autoUpdater.checkForUpdatesAndNotify().catch(console.error);
    }
}

module.exports = AppManager;
