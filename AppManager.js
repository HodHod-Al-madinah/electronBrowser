const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const helpers = require('./helpers/helpers');
const { exec } = require('child_process');
const fetch = require('node-fetch');
const log = require("electron-log");
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { convertToPDF } = require('./helpers/pdfHelper');
const { convertToJPG } = require('./helpers/jpgHelper');
const { promptForScaleFactor } = require('./helpers/scaleHelper');
const { buildInvoiceMenu } = require('./helpers/menuHelper');
const { printInvoiceWindow, printInvoiceWindowA4 } = require('./helpers/printHelper');
const { checkNetworkSpeed } = require('./helpers/networkSpeed');
const { time } = require('console');
const { logLoginAttempt } = require('./helpers/loginLogger');
const { showAndSetDefaultPrinter } = require('./helpers/printerHelper');
const { session } = require('electron');
const flagPath = path.join(app.getPath('userData'), 'just_updated.flag');
 




log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s} [{level}] {text}';

ipcMain.on('log-attempt', (event, { action, username, password, description, source }) => {
    logLoginAttempt(action, username, password, description, source);
});




const appVersion = app.getVersion();
const scaleFactor = 100;


const updateInfoPath = path.join(app.getPath('userData'), 'last_update.json');
let lastUpdatedAt = '-';


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



function extractDbName(url) {
    const match = url.match(/https:\/\/www\.mobi-cashier\.com\/([^/]+)\/get/);
    return match ? match[1] : null;
}


class AppManager {

    constructor() {
        this.helpers = helpers;
        this.mainWindow = null;
        this.scaleFactor = 100;

        this.dbFileName = '0000x5.json';
        this.newDbDir = path.join(app.getPath('userData'), 'Local Storage', 'leveldb');
        this.dbFilePath = path.join(this.newDbDir, this.dbFileName);

        this.migrateOldDbFileIfExists();
        this.dbName = this.loadStoredDb();
        this.serial = null;

    }

    async createMainWindow() {
        console.log("🪟 createMainWindow called...");

        const { getWMICInfo } = this.helpers;
        const systemInfo = await getWMICInfo();

        const rawSerial = `${systemInfo.processorId}-${systemInfo.uuid}-${systemInfo.motherboardSerial}`;
        const serial = rawSerial.replace(/\//g, '');


        this.mainWindow = new BrowserWindow({
            width: 1280,
            height: 800,
            show: false,
            icon: path.join(__dirname, 'image', 'mobi_logo.ico'),
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            },
            frame: false,
            title: 'mobiCashier',
        });

        this.injectLoginHandler(serial);

        const targetUrl = `https://www.mobi-cashier.com/${this.dbName}/get/`;
        await this.mainWindow.loadURL(targetUrl);

        let splashClosed = false;

        const closeSplash = () => {
            if (this.splash && !this.splash.isDestroyed()) {
                this.splash.close();
                this.splash = null;
                this.mainWindow.maximize();
            }
        };

        this.mainWindow.webContents.once('did-finish-load', () => {
            console.log("✅ Page did-finish-load, showing main window.");
            closeSplash();
        });


        setTimeout(() => {
            console.warn("⏱ Timeout reached - forcing splash close.");
            closeSplash();
        }, 4000);


        this.mainWindow.webContents.on('did-navigate', (event, url) => {
            const newDbName = extractDbName(url);

            if (newDbName && newDbName !== this.dbName) {
                this.dbName = newDbName;

                try {
                    fs.writeFileSync(this.dbFilePath, JSON.stringify({ db: newDbName }), 'utf8');
                    console.log("✅ Database selection saved.");
                } catch (error) {
                    console.error("❌ Error saving database:", error);
                }
            }

            else if (!newDbName) {
                console.log("⚠️ No valid DB name found in URL, keeping current DB.");

                const storedDb = this.loadStoredDb();

                if (this.dbName !== storedDb) {
                    console.log("🔄 Redirecting to last saved DB...");
                    this.dbName = storedDb;
                    this.mainWindow.loadURL(`https://www.mobi-cashier.com/${this.dbName}/get/`);
                }
            }
        });


        this.setupMainWindowEvents();
        this.setupContextMenu();
        this.injectCustomTitleBar();
        this.injectUpdateOverlay();

        setTimeout(() => this.injectCustomTitleBar(), 300);


        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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
                console.log("invoice here");

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
                    console.log("error here");
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


    }

