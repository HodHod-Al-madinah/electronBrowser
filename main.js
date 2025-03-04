const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');

const fs = require('fs');
const path = require('path');
const { getWMICInfo } = require('./helpers/biosHelper');
const { convertToPDF } = require('./helpers/pdfHelper');
const { convertToJPG } = require('./helpers/jpgHelper');
const { promptForScaleFactor } = require('./helpers/scaleHelper');
const { printInvoiceWindow } = require('./helpers/printHelper');
const { buildInvoiceMenu } = require('./helpers/menuHelper');


let mainWindow;
let scaleFactor = 100;

process.env.LANG = 'en-US';
app.commandLine.appendSwitch('lang', 'en-US');


const dbFilePath = path.join(app.getPath('userData'), 'selected_db.json');
let dbName = loadStoredDb();


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

async function createWindow() {
    loadSettings()
    mainWindow = new BrowserWindow({
        fullscreen: true,
        width: 1280,
        height: 800,
        icon: path.join(__dirname, 'image', 'mobi_logo.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        frame: true
    });

    mainWindow.maximize();
    mainWindow.setSkipTaskbar(false);

    mainWindow.loadURL(`https://www.mobi-cashier.com/${dbName}/get/`);


    const systemInfo = await getWMICInfo();
    const processorId = systemInfo.processorId;
    const uuid = systemInfo.uuid;
    const motherboardSerial = systemInfo.motherboardSerial;


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
                            data: { username, password, serial },
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
            url.includes('https://www.mobi-cashier.com/invoice') ||
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
                printInvoiceWindow(invoiceWindow, scaleFactor);
            });

            return { action: 'deny' };
        } else {
            // Open external links in the default browser
            shell.openExternal(url);
            return { action: 'deny' };
        }
    });






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


    ipcMain.on('open-print-window', () => {
        openPrintWindow();
    });


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


    ipcMain.on('toggle-fullscreen', () => {
        const isFullScreen = mainWindow.isFullScreen();
        mainWindow.setFullScreen(!isFullScreen);
    });

    if (!hasReloadedOnce) {
        hasReloadedOnce = true;
        console.log('you are');

        mainWindow.webContents.reload()

    }
}



app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});