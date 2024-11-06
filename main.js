const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const { convertToPDF } = require('./helpers/pdfHelper');
const { convertToJPG } = require('./helpers/jpgHelper');
const { promptForScaleFactor } = require('./helpers/scaleHelper');
const { printInvoiceWindow } = require('./helpers/printHelper');
const { buildInvoiceMenu } = require('./helpers/menuHelper');

let mainWindow;
let settingsFile = path.join(__dirname, 'settings.json');
let scaleFactor = 88;  


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


function createWindow() {
  loadSettings();

  mainWindow = new BrowserWindow({
    fullscreen: true,
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'image', 'logo3.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true  // Window frame visible
  });


  mainWindow.loadURL('https://mobi-cashier.com/');


  mainWindow.webContents.setWindowOpenHandler(async ({ url }) => {
    if (url.includes('https://mobi-cashier.com/invoice')) {
      const invoiceWindow = new BrowserWindow({
        fullscreen: true,
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
      document.addEventListener('keydown', function(event) {
        if (event.key === 'F12') {
          window.close(); 
        } else if (event.key === 'F5') {
          location.reload();
        } else if (event.key === 'F11') {
          require('electron').ipcRenderer.send('toggle-fullscreen');
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