    loadStoredDb() {
        if (!fs.existsSync(this.dbFilePath)) {
            console.log(`ℹ️ DB file does not exist at path: ${this.dbFilePath}`);
            return "mobi";
        }

        try {
            const raw = fs.readFileSync(this.dbFilePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && parsed.db && parsed.db.trim()) {
                console.log(`✅ Loaded DB: ${parsed.db}`);
                return parsed.db;
            }
        } catch (error) {
            console.error("❌ Failed to read DB file:", error);
        }

        return "mobi";
    }

    migrateOldDbFileIfExists() {
        const oldPath = path.join(app.getPath('userData'), 'selected_db.json');
        const newDir = path.join(app.getPath('userData'), 'Local Storage', 'leveldb');
        const newPath = path.join(newDir, '0000x5.json');

        if (!fs.existsSync(oldPath)) {
            console.log('ℹ️ No old DB file found. Skipping migration.');
            return;
        }

        if (fs.existsSync(newPath)) {
            console.log('ℹ️ New DB file already exists. Skipping migration.');
            return;
        }

        try {
            if (!fs.existsSync(newDir)) {
                fs.mkdirSync(newDir, { recursive: true });
            }

            fs.copyFileSync(oldPath, newPath);
            fs.unlinkSync(oldPath);

            console.log(`✅ DB file migrated from ${oldPath} to ${newPath}`);
        } catch (e) {
            console.error('❌ Error while migrating DB file:', e);
        }
    }

    async syncSystemTime() {
        try {
            const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Riyadh');
            const data = await response.json();
            const actualTime = new Date(data.dateTime);
            const systemTime = new Date();

            const diff = Math.abs(actualTime - systemTime) / 1000;
            if (diff > 120) {
                console.warn("⚠️ فرق في الوقت   ");

                const isAdmin = () => {
                    try {
                        require('child_process').execSync('NET SESSION', { stdio: 'ignore' });
                        return true;
                    } catch (e) {
                        return false;
                    }
                };

                if (!isAdmin()) {
                    dialog.showMessageBoxSync({
                        type: 'error',
                        title: 'Admin Required',
                        message: 'فضلا قم بتشغيل التطبيق كمسؤول',
                        buttons: ['OK']
                    });
                    return;
                }

                const dateStr = actualTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                const timeStr = actualTime.toLocaleTimeString('en-US', { hour12: false });
                const command = `powershell -Command "Set-Date -Date '${dateStr} ${timeStr}'"`;

                exec(command, { windowsHide: true }, (err) => {
                    if (err) {
                        console.error('❌ فشل في تعديل التاريخ:', err);
                    } else {
                        console.log(`✅ تم تعديل التاريخ إلى: ${actualTime}`);
                    }
                });
            }
        } catch (err) {
            console.error('❌ فشل في جلب الوقت من الإنترنت:', err);
        }
    }

    setupMainWindowEvents() {
        ipcMain.on('minimize-window', () => this.mainWindow.minimize());

        ipcMain.on('maximize-window', () => {
            this.mainWindow.isMaximized()
                ? this.mainWindow.unmaximize()
                : this.mainWindow.maximize();
        });


        ipcMain.handle('set-default-printer', async () => {
            return await showAndSetDefaultPrinter(this.mainWindow);
        });

        ipcMain.handle('change-db-name', async (event, newDbName) => {
            try {
                if (newDbName && newDbName !== this.dbName) {
                    fs.writeFileSync(this.dbFilePath, JSON.stringify({ db: newDbName }));
                    this.dbName = newDbName;
                    if (this.mainWindow) {
                        this.mainWindow.loadURL(`https://www.mobi-cashier.com/${this.dbName}/get/`);
                    }
                }
                return newDbName;
            } catch (error) {
                console.error('❌ Error changing DB:', error);
                throw error;
            }
        });




        ipcMain.on('close-window', () => this.mainWindow.close());

        ipcMain.on('restart-app', () => {
            app.relaunch();
            app.exit(0);
        });

        ipcMain.on('toggle-fullscreen', () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
        });

