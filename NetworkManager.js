const { dialog } = require('electron');
const { exec } = require('child_process');

class NetworkManager {
    static checkOnlineAlert() {
        const command = `powershell -Command "(Test-Connection -ComputerName www.google.com -Count 1 -Quiet)"`;
        exec(command, { windowsHide: true }, (error, stdout) => {
            if (error || stdout.toString().trim() !== "True") {
                dialog.showMessageBoxSync({
                    type: 'error',
                    title: 'تنبيه - لا يوجد اتصال بالإنترنت',
                    message: '⚠️ جهازك غير متصل بالإنترنت، يرجى التحقق من الاتصال.',
                    buttons: ['موافق']
                });
            } else {
                console.log('✅ الإنترنت يعمل');
            }
        });
    }
}
module.exports = NetworkManager;
