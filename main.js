const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');
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

function loadSettings() {
    const fs = require('fs');
    try {
      const data = fs.readFileSync(settingsFile);
      const settings = JSON.parse(data);
      if (settings.scaleFactor) {
        scaleFactor = settings.scaleFactor;
      }
    } catch (error) {
      console.log('No settings file found, using defaults.');
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
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        frame: true
    });

    mainWindow.maximize();
    mainWindow.setSkipTaskbar(true);

    mainWindow.loadURL('https://www.mobi-cashier.com/posweb/get/');

    const biosData = await getBiosData();
    const serial = biosData.serial;
mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
            $(document).ready(() => {
                $('#name').focus();
    
                $(document).off('click', '.login').on('click', '.login', (event) => {
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
                            window.location.href = window.location.origin +'/' +response.router;
                            },
                            error: function(xhr, status, error) {
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
            // Refresh the page if there's an error
            window.location.reload();
        });
        
    });
    
    

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('https://www.mobi-cashier.com/invoice') || url.includes('https://www.mobi-cashier.com/period-report-htm')) {
            const invoiceWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true,
                }
            });
            invoiceWindow.loadURL(url);
            const invoiceMenuTemplate = buildInvoiceMenu(convertToPDF, convertToJPG, promptForScaleFactor, invoiceWindow);
            const invoiceMenu = Menu.buildFromTemplate(invoiceMenuTemplate);
            invoiceWindow.setMenu(invoiceMenu);
            invoiceWindow.webContents.on('did-finish-load', () => {
                printInvoiceWindow(invoiceWindow, scaleFactor);
            });
            return { action: 'deny' };
        } else {
            shell.openExternal(url);
            return { action: 'deny' };
        }
    });

    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript(`
        // Listen for keydown events
        document.addEventListener('keydown', function(event) {
            if (event.key === 'F12') {
                window.close();
            } else if (event.key === 'F5') {
                location.reload();
            } else if (event.key === 'F11') {
                require('electron').ipcRenderer.send('toggle-fullscreen');
            } else if (event.key === 'Enter') {
                const currentElement = document.activeElement;
    
                // Check if focused on the 'name' input and focus the 'password' input
                if (currentElement && currentElement.id === 'name') {
                    $('#password').focus(); // Using jQuery to focus the password field
                } 
                // If focused on the 'password' input, trigger the login button click
                else if (currentElement && currentElement.id === 'password') {
                    $('.login').click(); // Trigger login if on the password input
                } 
                // Fallback: Trigger login if neither of the inputs are focused
                else {
                    $('.login').click(); // Default to triggering login
                }
            }
        });
    
        // Listen for click events to close the window
        document.addEventListener('click', function(event) {
            if (event.target.id === 'exitButton') {
                window.close();
            }
        });
    `);
    
    });

    const { ipcMain } = require('electron');

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