const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require("electron-log");
const fs = require('fs');
const path = require('path');
const { getWMICInfo } = require('./helpers/biosHelper');
const { convertToPDF } = require('./helpers/pdfHelper');
const { convertToJPG } = require('./helpers/jpgHelper');
const { promptForScaleFactor } = require('./helpers/scaleHelper');
const { printInvoiceWindow } = require('./helpers/printHelper');
const { printInvoiceWindowA4 } = require('./helpers/printHelper');
const { buildInvoiceMenu } = require('./helpers/menuHelper');
const fetch = require('node-fetch');
const { exec } = require('child_process');



/*
const AppManager = require('./AppManager');
const appManager = new AppManager();

appManager.start();

*/



log.info('🚀 App started');

const appVersion = app.getVersion();

const updateInfoPath = path.join(app.getPath('userData'), 'last_update.json');
let lastUpdatedAt = '-';

//do
if (fs.existsSync(updateInfoPath)) {
    try {
        const savedUpdate = JSON.parse(fs.readFileSync(updateInfoPath, 'utf8'));
        lastUpdatedAt = new Date(savedUpdate.updatedAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch (e) {
        console.error('❌ Failed to read last update date:', e);
    }
}




//do
async function isOnline() {
    try {
        const response = await fetch('https://www.google.com', { method: 'HEAD', timeout: 3000 });
        return response.ok;
    } catch (error) {
        log.warn("📡 Network check failed:", error);
        return false;
    }
}


//do
async function checkNetworkPowerShellAlertOnly() {
    const command = `powershell -Command "(Test-Connection -ComputerName www.google.com -Count 1 -Quiet)"`;
    exec(command, { windowsHide: true }, (error, stdout, stderr) => {
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


//do
function checkNetworkPowerShell() {
    return new Promise((resolve, reject) => {
        const psCommand = `powershell -Command "(Test-Connection -ComputerName www.google.com -Count 1 -Quiet)"`;

        exec(psCommand, { windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                console.error("❌ PowerShell network check error:", error);
                return resolve(false);
            }

            const isOnline = stdout.toString().trim() === "True";
            console.log(`📡 PowerShell Network Check: ${isOnline ? 'Online' : 'Offline'}`);
            resolve(isOnline);
        });
    });
}


//do
function setSystemTime(newTime) {
    log.info('⚙️ Executing command to set time...');

    return new Promise((resolve, reject) => {
        const dateStr = newTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        const timeStr = newTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const command = `powershell -Command "Set-Date -Date '${dateStr} ${timeStr}'"`;
        console.log("⏰ Setting system time with:", command);

        exec(command, { windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error setting system time:`, stderr || error);
                reject(error);
            } else {
                console.log(`✅ System time updated to: ${newTime}`);
                resolve();
            }
        });
    });
}


// do
function isAdmin() {
    try {
        require('child_process').execSync('NET SESSION', { stdio: 'ignore' });
        console.log("✅ Running as Admin");
        return true;
    } catch (e) {
        console.log("❌ Not running as Admin");
        return false;
    }
}


//do
async function checkDateTime() {
    log.info('⏱ checkDateTime() started');

    try {
        log.info("⏱ Checking system time...");

        const systemTime = new Date();
        const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Riyadh');
        const data = await response.json();
        const actualTime = new Date(data.dateTime);

        const diffInSeconds = Math.abs(actualTime - systemTime) / 1000;
        log.info(`⏱ Time difference: ${diffInSeconds} seconds`);

        if (diffInSeconds > 120) {
            log.warn("⚠️ System time is wrong");

            if (!isAdmin()) {
                log.warn("🛑 Not running as admin");
                dialog.showMessageBoxSync({
                    type: 'error',
                    title: 'Admin Rights Required',
                    message: 'يرجى تشغيل التطبيق كمسؤول لتحديث وقت النظام تلقائيًا.',
                    buttons: ['OK']
                });
                return false;  
            }

            log.info("✅ Admin confirmed, setting system time...");
            await setSystemTime(actualTime);
        }

        return true;

    } catch (err) {
        log.error("❌ Error in checkDateTime():", err);
        return true;  
    }
}


let mainWindow;
let scaleFactor = 100;

process.env.LANG = 'en-US';
app.commandLine.appendSwitch('lang', 'en-US');

const dbFilePath = path.join(app.getPath('userData'), 'selected_db.json');
let dbName = loadStoredDb();

//
ipcMain.on('change-db-name', (event, newDbName) => {
    if (dbName !== newDbName) {
        try {
            fs.writeFileSync(dbFilePath, JSON.stringify({ db: newDbName }), 'utf8');
            console.log(`✅ Database updated to ${newDbName}`);
            dbName = newDbName;
            if (mainWindow) {
                mainWindow.loadURL(`https://www.mobi-cashier.com/${dbName}/get/`);
            }
        } catch (error) {
            console.error("❌ Error updating database name:", error);
        }
    } else {
        console.log("Database already set to 'mobi'; no update needed.");
    }
});


//online
function extractDbName(url) {
    const match = url.match(/https:\/\/www\.mobi-cashier\.com\/([^/]+)\/get/);
    return match ? match[1] : null;
}


//
function loadStoredDb() {
    if (fs.existsSync(dbFilePath)) {
        try {
            const storedData = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
            if (storedData.db && storedData.db.trim().length > 0) {
                console.log(`✅ Loaded DB from file: ${storedData.db}`);
                return storedData.db;
            }
        } catch (error) {
            console.error('❌ Error reading stored DB, using default:', error);
        }
    }
    console.log("🔹 No DB file found or invalid, defaulting to 'mobi'");
    return "mobi";
}

//
function loadSettings() {
    try {
        const settingsFile = path.join(app.getPath('userData'), 'settings.json');

        if (!fs.existsSync(settingsFile)) {
            console.log('⚠️ No settings.json found. Creating a new one with defaults.');
            const defaultSettings = { scaleFactor: 100 };
            fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf8');
        }

        const data = fs.readFileSync(settingsFile);
        const settings = JSON.parse(data);

        if (settings.scaleFactor) {
            scaleFactor = settings.scaleFactor;
        }
    } catch (error) {
        console.error('❌ Error loading settings:', error);
    }
}


let hasReloadedOnce = false;

//
async function createWindow() {
    log.info('🪟 createWindow() called');

    loadSettings();
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,  

        icon: path.join(__dirname, 'image', 'mobi_logo.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        frame: false,  
        title: 'mobiCashier',
        autoHideMenuBar: true,
    });


   
    const targetUrl = `https://www.mobi-cashier.com/${dbName}/get/`;

     await mainWindow.loadURL(targetUrl);

 
     mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.show();
        mainWindow.maximize();
    });





    mainWindow.maximize();
    mainWindow.setSkipTaskbar(false);

 
    const systemInfo = await getWMICInfo();
    const processorId = systemInfo.processorId;
    const uuid = systemInfo.uuid;
    const motherboardSerial = systemInfo.motherboardSerial;


    //do
    ipcMain.handle('prompt-scale-factor', async () => {
        scaleFactor = await promptForScaleFactor(mainWindow, scaleFactor);
        return scaleFactor;
    });

    //do
     mainWindow.webContents.on('did-navigate', (event, url) => {
        mainWindow.webContents.executeJavaScript(`
        // Remove existing title bar if present
        let existingTitleBar = document.getElementById('customTitleBar');
        if (existingTitleBar) {
            existingTitleBar.remove();
        }
        
        const titleBar = document.createElement('div');
        titleBar.id = 'customTitleBar';
        titleBar.style.position = 'fixed';
        titleBar.style.top = '0';
        titleBar.style.left = '0';
        titleBar.style.right = '0';
        titleBar.style.height = '25px';
        titleBar.style.background = window.isFocused ? '#e5e5e5' : '#f0f0f0';
        titleBar.style.display = 'flex';
        titleBar.style.alignItems = 'center';
        titleBar.style.justifyContent = 'space-between';
        titleBar.style.zIndex = '1000';
        titleBar.style.webkitAppRegion = 'drag';
        titleBar.style.padding = '0';

        const buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.webkitAppRegion = 'no-drag';
        buttons.style.marginLeft = '0';

         const printerBtn = document.createElement('button');
        printerBtn.innerHTML = '🖨️';
        printerBtn.style.width = '25px';
        printerBtn.style.height = '25px';
        printerBtn.style.background = 'transparent';
        printerBtn.style.border = 'none';
        printerBtn.style.color = '#000000';
        printerBtn.style.fontSize = '12px';
        printerBtn.style.cursor = 'pointer';
        printerBtn.style.marginRight = '12px';
        printerBtn.title = 'Set Scale Factor';
        printerBtn.onmouseover = () => printerBtn.style.background = '#d4d4d4';
        printerBtn.onmouseout = () => printerBtn.style.background = 'transparent';
        printerBtn.onmousedown = () => printerBtn.style.background = '#c0c0c0';
        printerBtn.onmouseup = () => printerBtn.style.background = '#d4d4d4';
        printerBtn.onclick = () => window.electron.ipcRenderer.invoke('prompt-scale-factor');

         const reloadBtn = document.createElement('button');
        reloadBtn.id = 'reloadBtn';
        reloadBtn.innerHTML = '↻';
        reloadBtn.style.width = '25px';
        reloadBtn.style.height = '25px';
        reloadBtn.style.background = 'transparent';
        reloadBtn.style.border = 'none';
        reloadBtn.style.color = '#000000';
        reloadBtn.style.fontSize = '18px';
        reloadBtn.title = 'Reload';
        reloadBtn.style.cursor = 'pointer';
        reloadBtn.style.marginRight = '4px';
        reloadBtn.onmouseover = () => reloadBtn.style.background = '#d4d4d4';
        reloadBtn.onmouseout = () => reloadBtn.style.background = 'transparent';
        reloadBtn.onmousedown = () => reloadBtn.style.background = '#c0c0c0';
        reloadBtn.onmouseup = () => reloadBtn.style.background = '#d4d4d4';
        reloadBtn.onclick = () => window.location.reload();

         const minBtn = document.createElement('button');
        minBtn.innerHTML = '−';
        minBtn.style.width = '25px';
        minBtn.style.height = '25px';
        minBtn.style.background = 'transparent';
        minBtn.style.border = 'none';
        minBtn.style.color = '#000000';
        minBtn.style.fontSize = '18px';
        minBtn.style.cursor = 'pointer';
        minBtn.title = 'Minimize';
        minBtn.style.marginRight = '4px';
        minBtn.onmouseover = () => minBtn.style.background = '#d4d4d4';
        minBtn.onmouseout = () => minBtn.style.background = 'transparent';
        minBtn.onmousedown = () => minBtn.style.background = '#c0c0c0';
        minBtn.onmouseup = () => minBtn.style.background = '#d4d4d4';
        minBtn.onclick = () => window.electron.ipcRenderer.send('minimize-window');

         const maxBtn = document.createElement('button');
        maxBtn.innerHTML = '□';
        maxBtn.style.width = '25px';
        maxBtn.style.height = '25px';
        maxBtn.style.background = 'transparent';
        maxBtn.style.border = 'none';
        maxBtn.style.color = '#000000';
        maxBtn.style.fontSize = '16px';
        maxBtn.style.cursor = 'pointer';
        maxBtn.title = 'Maximize';
        maxBtn.style.marginRight = '4px';
        maxBtn.onmouseover = () => maxBtn.style.background = '#d4d4d4';
        maxBtn.onmouseout = () => maxBtn.style.background = 'transparent';
        maxBtn.onmousedown = () => maxBtn.style.background = '#c0c0c0';
        maxBtn.onmouseup = () => maxBtn.style.background = '#d4d4d4';
        maxBtn.onclick = () => window.electron.ipcRenderer.send('maximize-window');

         const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.width = '25px';
        closeBtn.style.height = '25px';
        closeBtn.style.background = 'transparent';
        closeBtn.style.border = 'none';
        closeBtn.style.color = '#000000';
        closeBtn.style.fontSize = '14px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.title = 'Close';
        closeBtn.style.marginLeft = '0';
        closeBtn.style.marginRight = '4px';
        closeBtn.onmouseover = () => closeBtn.style.background = '#e81123';
        closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
        closeBtn.onmousedown = () => closeBtn.style.background = '#c42b1c';
        closeBtn.onmouseup = () => closeBtn.style.background = '#e81123';
        closeBtn.onclick = () => window.electron.ipcRenderer.send('close-window');

         buttons.appendChild(closeBtn);
        buttons.appendChild(maxBtn);
        buttons.appendChild(minBtn);
        buttons.appendChild(reloadBtn);
        buttons.appendChild(printerBtn);



        const title = document.createElement('div');
            title.textContent = "mobiCashier  v${appVersion}  (${lastUpdatedAt})";
            title.style.fontSize = '12px';
            title.style.color = '#333';
            title.style.fontWeight = 'normal';
            title.style.marginLeft = '5px';
            title.style.webkitAppRegion = 'drag';


             const timeDisplay = document.createElement('div');
            timeDisplay.id = 'timeDisplay';
            timeDisplay.style.position = 'absolute';
            timeDisplay.style.left = '50%';
            timeDisplay.style.transform = 'translateX(-50%)';
            timeDisplay.style.fontSize = '15px';
            timeDisplay.style.color = 'blue';
            timeDisplay.style.fontWeight = 'normal';
            timeDisplay.style.webkitAppRegion = 'no-drag';
            titleBar.appendChild(timeDisplay);

         function updateTime() {
                const now = new Date();

                const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });

                 const date = now.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });

                 const time = now.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });

                     timeDisplay.textContent = weekday + "    " + date + "    " + time;
            }

            updateTime();
            setInterval(updateTime, 1000);




         titleBar.appendChild(buttons);
        titleBar.appendChild(title);

         document.body.style.paddingTop = '25px';
        document.body.style.height = 'calc(100vh - 25px)'; // Adjust height to fit viewport
        document.body.style.overflowY = 'auto'; // Allow content scrolling if needed

        document.body.insertBefore(titleBar, document.body.firstChild);

         window.onfocus = () => {
            titleBar.style.background = '#e5e5e5';
        };
        window.onblur = () => {
            titleBar.style.background = '#f0f0f0';
        };
    `).catch(error => {
            console.error("Error injecting custom title bar:", error);
        });
    });


    //do
    ipcMain.on('minimize-window', () => mainWindow.minimize());
    ipcMain.on('maximize-window', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });

    //do
    ipcMain.on('close-window', () => {
        console.log("Close window requested");
        mainWindow.close();
    });

    //do
    mainWindow.on('focus', () => {
        mainWindow.webContents.executeJavaScript(`
            const titleBar = document.getElementById('customTitleBar');
            if (titleBar) titleBar.style.background = '#e5e5e5';
        `).catch(error => {
            console.error("Error executing login script:", error);
        });
    });

    //do
    mainWindow.on('blur', () => {
        mainWindow.webContents.executeJavaScript(`
            const titleBar = document.getElementById('customTitleBar');
            if (titleBar) titleBar.style.background = '#f0f0f0';
        `).catch(error => {
            console.error("Error executing login script:", error);
        });
    });

    //do
    mainWindow.webContents.on('did-finish-load', async () => {

      
        mainWindow.webContents.executeJavaScript(`

         window.electron.ipcRenderer.on('update-started', () => {
                let overlay = document.getElementById('updateOverlay');
             if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'updateOverlay';
                overlay.style.position = 'fixed';
                overlay.style.top = 0;
                overlay.style.left = 0;
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
                overlay.style.display = 'flex';
                overlay.style.alignItems = 'center';
                overlay.style.justifyContent = 'center';
                overlay.style.zIndex = 9999;

                const messageBox = document.createElement('div');
                messageBox.style.backgroundColor = '#ffffff';  
                messageBox.style.padding = '30px 40px';
                messageBox.style.borderRadius = '12px';
                messageBox.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
                messageBox.style.textAlign = 'center';
                messageBox.style.color = '##00ff99';
                messageBox.style.minWidth = '320px';
                messageBox.style.maxWidth = '90%';

                const statusMsg = document.createElement('div');
                statusMsg.id = 'updateStatus';
                statusMsg.textContent = '📦 جاري تحميل التحديث الجديد...';
                statusMsg.style.fontSize = '20px';
                statusMsg.style.marginBottom = '15px';


                const progress = document.createElement('div');
                progress.id = 'updateProgress';
                progress.textContent = '0%';
                progress.style.fontSize = '18px';
                progress.style.marginTop = '5px';

                messageBox.appendChild(statusMsg);
                messageBox.appendChild(progress);
                overlay.appendChild(messageBox);

                document.body.appendChild(overlay);
            }

         });
        
             window.electron.ipcRenderer.on('download-progress', (percent) => {
                const progressEl = document.getElementById('updateProgress');
                if (progressEl) {
                    progressEl.textContent = percent + '%';
                }
            });
           
             window.electron.ipcRenderer.on('update-ready', () => {
                const statusMsg = document.getElementById('updateStatus');
                const progressEl = document.getElementById('updateProgress');
        
                if (statusMsg) statusMsg.remove();
                if (progressEl) progressEl.remove();
        
                const overlay = document.getElementById('updateOverlay');
                if (overlay) {
                    const doneMsg = document.createElement('div');
                    doneMsg.textContent = '✅ تم تحميل التحديث ، قم بتشغيل التطبيق   ...';
                    doneMsg.style.fontSize = '22px';
                    doneMsg.style.color = '#00ff99';
                    doneMsg.style.marginTop = '10px';
                    overlay.appendChild(doneMsg);
        
                    setTimeout(() => {

                                console.log("🧪 Force quitting app...>>");
                                 window.close();
   
                        }, 2000);     
                }
            });  
        `).catch(error => {
            console.error("❌ Error injecting update overlay script:", error);
        });


 
        const rawSerial = `${processorId}-${uuid}-${motherboardSerial}`;
        const serial = rawSerial.replace(/\//g, '');

        mainWindow.webContents.executeJavaScript(`
            $(document).ready(() => {



                const pending = localStorage.getItem('pendingLogin');
        if (pending) {
            const { username, password } = JSON.parse(pending);
            const dbName = localStorage.getItem('dbName') || 'mobi';
            const serial = "${serial}";
            const csrfToken = $('meta[name="csrf-token"]').attr('content');

            localStorage.removeItem('pendingLogin');

            $.ajax({
                url: '/login',
                type: 'POST',
                headers: { 'X-CSRF-TOKEN': csrfToken },
                data: { username, password, serial, dbName },
                success: function(response) {
                    console.log("✅ Auto login successful");
                    window.location.href = window.location.origin + '/' + response.router;
                },
                error: function(xhr, status, error) {
                    console.log("❌ Auto login failed:", error);
                    showErrorToast('خطأ', 'فشل تسجيل الدخول التلقائي');
                }
            });
        }






                $('#name').focus();
    
                $(document).off('click', '.login').on('click', '.login', (event) => {
                    let username = $('#name').val();
                    let password = $('#password').val();
                    let serial = "${serial}"; 
                    let dbName = localStorage.getItem('dbName') || 'mobi'; 
                    const csrfToken = $('meta[name="csrf-token"]').attr('content');



                 if (validateData(username, password)) {
                          
                     if (username === 'hamzeh' && password === '123') {
                        if(dbName !== 'mobi') {
                            const newDb = 'mobi';
                                    localStorage.setItem('dbName', newDb);
                                     dbName = newDb;
                                     localStorage.setItem('pendingLogin', JSON.stringify({ username, password }));
                                     window.api.changeDbName(newDb);
                                     setTimeout(() => {
                                    window.location.href = "https://www.mobi-cashier.com/" + newDb + "/get/";
                                  
                                    }, 300);
                                    return;  
                                      }
                                  
                                }


    
                         $.ajax({
                            url: '/login',
                            type: 'POST',
                            headers: { 'X-CSRF-TOKEN': csrfToken },
                            data: { username, password, serial, dbName },
                            success: function(response) {
                                console.log("✅ Login successful, redirecting...");
                                window.location.href = window.location.origin + '/' + response.router;
                            },
                            error: function(xhr, status, error) {
                                console.log("❌ Login failed:", error);
                                showErrorToast('خطأ', 'خطأ في تسجيل الدخول');
                            }
                        });
                    }
                });
    
                function validateData(username, password) {
                    let isValid = true;
    
                    if (username.trim().length === 0) {
                        $('.GroupName').addClass('is-invalid');
                        $('.name-error').text('يجب ادخال الاسم');
                        isValid = false;
                    } else {
                        $('.GroupName').removeClass('is-invalid');
                        $('.name-error').text('');
                    }
    
                    if (password.trim().length === 0) {
                        $('.GroupPassword').addClass('is-invalid');
                        $('.password-error').text('يجب ادخال كلمة المرور');
                        isValid = false;
                    } else {
                        $('.GroupPassword').removeClass('is-invalid');
                        $('.password-error').text('');
                    }
    
                    return isValid;
                }
    
                function showErrorToast(title, message) { 
                    let toast = document.createElement('div');
                    toast.className = 'custom-toast custom-error';
                    toast.style.display = 'none';
                    toast.innerHTML = \`
                        <div class="custom-toast-header">\${title}</div>
                        <div class="custom-toast-body">\${message}</div>\`;
                    
                    document.body.appendChild(toast);
                    $(toast).fadeIn(100);
                    
                    setTimeout(() => {
                        $(toast).fadeOut(200, function() {
                            $(this).remove();
                        });
                    }, 2000);
                }
            });
        `).catch(error => {
            console.error("Error executing login script:", error);
        });
    });

    //do
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        const key = url.includes('https://www.mobi-cashier.com/invoice-print');

        if (key) {
            const printWindow = new BrowserWindow({
                width: 800,
                height: 900,
                show: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                },
                menuBarVisible: false, 
            });

            printWindow.setMenu(null);

            printWindow.loadURL(url);

            printWindow.webContents.once('did-finish-load', () => {
                 printWindow.webContents.executeJavaScript(`
                    const style = document.createElement('style');
                    style.textContent = \`
                        @media print {
                            .print-button {
                                display: none !important;
                            } }
                    \`;
                    document.head.appendChild(style);

                    const btn = document.createElement('button');
                    btn.textContent = '🖨️ ';
                    btn.className = 'print-button';
                    btn.style.position = 'fixed';
                    btn.style.top = '20px';
                    btn.style.right = '20px';
                    btn.style.padding = '10px 20px';
                    btn.style.fontSize = '16px';
                    btn.style.backgroundColor = '#2563EB';
                    btn.style.color = 'white';
                    btn.style.border = 'none';
                    btn.style.borderRadius = '8px';
                    btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
                    btn.style.cursor = 'pointer';
                    btn.style.zIndex = '9999';
                    btn.onclick = () => window.print();
                    document.body.appendChild(btn);
                `);
            });


            return { action: 'deny' };
        }

        else if (
            url.startsWith('https://www.mobi-cashier.com/invoice') ||
            url.includes('https://www.mobi-cashier.com/period-report-htm')
        ) {
            const invoiceWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true,
                },
                menuBarVisible: false,
            });

            invoiceWindow.setMenu(null);  
            invoiceWindow.loadURL(url);

            const invoiceMenuTemplate = buildInvoiceMenu(
                convertToPDF,
                convertToJPG,
                promptForScaleFactor,
                invoiceWindow
            );

            const invoiceMenu = Menu.buildFromTemplate(invoiceMenuTemplate);
            invoiceWindow.setMenu(invoiceMenu);

            invoiceWindow.webContents.on('did-finish-load', () => {
                if (url.includes('/invoice/a4')) {
                    printInvoiceWindowA4(invoiceWindow, scaleFactor);
                } else {
                    printInvoiceWindow(invoiceWindow, scaleFactor);
                }
            });

            return { action: 'deny' };
        } else {
            shell.openExternal(url);
            return { action: 'deny' };
        }
    });

    //do
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
            $(document).ready(() => {
                 $(document).on('keydown', (event) => {
                    if (event.key === 'F12') {
                        window.close();
                    } else if (event.key === 'F5') {
                        location.reload();
                    } else if (event.key === 'F11') {
                        require('electron').ipcRenderer.send('toggle-fullscreen');
                    } else if (event.key === 'Enter') {
                        const $currentElement = $(document.activeElement);
                        
                         if ($currentElement.attr('id') === 'name') {
                            $('#password').focus();
                        } else if ($currentElement.attr('id') === 'password') {
                            $('.login').click();
                        }
                    }
                });
    
                 $(document).on('click', (event) => {
                    if ($(event.target).attr('id') === 'exitButton') {
                        window.close();
                    }
                });
            });
        `).catch(error => {
            console.error("Error executing login script:", error);
        });
    });

    //
    mainWindow.webContents.on('did-navigate', (event, url) => {
        console.log(`📢 URL Changed: ${url}`);

        const newDbName = extractDbName(url);

        if (newDbName && newDbName !== dbName) {
            console.log(`✅ Extracted DB Name: ${newDbName}`);
            dbName = newDbName;

            try {
                fs.writeFileSync(dbFilePath, JSON.stringify({ db: dbName }), 'utf8');
                console.log("✅ Database selection saved.");
            } catch (error) {
                console.error("❌ Error saving database:", error);
            }
        } else if (!newDbName) {
            console.log("⚠️ No valid DB name found in URL, keeping current DB.");

            if (dbName !== loadStoredDb()) {
                console.log("🔄 Redirecting to last saved DB...");
                dbName = loadStoredDb();
                mainWindow.loadURL(`https://www.mobi-cashier.com/${dbName}/get/`);
            }
        }
    });

    //do
    ipcMain.on('open-print-window', () => {
        openPrintWindow();
    });

    //do
    mainWindow.webContents.on('context-menu', (event, params) => {
        const menu = Menu.buildFromTemplate([
            {
                label: 'Back',
                enabled: mainWindow.webContents.canGoBack(),
                click: () => mainWindow.webContents.goBack(),
            },
            {
                label: 'Forward',
                enabled: mainWindow.webContents.canGoForward(),
                click: () => mainWindow.webContents.goForward(),
            },
            { type: 'separator' },
            {
                label: 'Reload',
                click: () => mainWindow.webContents.reload(),
            },
            { type: 'separator' },
            {
                label: 'Copy',
                role: 'copy',
            },
            {
                label: 'Paste',
                role: 'paste',
            },
            { type: 'separator' },
            {
                label: 'View Source',
                click: () => {
                    const url = mainWindow.webContents.getURL();
                    mainWindow.webContents.loadURL(`view-source:${url}`);
                },
            },
            {
                label: 'Inspect Element',
                click: () => mainWindow.webContents.inspectElement(params.x, params.y),
            },
        ]);
        menu.popup({
            window: mainWindow,
            x: params.x,
            y: params.y,
        });
    });

    //
    if (!hasReloadedOnce) {
        hasReloadedOnce = true;
        console.log('you are in hasReloadedOnce');
        mainWindow.webContents.reloadIgnoringCache();

    }
}



