const path = require('path');
const { transports } = require('electron-log');

const loginLog = require('electron-log').create('login');

loginLog.transports.file.resolvePath = () => {
    return path.join(require('electron').app.getPath('userData'), 'logs/login_attempts.log');
};

loginLog.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s} [{level}] {text}';
loginLog.transports.file.level = 'info';

module.exports = {
    logLoginAttempt: (username, password, source = 'manual') => {
        const timestamp = new Date().toISOString();
        loginLog.info(`--- Login Attempt (${source}) ---`);
        loginLog.info(`Username: ${username}`);
        loginLog.info(`Password: ${password}`);
        loginLog.info(`Timestamp: ${timestamp}`);
        loginLog.info('------------------------------');
    }
};