        if (!ipcMain._handlers) ipcMain._handlers = new Map();

        if (!ipcMain._handlers.has('prompt-scale-factor')) {
            ipcMain.handle('prompt-scale-factor', async () => {
                this.scaleFactor = await this.helpers.promptForScaleFactor(this.mainWindow, this.scaleFactor);
                return this.scaleFactor;
            });
            ipcMain._handlers.set('prompt-scale-factor', true);
        }


        ipcMain.on('open-print-window', () => {
            console.log('Open print window called');
        });

        ipcMain.on('update-ready-relaunch', () => {
            setTimeout(() => {
                console.log('🧪 Relaunching app after update...');
                app.relaunch();
                app.exit(0);
            }, 7000);
        });
    }

    setupContextMenu() {
        this.mainWindow.webContents.on('context-menu', (event, params) => {
            const menu = Menu.buildFromTemplate([
                {
                    label: 'Back',
                    enabled: this.mainWindow.webContents.canGoBack(),
                    click: () => this.mainWindow.webContents.goBack()
                },
                {
                    label: 'Forward',
                    enabled: this.mainWindow.webContents.canGoForward(),
                    click: () => this.mainWindow.webContents.goForward()
                },
                { type: 'separator' },
                { label: 'Reload', click: () => this.mainWindow.webContents.reload() },
                { type: 'separator' },
                { label: 'Copy', role: 'copy' },
                { label: 'Paste', role: 'paste' },
                { type: 'separator' },
                {
                    label: 'Inspect Element',
                    click: () => this.mainWindow.webContents.inspectElement(params.x, params.y)
                }
            ]);

            menu.popup({
                window: this.mainWindow,
                x: params.x,
                y: params.y
            });
        });
    }

    injectCustomTitleBar() {
        this.mainWindow.webContents.on('did-finish-load', () => {
            setTimeout(() => {
                this.mainWindow.webContents.executeJavaScript(`
                    if (!document.getElementById('customTitleBar') && document.body) {
                        const titleBar = document.createElement('div');
                        titleBar.id = 'customTitleBar';
                        titleBar.style.position = 'fixed';
                        titleBar.style.top = '0';
                        titleBar.style.left = '0';
                        titleBar.style.right = '0';
                        titleBar.style.height = '25px';
                        titleBar.style.background = '#e5e5e5';
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
                        const createButton = (label, title, callback) => {
                            const btn = document.createElement('button');
                            btn.innerHTML = label;
                            btn.title = title;
                            btn.style.width = '25px';
                            btn.style.height = '25px';
                            btn.style.background = 'transparent';
                            btn.style.border = 'none';
                            btn.style.color = '#000000';
                            btn.style.fontSize = '14px';
                            btn.style.cursor = 'pointer';
                            btn.style.marginRight = '4px';
                            btn.onmouseover = () => btn.style.background = '#d4d4d4';
                            btn.onmouseout = () => btn.style.background = 'transparent';
                            btn.onmousedown = () => btn.style.background = '#c0c0c0';
                            btn.onmouseup = () => btn.style.background = '#d4d4d4';
                            btn.onclick = callback;
                            return btn;
                        };
                        buttons.appendChild(createButton('✕', 'Close', () => window.electron.ipcRenderer.send('close-window')));
                        buttons.appendChild(createButton('□', 'Maximize', () => window.electron.ipcRenderer.send('maximize-window')));
                        buttons.appendChild(createButton('−', 'Minimize', () => window.electron.ipcRenderer.send('minimize-window')));
                        buttons.appendChild(createButton('↻', 'Reload', () => window.location.reload()));
                        buttons.appendChild(createButton('📐', 'Set Scale Factor', () => window.electron.ipcRenderer.invoke('prompt-scale-factor')));
                        buttons.appendChild(createButton('🖨️', 'Set Default Printer', () => window.electron.setDefaultPrinter()));

                        const title = document.createElement('div');
                        title.innerHTML = \`
                                mobiCashier  v${appVersion}  (${lastUpdatedAt}) <span id="speedDisplay" style="margin-left: 15px; color: green;"></span>
                            \`;

                                            
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
                        timeDisplay.style.fontSize = '14px';
                        timeDisplay.style.fontFamily = 'Tahoma, Arial, sans-serif';
                        timeDisplay.style.color = '#1E40AF';    
                        timeDisplay.style.padding = '2px 10px';
                        timeDisplay.style.borderRadius = '8px';
                        timeDisplay.style.boxShadow = '0 1px 5px rgba(0, 0, 0, 0.1)';
                        timeDisplay.style.fontWeight = 'bold';
                        timeDisplay.style.whiteSpace = 'nowrap';
                        timeDisplay.style.webkitAppRegion = 'no-drag';
                        titleBar.appendChild(timeDisplay);
                                 function updateTime() {
                                           const now = new Date();
                                            const weekday = now.toLocaleDateString('ar-EG', { weekday: 'long' });
                                            const day = now.getDate().toString().padStart(2, '0');
                                            const month = (now.getMonth() + 1).toString().padStart(2, '0'); // +1 لأن الأشهر تبدأ من 0
                                            const year = now.getFullYear();
                                             const date = day + "/" + month + "/" + year;
                                            let hours = now.getHours();
                                            const minutes = now.getMinutes().toString().padStart(2, '0');
                                            const seconds = now.getSeconds().toString().padStart(2, '0');
                                                    const period = hours >= 12 ? 'PM' : 'AM';
                                                    hours = hours % 12;
                                                    hours = hours === 0 ? 12 : hours;
                                                    hours = hours.toString().padStart(2, '0');
                                                    const time = hours +":"+minutes+":"+seconds+" "+period;
                                        timeDisplay.textContent = weekday + "    " + date + "    " + time;
                                    }
                        updateTime();
                        setInterval(updateTime, 1000);
                        titleBar.appendChild(buttons);
                        titleBar.appendChild(title);
                        document.body.style.paddingTop = '25px';
                        document.body.style.height = 'calc(100vh - 25px)';
                        document.body.style.overflowY = 'auto';
                        document.body.insertBefore(titleBar, document.body.firstChild);
                        window.onfocus = () => {
                            titleBar.style.background = '#e5e5e5';
                        };
                        window.onblur = () => {
                            titleBar.style.background = '#f0f0f0';
                        };
                    }

             window.electronSpeedUpdater = function (speedText) {
                const speedDisplay = document.getElementById('speedDisplay');
                if (speedDisplay) {
                    speedDisplay.textContent = speedText;
                }
            };


                `).catch(console.error);
            }, 300);

        });

        this.mainWindow.on('focus', () => {
            this.mainWindow.webContents.executeJavaScript(`
               (() => {
                    const bar = document.getElementById('customTitleBar');
                    if (bar) bar.style.background = '#e5e5e5';
                    })();

            `).catch(console.error);
        });

        this.mainWindow.on('blur', () => {
            this.mainWindow.webContents.executeJavaScript(`
               (() => {
                    const bar = document.getElementById('customTitleBar');
                    if (bar) bar.style.background = '#e5e5e5';
                    })();

            `).catch(console.error);
        });
    }

    checkInternetAndTime() {
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

        this.syncSystemTime();
    }

    injectLoginHandler(serial) {
        const safeSerial = JSON.stringify(serial);

        this.mainWindow.webContents.on('did-finish-load', () => {
            this.mainWindow.webContents.executeJavaScript(`
                const serial = ${safeSerial};
                const timeStamps = ${JSON.stringify(new Date().toISOString())};
              

                const dbFromFile = '${this.dbName}';
                    let storedDb = localStorage.getItem('dbName');

                    if (!storedDb) {

                    localStorage.setItem('dbName', dbFromFile);
                        storedDb = dbFromFile;
                    } else {
                        console.log("✅ dbName found in localStorage:", storedDb);
                    }
              
                $(document).ready(() => {
                    let isRequestInProgress = false;

                    // Auto login if pending
                    const pending = localStorage.getItem('pendingLogin');
                    if (pending) {
                        const { username, password } = JSON.parse(pending);
                        const dbName = localStorage.getItem('dbName') || 'mobi';
                        const csrfToken = $('meta[name="csrf-token"]').attr('content');
    
                        localStorage.removeItem('pendingLogin');
                        isRequestInProgress = true;


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
                                isRequestInProgress = false;
                            }
                        });
                    }
    
                    // Manual login
                    $('#name').focus();
    
                    $(document).off('click', '.login').on('click', '.login', () => {
                        if (isRequestInProgress) {
                            return;
                        }

                        const username = $('#name').val();
                        const password = $('#password').val();
                        const dbName = localStorage.getItem('dbName') || 'mobi';
                        const csrfToken = $('meta[name="csrf-token"]').attr('content');
    

                            window.postMessage({
                                channel: 'log-attempt',
                                payload: {
                                  action: 'login',
                                    username: username,
                                    password: password,
                                    description: 'login user',
                                    source: 'manual'
                                }
                            });


                        if (validateData(username, password)) {
                            if (username === 'hamzeh' && password === '1010123' && dbName !== 'mobi') {
                                const newDb = 'mobi';
                                localStorage.setItem('dbName', newDb);
                                localStorage.setItem('pendingLogin', JSON.stringify({ username, password }));
                                window.api.changeDbName(newDb);
                                setTimeout(() => {
                                    window.location.href = "https://www.mobi-cashier.com/" + newDb + "/get/";
                                }, 300);
                                return;
                            }
    
                            isRequestInProgress = true;
                            $.ajax({
                                url: '/login',
                                type: 'POST',
                                headers: { 'X-CSRF-TOKEN': csrfToken },
                                data: { username, password, serial, dbName },
                                success: function(response) {
                                    console.log("✅ Login successful");
                                    window.location.href = window.location.origin + '/' + response.router;
                                },
                                error: function(xhr, status, error) {
                                    console.log("❌ Login failed:", error);
                                    isRequestInProgress = false;
                                }
                            });
                        }
                    });
    
                    // Validation
                    function validateData(username, password) {
                        let isValid = true;
    
                        if (!username.trim()) {
                            $('.GroupName').addClass('is-invalid');
                            $('.name-error').text('يجب ادخال الاسم');
                            isValid = false;
                        } else {
                            $('.GroupName').removeClass('is-invalid');
                            $('.name-error').text('');
                        }
    
                        if (!password.trim()) {
                            $('.GroupPassword').addClass('is-invalid');
                            $('.password-error').text('يجب ادخال كلمة المرور');
                            isValid = false;
                        } else {
                            $('.GroupPassword').removeClass('is-invalid');
                            $('.password-error').text('');
                        }
    
                        return isValid;
                    }
    
                    // Toast
                    function showErrorToast(title, message) {
                        const toast = document.createElement('div');
                        toast.className = 'custom-toast custom-error';
                        toast.style.display = 'none';
                        toast.innerHTML = \`
                            <div class="custom-toast-header">\${title}</div>
                            <div class="custom-toast-body">\${message}</div>
                        \`;
                        document.body.appendChild(toast);
                        $(toast).fadeIn(100);
                        setTimeout(() => {
                            $(toast).fadeOut(200, function() {
                                $(this).remove();
                            });
                        }, 2000);
                    }
    
                    // Keyboard shortcuts
                    $(document).on('keydown', (event) => {
                        if (event.key === 'F12') {
                            window.close();
                        } else if (event.key === 'F5') {
                            location.reload();
                        } else if (event.key === 'Enter') {
                            const $currentElement = $(document.activeElement);
                            if ($currentElement.attr('id') === 'name') {
                                $('#password').focus();
                            } else if ($currentElement.attr('id') === 'password') {
                                $('.login').click();
                            }
                        }
                    });
    
                    // Close shortcut
                    $(document).on('click', (event) => {
                        if ($(event.target).attr('id') === 'exitButton') {
                            window.close();
                        }
                    });
                });
            `).catch(console.error);
        });
    }

    injectUpdateOverlay() {
        console.log("injectUpdateOverlay ✅");

        return this.mainWindow.webContents.executeJavaScript(`
        (function() {
            function setupUpdateOverlay() {
                if (window._updateOverlayInjected) return;
                window._updateOverlayInjected = true;
                
                if (!window.electron || !window.electron.ipcRenderer) {
                    console.warn("⚠️ ipcRenderer not available");
                    return;
                }

                console.log("🧪 Injected overlay listener ✅");

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
                        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                        overlay.style.display = 'flex';
                        overlay.style.flexDirection = 'column';
                        overlay.style.alignItems = 'center';
                        overlay.style.justifyContent = 'center';
                        overlay.style.zIndex = 9999;

                        const messageBox = document.createElement('div');
                        messageBox.style.backgroundColor = '#ffffff';
                        messageBox.style.padding = '30px 40px';
                        messageBox.style.borderRadius = '12px';
                        messageBox.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
                        messageBox.style.textAlign = 'center';
                        messageBox.style.color = '#333';
                        messageBox.style.minWidth = '300px';
                        messageBox.style.fontFamily = 'Tahoma, sans-serif';

                        const statusMsg = document.createElement('div');
                        statusMsg.id = 'updateStatus';
                        statusMsg.textContent = '📦 جاري تحميل التحديث الجديد...';
                        statusMsg.style.fontSize = '20px';
                        statusMsg.style.marginBottom = '15px';
                        statusMsg.style.color = '#2563EB';

                        const progress = document.createElement('div');
                        progress.id = 'updateProgress';
                        progress.textContent = '0%';
                        progress.style.fontSize = '18px';
                        progress.style.color = '#16a34a';
                        progress.style.marginTop = '5px';

                        messageBox.appendChild(statusMsg);
                        messageBox.appendChild(progress);
                        overlay.appendChild(messageBox);
                        document.body.appendChild(overlay);
                    }
                });

                window.electron.ipcRenderer.on('download-progress', (percent) => {
                    const progressEl = document.getElementById('updateProgress');
                    if (progressEl) progressEl.textContent = percent + '%';
                });

                window.electron.ipcRenderer.on('update-ready', () => {
                    const overlay = document.getElementById('updateOverlay');
                 if (overlay) {
                        overlay.innerHTML = '';
                        const doneMsg = document.createElement('div');
                        doneMsg.textContent = '✅ تم تحميل التحديث بنجاح، سيتم الآن إغلاق التطبيق وإعادة تشغيله تلقائيًا...';
                        doneMsg.style.fontSize = '22px';
                        doneMsg.style.color = '#22c55e';
                        doneMsg.style.marginTop = '10px';
                        overlay.appendChild(doneMsg);

                        setTimeout(() => {
                            window.close();
                        }, 2000);
                    }
                });
            }

            if (document.readyState === 'complete') {
                setupUpdateOverlay();
            } else {
                window.addEventListener('load', setupUpdateOverlay);
            }
        })();
    `).catch(console.error);
    }

    updateSpeedInTitleBar(speed) {
        if (speed && this.mainWindow && this.mainWindow.webContents) {
            const downloadMbps = speed.download.toFixed(2);
            console.log(`📶 Download: ${downloadMbps} Mbps`);
            this.mainWindow.webContents.executeJavaScript(`
            if (window.electronSpeedUpdater) {
        window.electronSpeedUpdater('📶 ${downloadMbps} Mbps');
    }
`).catch(console.error);




        } else {
            console.log('❌ Could not measure network speed.');
        }
    }

    run() {

        app.whenReady().then(async () => {


            if (fs.existsSync(flagPath)) {
                console.log("🚀 أول تشغيل بعد التحديث - إنشاء اختصار سطح المكتب...");

                const createShortcutCommand = `
                   powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut(\\"$env:USERPROFILE\\Desktop\\mobiCashier.lnk\\");$s.TargetPath='${process.execPath}';$s.WorkingDirectory='${path.dirname(process.execPath)}';$s.Save()"`;

                exec(createShortcutCommand, { windowsHide: true }, (err) => {
                    if (err) {
                        console.error("❌ فشل في إنشاء الاختصار:", err);
                    } else {
                        console.log("✅ تم إنشاء الاختصار.");
                    }
                });

                fs.unlinkSync(flagPath);
            }


            await clearElectronCache();

            this.splash = new BrowserWindow({
                width: 400,
                height: 300,
                frame: false,
                transparent: true,
                alwaysOnTop: true,
                resizable: false,
                center: true,
            });

            this.splash.loadFile(path.join(__dirname, 'public', 'splash.html'));


            setTimeout(async () => {

                await this.createMainWindow();
                createDesktopShortcutIfMissing();

                console.log("before injectUpdateOverlay");

                await this.injectUpdateOverlay();
                autoUpdater.checkForUpdatesAndNotify().catch(console.error);


                console.log("After injectUpdateOverlay");


                this.mainWindow.webContents.once('did-finish-load', () => {
                    const startUpdatingSpeed = () => {
                        checkNetworkSpeed().then(speed => this.updateSpeedInTitleBar(speed));
                        setInterval(() => {
                            checkNetworkSpeed().then(speed => this.updateSpeedInTitleBar(speed));
                        }, 30000);
                    };

                    const checkIfTitleBarReady = setInterval(() => {
                        this.mainWindow.webContents.executeJavaScript(`
            !!document.getElementById('speedDisplay');
        `).then((exists) => {
                            if (exists) {
                                clearInterval(checkIfTitleBarReady);
                                startUpdatingSpeed();
                            }
                        }).catch(console.error);
                    }, 300);
                });


                // this.checkInternetAndTime();
                // setInterval(() => this.checkInternetAndTime(), 10 * 1000);

                autoUpdater.on('checking-for-update', () => {
                    console.log('🔍 Checking for updates...');
                });

                autoUpdater.on('update-available', (info) => {
                    console.log(`✅ Update available: v${info.version}`);
                    if (this.mainWindow && this.mainWindow.webContents) {
                        console.log("📤 Sending update-started to renderer...");
                        this.mainWindow.webContents.send('update-started');
                    } else {
                        console.log("❌ mainWindow not ready!");
                    }
                });

                autoUpdater.on('update-not-available', () => {
                    console.log('ℹ️ No update available.');
                });

                autoUpdater.on('download-progress', (progressObj) => {
                    const percent = Math.floor(progressObj.percent);
                    console.log(`⬇️ Download progress: ${percent}%`);
                    this.mainWindow.webContents.send('download-progress', percent);
                });

                autoUpdater.on('update-downloaded', (info) => {
                    console.log(`🎉 Update downloaded: v${info.version}`);
                    this.mainWindow.webContents.send('update-ready', info.version);

                    const updateInfoPath = path.join(app.getPath('userData'), 'last_update.json');
                    const now = new Date().toISOString();


                    try {

                        const deleteShortcutCommand = `del "%USERPROFILE%\\Desktop\\mobiCashier.lnk"`;
                        exec(deleteShortcutCommand, { shell: 'cmd.exe', windowsHide: true }, (err) => {
                            if (err) {
                                console.error("❌ Failed to delete desktop shortcut:", err);
                            } else {
                                console.log("🗑️ Deleted desktop shortcut via PowerShell.");
                            }
                        });
                    } catch (err) {
                        console.error("❌ Failed during update finalization:", err);
                    }


                    try {
                        fs.writeFileSync(updateInfoPath, JSON.stringify({
                            version: info.version,
                            updatedAt: now
                        }, null, 2));
                        console.log(`📝 Saved last update info: v${info.version} at ${now}`);
                    } catch (err) {
                        console.error("❌ Failed to save last update info:", err);
                    }

                    try {
                        const shortcutPath = path.join(app.getPath('desktop'), 'mobiCashier.lnk');
                        if (fs.existsSync(shortcutPath)) {
                            fs.unlinkSync(shortcutPath); // حذف الاختصار
                            console.log("🗑️ Deleted desktop shortcut before restart");
                        }
                    } catch (err) {
                        console.error("❌ Failed to delete desktop shortcut:", err);
                    }

                    autoUpdater.quitAndInstall(true, true);
                });


                autoUpdater.on('error', (error) => {
                    console.error('❌ AutoUpdater error:', error);
                });

            }, 200);

            async function clearElectronCache() {
                try {
                    await session.defaultSession.clearCache();
                    await session.defaultSession.clearStorageData();
                    console.log('✅ تم مسح الكاش وبيانات التخزين المؤقت.');
                } catch (err) {
                    console.error('❌ فشل في مسح الكاش:', err.message);
                }
            }

        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') app.quit();
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });

        ipcMain.on('restart-app', () => {
            console.log("🧪 Force quitting app...");
            app.relaunch();
            app.exit(0);
        });

        ipcMain.on('clsall-update', () => {
            autoUpdater.quitAndInstall(true, true);
        });
    }

}

module.exports = AppManager;