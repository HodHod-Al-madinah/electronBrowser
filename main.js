const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { loadSettings, saveSettings } = require('./utils/settings');
const { convertToPDF } = require('./helpers/pdfHelper');
const { convertToJPG } = require('./helpers/jpgHelper');

let mainWindow;
let scaleFactor = 88;  // Default scale factor

// Create the main window
function createWindow() {
  // Load the last used scaleFactor from settings
  scaleFactor = loadSettings(); // Load settings when the app starts

  mainWindow = new BrowserWindow({
    fullscreen: true,
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '../image/logo3.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true  // Window frame visible
  });

  mainWindow.loadURL('http://192.168.8.52:8000/');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('invoice')) {
      console.log("URL contains invoice");
      openInvoiceWindow(url);
      return { action: 'deny' };
    } else {
      openNewWindow(url);
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
        }
      });
    `);
  });

  // Save the current scaleFactor before closing
  mainWindow.on('close', () => {
    saveSettings(scaleFactor); // Save the current scaleFactor to settings.json
  });
}

// Function to open a new window for the invoice
function openInvoiceWindow(url) {
  const invoiceWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: true
  });

  invoiceWindow.loadURL(url);

  // Set a custom menu with icons only
  const menu = Menu.buildFromTemplate([
    {
      label: '📄 PDF',
      click: () => convertToPDF(invoiceWindow)
    },
    {
      label: '🖼️ JPG',
      click: () => convertToJPG(invoiceWindow)
    },
    {
      label: '📏 Scale',
      click: () => promptForScaleFactor(invoiceWindow)
    }
  ]);
  
  invoiceWindow.setMenu(menu);

  // Print when the content is loaded, then close the window
  invoiceWindow.webContents.on('did-finish-load', () => {
    invoiceWindow.webContents.print({
      silent: true,  // Silent printing, no dialog shown
      printBackground: true,
      margins: {
        marginType: 'custom',
        top: 0,
        bottom: 0,
        left: 30,
        right: 0
      },
      landscape: false,
      pageSize: {
        width: 80 * 1000,
        height: 297000,
      },
      scaleFactor: scaleFactor,  // Apply user-defined scale factor
    }, (success, errorType) => {
      if (!success) {
        console.error('Print failed: ', errorType);
      } else {
        console.log('Print success!');
      }

      invoiceWindow.close();
    });
  });

  // Close the window after 1 second (1000 milliseconds)
  setTimeout(() => {
    invoiceWindow.close();
  }, 1000);
}

// Function to open a general new window
function openNewWindow(url) {
  const newWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: true
  });
  newWindow.loadURL(url);
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
