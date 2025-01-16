const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { getBiosData } = require('./helpers/biosHelper'); // Import getBiosData
const { convertToPDF } = require('./helpers/pdfHelper');
const { convertToJPG } = require('./helpers/jpgHelper');
const { promptForScaleFactor } = require('./helpers/scaleHelper');
const { printInvoiceWindow } = require('./helpers/printHelper');
const { buildInvoiceMenu } = require('./helpers/menuHelper');

let mainWindow;
let settingsFile = path.join(__dirname, 'settings.json');
let scaleFactor = 88;

process.env.LANG = 'en-US';
app.commandLine.appendSwitch('lang', 'en-US');

// Centralized error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

function loadSettings() {
    try {
        const data = fs.readFileSync(settingsFile);
        const settings = JSON.parse(data);
        if (settings && typeof settings.scaleFactor === 'number') {
            scaleFactor = settings.scaleFactor;
        }
    } catch (error) {
        console.log('Error reading settings file, using defaults:', error.message);
    }
}

async function createWindow() {
    loadSettings();

    mainWindow = new BrowserWindow({
        fullscreen: true,
        width: 1280,
        height: 800,
        icon: path.join(__dirname, 'image', 'mobi_logo.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
        },
        frame: true,
    });

    mainWindow.maximize();
    mainWindow.setSkipTaskbar(false);

    try {
        const biosData = await getBiosData();
        const serial = biosData.serial;

        mainWindow.loadURL('https://www.mobi-cashier.com/mobi/get/');
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.executeJavaScript(`
                $(document).ready(() => {
                    $('#name').focus();

                    $(document).off('click', '.login').on('click', '.login', () => {
                        let username = $('#name').val();
                        let serial = "${serial}";
                        let password = $('#password').val();

                        if (validateData(username, password)) {
                            const csrfToken = $('meta[name="csrf-token"]').attr('content');
                            $.ajax({
                                url: '/login',
                                type: 'POST',
                                headers: { 'X-CSRF-TOKEN': csrfToken },
                                data: { username, password, serial },
                                success: function(response) {
                                    window.location.href = window.location.origin + '/' + response.router;
                                },
                                error: function(xhr) {
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
                            $('.password-error').text('يجب  ادخال كلمة المرور');
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
                console.error('Error executing JavaScript:', error);
                mainWindow.reload();
            });
        });
    } catch (error) {
        console.error('Error loading BIOS data:', error);
    }

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('https://www.mobi-cashier.com/invoice') || url.includes('https://www.mobi-cashier.com/period-report-htm')) {
            const invoiceWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    contextIsolation: true,
                    nodeIntegration: false,
                    webSecurity: true,
                },
            });
            invoiceWindow.loadURL(url);

            const invoiceMenuTemplate = buildInvoiceMenu(convertToPDF, convertToJPG, promptForScaleFactor, invoiceWindow);
            const invoiceMenu = Menu.buildFromTemplate(invoiceMenuTemplate);
            invoiceWindow.setMenu(invoiceMenu);

            invoiceWindow.webContents.once('did-finish-load', () => {
                printInvoiceWindow(invoiceWindow, scaleFactor);
                invoiceWindow.on('closed', () => invoiceWindow.destroy());
            });

            return { action: 'deny' };
        } else {
            shell.openExternal(url);
            return { action: 'deny' };
        }
    });

    mainWindow.webContents.on('context-menu', (event, params) => {
        const menu = Menu.buildFromTemplate([
            { label: 'Back', enabled: mainWindow.webContents.canGoBack(), click: () => mainWindow.webContents.goBack() },
            { label: 'Forward', enabled: mainWindow.webContents.canGoForward(), click: () => mainWindow.webContents.goForward() },
            { type: 'separator' },
            { label: 'Reload', click: () => mainWindow.webContents.reload() },
            { type: 'separator' },
            { label: 'Copy', role: 'copy' },
            { label: 'Paste', role: 'paste' },
            { type: 'separator' },
            { label: 'View Source', click: () => mainWindow.webContents.loadURL(`view-source:${mainWindow.webContents.getURL()}`) },
            { label: 'Inspect Element', click: () => mainWindow.webContents.inspectElement(params.x, params.y) },
        ]);
        menu.popup({ window: mainWindow, x: params.x, y: params.y });
    });

    ipcMain.on('toggle-fullscreen', () => {
        const isFullScreen = mainWindow.isFullScreen();
        mainWindow.setFullScreen(!isFullScreen);
    });
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
