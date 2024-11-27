const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Helper imports
const { getBiosData } = require('./helpers/biosHelper'); // BIOS data
const { convertToPDF } = require('./helpers/pdfHelper'); // PDF conversion
const { convertToJPG } = require('./helpers/jpgHelper'); // JPG conversion
const { promptForScaleFactor } = require('./helpers/scaleHelper'); // Scale factor prompt
const { printInvoiceWindow } = require('./helpers/printHelper'); // Print helper
const { buildInvoiceMenu } = require('./helpers/menuHelper'); // Invoice menu builder

let mainWindow, loadingWindow;
let settingsFile = path.join(__dirname, 'settings.json');
let scaleFactor = 88;

// Set language
process.env.LANG = 'en-US';
app.commandLine.appendSwitch('lang', 'en-US');

// Load user settings
function loadSettings() {
  try {
    const data = fs.readFileSync(settingsFile, 'utf8');
    const settings = JSON.parse(data);
    if (settings.scaleFactor) {
      scaleFactor = settings.scaleFactor;
    }
  } catch (error) {
    console.log('No settings file found, using defaults.');
  }
}

// Create loading window
function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
    },
  });
  loadingWindow.loadFile(path.join(__dirname, 'loading.html'));
}

// Create main window
async function createMainWindow() {
  loadSettings();

  mainWindow = new BrowserWindow({
    fullscreen: true,
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'image', 'mobi_logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    show: false, // Initially hidden until content is loaded
  });

  try {
    mainWindow.loadURL('http://127.0.0.1:8000/');
    const biosData = await getBiosData();
    const serial = biosData.serial;

    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript(`
            $('#name').focus();
 $(document).on('click','.login',(event) => {
    let username = $('#name').val();
    let serial="${serial}";
    console.log(serial);
    let password = $('#password').val();
    if(ValiditeData(username,password)){
        const csrfToken = $('meta[name="csrf-token"]').attr('content');
        $.ajax({
            url: '/login',
            type: 'POST',
        headers: { 'X-CSRF-TOKEN': csrfToken },
            data: {
                username: username,
                password: password,
                serial:serial,
            },
            success: function(response) {

              window.location.href = response.router;
                
            },
            error: function(xhr, status, error) {
                
                showErrorToast('خطأ ','خطأ في تسجيل الدخول',)
            }
        });
    }
    
    

});



function ValiditeData(username,password){

let is_valid = true;
 if(username.length==0){
    
    $('.GroupName').addClass('is-invalid');
    $('.name-error').text('يجب ادخال الاسم');
    is_valid=false;
 }else{
     
    $('.GroupName').removeClass('is-invalid');
    $('.name-error').text('');
 }
 if(password.length <=0){
    $('.GroupPassword').addClass('is-invalid');
    $('.password-error').text('يجب ان يكون الرقم السري على الاقل 5 خانات');
    is_valid=false;

 }else{
    $('.GroupPassword').removeClass('is-invalid');
    $('.password-error').text('');
 }
 return is_valid;
}
      `);

      if (loadingWindow) {
        loadingWindow.close();
        loadingWindow = null;
      }
      mainWindow.show();
    });

  } catch (error) {
    console.error("Error occurred while loading the window:", error);
    reloadApp();
  }

  mainWindow.webContents.setWindowOpenHandler(async ({ url }) => {
    try {
      if (url.includes('/invoice') || url.includes('/period-report-htm')) {
        const invoiceWindow = new BrowserWindow({
          show: false,
          webPreferences: { contextIsolation: true },
        });
        invoiceWindow.loadURL(url);
        invoiceWindow.setMenu(Menu.buildFromTemplate(buildInvoiceMenu(convertToPDF, convertToJPG, promptForScaleFactor, invoiceWindow)));
        invoiceWindow.webContents.on('did-finish-load', () => printInvoiceWindow(invoiceWindow, scaleFactor));
        return { action: 'deny' };
      } else {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    } catch (error) {
      console.error("Error in window handler:", error);
      reloadApp();
    }
  });

  ipcMain.on('toggle-fullscreen', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
}

// Reload the app on error
function reloadApp() {
  if (mainWindow) {
    mainWindow.reload();
  } else {
    app.relaunch();
    app.exit(0);
  }
}

// Global error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  reloadApp();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  reloadApp();
});

// App initialization
app.whenReady().then(() => {
  createLoadingWindow();
  createMainWindow();
});

// Close the app when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Recreate the window on macOS when the dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