//do
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";


app.whenReady().then(async () => {
    await createWindow();

    checkNetworkPowerShellAlertOnly();

    await checkDateTime();

    setInterval(() => {
        checkNetworkPowerShellAlertOnly();
        checkDateTime();
    }, 10 * 1000);

    autoUpdater.checkForUpdatesAndNotify().catch(console.error);
});



//do
autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
});

//do
autoUpdater.on('update-available', (info) => {
    console.log(`✅ Update available: v${info.version}`);

     mainWindow.webContents.send('update-started');

    mainWindow.webContents.send('update-available', info);
});


//do
autoUpdater.on('update-not-available', () => {
    console.log('ℹ️ No update available.');
});

//do
autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.floor(progressObj.percent);
    console.log(`⬇️ Download progress: ${percent}%`);
    mainWindow.webContents.send('download-progress', percent);
});

//do
autoUpdater.on('update-downloaded', (info) => {
    console.log(`🎉 Update downloaded: v${info.version}`);
    mainWindow.webContents.send('update-ready', info.version);

    const updateInfoPath = path.join(app.getPath('userData'), 'last_update.json');
    const now = new Date().toISOString();

    try {
        fs.writeFileSync(updateInfoPath, JSON.stringify({
            version: info.version,
            updatedAt: now
        }, null, 2));

        console.log(`📝 Saved last update info: v${info.version} at ${now}`);
    } catch (err) {
        console.error("❌ Failed to save last update info:", err);
    }
});


//do
ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall(true, true);
});

//do
autoUpdater.on('error', (error) => {
    console.error('❌ AutoUpdater error:', error);
});

//do
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

//do
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

//do
ipcMain.on('restart-app', () => {
    console.log("🧪 Force quitting app...");
    app.relaunch(); 
    app.exit(0);    
});