const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const { convertToPDF } = require('./helpers/pdfHelper');
const { convertToJPG, convertToJPGAndOpenWhatsApp } = require('./helpers/jpgHelper');  // Import both functions
const { promptForScaleFactor } = require('./helpers/scaleFactor');
const { loadSettings, saveSettings } = require('./utils/settings');
const fs = require('fs');

let mainWindow;
let scaleFactor = 88;  // Default scale factor
let whatsappNumber = '';  // Store WhatsApp number

// Path to settings file for saving the WhatsApp number
const settingsFilePath = path.join(__dirname, 'settings.json');

// Load WhatsApp number from settings file
function loadWhatsAppNumber() {
  try {
    const data = fs.readFileSync(settingsFilePath);
    const settings = JSON.parse(data);
    whatsappNumber = settings.whatsapp_number || '';
    console.log('Loaded WhatsApp Number:', whatsappNumber);
  } catch (error) {
    console.log('No WhatsApp number found, using default.');
  }
}

// Save WhatsApp number to settings file
function saveWhatsAppNumber(number) {
  const settings = { whatsapp_number: number };
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
  console.log('WhatsApp number saved:', number);
}

// Create the main window
function createWindow() {
  // Load the last used scaleFactor from settings
  scaleFactor = loadSettings(); // Load settings when the app starts
  loadWhatsAppNumber(); // Load WhatsApp number

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
        } else if (event.key === 'F11') {
          const isFullScreen = window.isFullScreen();
          window.setFullScreen(!isFullScreen);
        }
      });
    `);
  });

  // Set a custom menu in the main window with an option to save WhatsApp number
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Save WhatsApp Number',
          click: () => {
            // Open a dialog to enter WhatsApp number
            const number = dialog.showInputBox({
              message: 'Enter WhatsApp Number (with country code):',
              value: whatsappNumber || '+966'
            });

            if (number) {
              saveWhatsAppNumber(number);
              whatsappNumber = number;  // Update the variable
              dialog.showMessageBox(mainWindow, {
                message: `WhatsApp Number Saved: ${number}`,
                buttons: ['OK']
              });
            }
          }
        },
        {
          label: 'Quit',
          role: 'quit'
        }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);

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
    show: true,
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
      click: () => convertToJPGAndOpenWhatsApp(invoiceWindow, whatsappNumber)  // Ensure the correct function is called here
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
