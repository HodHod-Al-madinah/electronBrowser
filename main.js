const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const { convertToPDF } = require('./helpers/pdfHelper');
const { convertToJPG } = require('./helpers/jpgHelper');
const { promptForScaleFactor } = require('./helpers/scaleHelper');
// const { printInvoiceWindow } = require('./helpers/printHelper');
const { buildInvoiceMenu } = require('./helpers/menuHelper'); // Import the menu helper

let mainWindow;
let settingsFile = path.join(__dirname, 'settings.json');
let scaleFactor = 88;  // Default scale factor

// Function to load settings from the settings.json file
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

// Function to create the main window and load the main URL
function createWindow() {
  loadSettings(); // Load settings when the app starts

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

  // Load your main page
  mainWindow.loadURL('http://192.168.8.52:8000/');

  // Handle new tab opening for the invoice page
  mainWindow.webContents.setWindowOpenHandler(async ({ url }) => {
    if (url.includes('http://192.168.8.52:8000/invoice')) {
      const invoiceWindow = new BrowserWindow({
        fullscreen: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        }
      });

      // Load the invoice URL
      invoiceWindow.loadURL(url);

      // Use the helper function to build the menu
      const invoiceMenuTemplate = buildInvoiceMenu(convertToPDF, convertToJPG, promptForScaleFactor, invoiceWindow);
      const invoiceMenu = Menu.buildFromTemplate(invoiceMenuTemplate);
      invoiceWindow.setMenu(invoiceMenu);

      // Print the invoice and close the window
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

// Quit the app when all windows are closed, except on macOS
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
