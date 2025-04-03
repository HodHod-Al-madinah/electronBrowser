const { exec } = require('child_process');
const fetch = require('node-fetch');
const { dialog } = require('electron');
const log = require('electron-log');

class TimeManager {
 
    static isAdmin() {
        try {
            require('child_process').execSync('NET SESSION', { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    static async checkDateTime() {
        try {
            const systemTime = new Date();
            const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Riyadh');
            const data = await response.json();
            const actualTime = new Date(data.dateTime);
            const diffInSeconds = Math.abs(actualTime - systemTime) / 1000;

            if (diffInSeconds > 120) {
                if (!this.isAdmin()) {
                    dialog.showMessageBoxSync({
                        type: 'error',
                        title: 'Admin Rights Required',
                        message: 'يرجى تشغيل التطبيق كمسؤول لتحديث وقت النظام تلقائيًا.',
                        buttons: ['OK']
                    });
                    return false;
                }

                await this.setSystemTime(actualTime);
            }

            return true;
        } catch (err) {
            log.error("❌ Error in checkDateTime():", err);
            return true;
        }
    }

    static setSystemTime(newTime) {
        return new Promise((resolve, reject) => {
            const dateStr = newTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            const timeStr = newTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const command = `powershell -Command "Set-Date -Date '${dateStr} ${timeStr}'"`;

            exec(command, { windowsHide: true }, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
}

module.exports = TimeManager;
