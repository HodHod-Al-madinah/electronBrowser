const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
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
        const data = fs.readFileSync(settingsFile);
        const settings = JSON.parse(data);
        if (settings.scaleFactor) {
            scaleFactor = settings.scaleFactor;
        }
    } catch (error) {
        console.log('No settings file found, using defaults.');
    }
}

let hasReloadedOnce = false;

//
async function createWindow() {
    loadSettings();
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: path.join(__dirname, 'image', 'mobi_logo.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        frame: false, // Hide native frame
        title: 'mobiCashier',
        autoHideMenuBar: true,
    });

    mainWindow.maximize();
    mainWindow.setSkipTaskbar(false);

    mainWindow.loadURL(`https://www.mobi-cashier.com/${dbName}/get/`);

    const systemInfo = await getWMICInfo();
    const processorId = systemInfo.processorId;
    const uuid = systemInfo.uuid;
    const motherboardSerial = systemInfo.motherboardSerial;


    ipcMain.handle('prompt-scale-factor', async () => {
        scaleFactor = await promptForScaleFactor(mainWindow, scaleFactor);
        return scaleFactor;
    });



    //  custom title bar with reload button
    mainWindow.webContents.on('did-navigate', (event, url) => {
        mainWindow.webContents.executeJavaScript(`
        // Remove existing title bar if present
        const existingTitleBar = document.getElementById('customTitleBar');
        if (existingTitleBar) existingTitleBar.remove();

        // Create custom title bar
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

        // Printer button
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

        // Reload button
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

        // Minimize button
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

        // Maximize/Restore button
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

        // Close button
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

        // Append buttons (left to right: close, max, min, reload, printer)
        buttons.appendChild(closeBtn);
        buttons.appendChild(maxBtn);
        buttons.appendChild(minBtn);
        buttons.appendChild(reloadBtn);
        buttons.appendChild(printerBtn);

        // Title (on the right)
        const title = document.createElement('div');
        title.textContent = 'mobiCashier';
        title.style.fontSize = '14px';
        title.style.color = 'blue';
        title.style.fontWeight = 'normal'; // Corrected typo: FontWeigth -> fontWeight
        title.style.marginLeft = '5px'; // Should this be marginRight for right-side?
        title.style.webkitAppRegion = 'drag';

        // Assemble title bar
        titleBar.appendChild(buttons);
        titleBar.appendChild(title);

        // Adjust body to prevent scrollbar
        document.body.style.paddingTop = '25px';
        document.body.style.height = 'calc(100vh - 25px)'; // Adjust height to fit viewport
        document.body.style.overflowY = 'auto'; // Allow content scrolling if needed
        document.body.insertBefore(titleBar, document.body.firstChild);

        // Sync with window focus
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




    ipcMain.on('minimize-window', () => mainWindow.minimize());
    ipcMain.on('maximize-window', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('close-window', () => mainWindow.close());

    //
    mainWindow.on('focus', () => {
        mainWindow.webContents.executeJavaScript(`
            const titleBar = document.getElementById('customTitleBar');
            if (titleBar) titleBar.style.background = '#e5e5e5';
        `);
    });

    //
    mainWindow.on('blur', () => {
        mainWindow.webContents.executeJavaScript(`
            const titleBar = document.getElementById('customTitleBar');
            if (titleBar) titleBar.style.background = '#f0f0f0';
        `);
    });

    //
    mainWindow.webContents.on('did-finish-load', async () => {
        const rawSerial = `${processorId}-${uuid}-${motherboardSerial}`;
        const serial = rawSerial.replace(/\//g, '');

        mainWindow.webContents.executeJavaScript(`
            $(document).ready(() => {
                $('#name').focus();
    
                $(document).off('click', '.login').on('click', '.login', (event) => {
                    let username = $('#name').val();
                    let password = $('#password').val();
                    let serial = "${serial}";
                         
                    
                    let dbName = "${dbName}"; 
                    localStorage.setItem('dbName', dbName);


                    if (validateData(username, password)) {
                        // If the user enters 'hamzeh' and '123', update DB name before sending AJAX request
                        if (username === 'hamzeh' && password === '123') {
                            window.api.changeDbName('mobi');
                            console.log("✅ Database changed to: mobi");
                        }
    
                        // Retrieve CSRF token
                        const csrfToken = $('meta[name="csrf-token"]').attr('content');
    
                        // Send AJAX request for all users
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

    //
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
                }
            });

            printWindow.loadURL(url);

            printWindow.webContents.once('did-finish-load', () => {
                printWindow.webContents.executeJavaScript(`window.print();`);
            });

            return { action: 'deny' };
        } else if (
            url.startsWith('https://www.mobi-cashier.com/invoice') ||
            url.includes('https://www.mobi-cashier.com/period-report-htm')
        ) {
            const invoiceWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true,
                }
            });

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

    //
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
            $(document).ready(() => {
                // Handle keydown events
                $(document).on('keydown', (event) => {
                    if (event.key === 'F12') {
                        window.close();
                    } else if (event.key === 'F5') {
                        location.reload();
                    } else if (event.key === 'F11') {
                        require('electron').ipcRenderer.send('toggle-fullscreen');
                    } else if (event.key === 'Enter') {
                        const $currentElement = $(document.activeElement);
                        
                        // Check if focused on the 'name' input and focus the 'password' input
                        if ($currentElement.attr('id') === 'name') {
                            $('#password').focus();
                        } else if ($currentElement.attr('id') === 'password') {
                            $('.login').click();
                        }
                    }
                });
    
                // Handle click events to close the window
                $(document).on('click', (event) => {
                    if ($(event.target).attr('id') === 'exitButton') {
                        window.close();
                    }
                });
            });
        `);
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

    //
    ipcMain.on('open-print-window', () => {
        openPrintWindow();
    });

    //
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
        console.log('you are');
        mainWindow.webContents.reload()
    }
}

//
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

//
app.whenReady().then(() => {
    createWindow();
    autoUpdater.forceDevUpdateConfig = true;
    autoUpdater.checkForUpdatesAndNotify();
});

//
autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
});

//
autoUpdater.on('update-available', (info) => {
    console.log(`✅ Update available: v${info.version}`);
    mainWindow.webContents.send('update-available', info);
});

//
autoUpdater.on('update-not-available', () => {
    console.log('ℹ️ No update available.');
});

//
autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.floor(progressObj.percent);
    console.log(`⬇️ Download progress: ${percent}%`);
    mainWindow.webContents.send('download-progress', percent);
});

//
autoUpdater.on('update-downloaded', (info) => {
    console.log(`🎉 Update downloaded: v${info.version}`);
    mainWindow.webContents.send('update-ready', info.version);
});

//
ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
});

//
autoUpdater.on('error', (error) => {
    console.error('❌ AutoUpdater error:', error);
});

//
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

//
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

//
ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall();
});