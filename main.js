const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { convertToPDF } = require('./helpers/pdfHelper');
const { convertToJPG, convertToJPGAndOpenWhatsApp } = require('./helpers/jpgHelper');  // Import both functions
const { promptForScaleFactor } = require('./helpers/scaleFactor');
const { loadSettings, saveSettings } = require('./utils/settings');



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

  mainWindow.loadURL('http://127.0.0.1:8000');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('invoice')) {
      console.log("URL contains invoice");
      openInvoiceWindow(url);  // Open the invoice window in the background
      return { action: 'deny' };
    } else {
      openNewWindow(url); 
      return { action: 'deny' };
    }
  });

  // Catch any error related to loading the URL
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // Show an alert dialog with error details
    dialog.showErrorBox('Failed to Load URL', `Error: ${errorDescription}\nURL: ${validatedURL}`);
    console.log(`Error Code: ${errorCode}, Error Description: ${errorDescription}`);
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
    saveSettings(scaleFactor);
  });
}

// Function to open a new window for the invoice
function openInvoiceWindow(url) {
  const invoiceWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,  // Hide the window, run in the background
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: true
  });

  invoiceWindow.loadURL(url);

  // Set a custom menu with icons only (Optional)
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
    },
    {
      label: '💬 WhatsApp',
      click: () => convertToJPGAndOpenWhatsApp(invoiceWindow)  // Ensure the correct function is called here
    }
  ]);

  invoiceWindow.setMenu(menu);

  // Print when the content is loaded, then close the window
  invoiceWindow.webContents.on('did-finish-load', () => {
    //   invoiceWindow.webContents.print({
    //     silent: true,  // Silent printing, no dialog shown
    //     printBackground: true,
    //     margins: {
    //       marginType: 'custom',
    //       top: 0,
    //       bottom: 0,
    //       left: 30,
    //       right: 0
    //     },
    //     landscape: false,
    //     pageSize: {
    //       width: 80 * 1000,  // 80mm width for EZP003
    //       height: 297000,    // A4 height or customize as needed
    //     },
    //     scaleFactor: scaleFactor,  // Apply user-defined scale factor
    //   }, (success, errorType) => {
    //     if (!success) {
    //       console.error('Print failed: ', errorType);
    //     } else {
    //       console.log('Print success!');
    //     }

    //     // Close the hidden invoice window after printing
    //   invoiceWindow.close();
    // });
  });
}

// Function to open a general new window
function openNewWindow(url) {
  const newWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Hide the window and perform actions in the background
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: true
  });
  newWindow.loadURL(url);

  // You can perform other background tasks in the new window if needed
  newWindow.webContents.on('did-finish-load', () => {
    console.log('New window content loaded in the background.');
    newWindow.close();  // Close after loading, or you can perform additional actions
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
