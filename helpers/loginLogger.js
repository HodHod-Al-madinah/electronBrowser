const path = require('path');
const { transports } = require('electron-log');

const loginLog = require('electron-log').create('login');

loginLog.transports.file.resolvePath = () => {
    return path.join(require('electron').app.getPath('userData'), 'logs/login_attempts.log');
};

loginLog.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s} [{level}] {text}';
loginLog.transports.file.level = 'info';

module.exports = {
    logLoginAttempt: (action, username = null, password = null, description = '-', source = 'manual') => {
        const timestamp = new Date().toISOString();
        loginLog.info(`--- Action Log (${source}) ---`);
        loginLog.info(`Action: ${action}`);
        loginLog.info(`Username: ${username ?? 'null'}`);
        loginLog.info(`Password: ${password ?? 'null'}`);
        loginLog.info(`Description: ${description}`);
        loginLog.info(`Timestamp: ${timestamp}`);
        loginLog.info('------------------------------');
    }
};