const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
let settingsFile = path.join(__dirname, 'settings.json');
let scaleFactor = 88;  // Default scale factor

// Function to load settings from the settings.json file
function loadSettings() {
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

// Function to save the current scaleFactor to the settings.json file
function saveSettings() {
  const settings = {
    scaleFactor: scaleFactor,
  };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

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
        webPreferences: {
          fullscreen: true,
          nodeIntegration: false,
          contextIsolation: true,
        }
      });

      invoiceWindow.loadURL(url);

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
        }
      });
    `);
  });

  // Add emojis directly to the menu
  const menu = Menu.buildFromTemplate([
    {
      label: '📄 Convert to PDF',  // PDF emoji
      click: () => {
        convertToPDF();
      }
    },
    {
      label: '🖼️ Convert to JPG',  // JPG emoji
      click: () => {
        convertToJPG();
      }
    },
    {
      label: '📏 Set Scale Factor',  // Ruler emoji for scale factor
      click: () => {
        promptForScaleFactor();
      }
    }
  ]);

  Menu.setApplicationMenu(menu);  // Set the new menu with emojis
}

// Function to convert the current page to PDF
function convertToPDF() {
  const pdfPath = path.join(__dirname, 'output.pdf');  // Path to save the PDF file
  
  mainWindow.webContents.printToPDF({
    marginsType: 1,  // 1 = Custom margins
    printBackground: true,
    pageSize: 'A4',
  }).then(data => {
    fs.writeFileSync(pdfPath, data);

    // Open the PDF in a new window
    const pdfWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      frame: true,  // Keep frame visible with the close button (X)
    });

    // Load the PDF file in the new window
    pdfWindow.loadURL(`file://${pdfPath}`);

    // Optional: Add a "Close" menu option in the PDF window
    const pdfMenu = Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          {
            label: 'Close',
            click: () => {
              pdfWindow.close();  // Close the PDF window
            }
          }
        ]
      }
    ]);
    pdfWindow.setMenu(pdfMenu);

    dialog.showMessageBox(mainWindow, {
      message: 'PDF created successfully!',
      detail: `PDF saved to: ${pdfPath}`
    });
    
  }).catch(error => {
    console.error('Failed to generate PDF:', error);
  });
}

// Function to convert the current page to JPG
function convertToJPG() {
  const jpgPath = path.join(__dirname, 'output.jpg');  // Path to save the JPG file

  mainWindow.webContents.capturePage().then(image => {
    fs.writeFileSync(jpgPath, image.toJPEG(100));  // Save image as JPEG

    // Open the JPG in a new window
    const jpgWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      frame: true,  // Keep frame visible with the close button (X)
    });

    // Load the JPG file in the new window
    jpgWindow.loadURL(`file://${jpgPath}`);

    // Optional: Add a "Close" menu option in the JPG window
    const jpgMenu = Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          {
            label: 'Close',
            click: () => {
              jpgWindow.close();  // Close the JPG window
            }
          }
        ]
      }
    ]);
    jpgWindow.setMenu(jpgMenu);

    dialog.showMessageBox(mainWindow, {
      message: 'JPG created successfully!',
      detail: `JPG saved to: ${jpgPath}`
    });

  }).catch(error => {
    console.error('Failed to generate JPG:', error);
  });
}

// Function to prompt user for scale factor via radio button-like selection
async function promptForScaleFactor() {
  const options = {
    type: 'info',
    buttons: ['92%', '90%', '88%', '85%', '83%', 'Cancel'],
    defaultId: getScaleFactorButtonIndex(),  // Default to the currently selected scale factor
    title: 'Set Scale Factor',
    message: `Current scale factor: ${scaleFactor}%`,
    detail: 'Select a scale factor to apply.',
  };

  const response = await dialog.showMessageBox(mainWindow, options);

  // Handle the user's selection
  switch (response.response) {
    case 0:  // 92%
      scaleFactor = 92;
      break;
    case 1:  // 90%
      scaleFactor = 90;
      break;
    case 2:  // 88%
      scaleFactor = 88;
      break;
    case 3:  // 85%
      scaleFactor = 85;
      break;
    case 4:  // 83%
      scaleFactor = 83;
      break;
    case 5:  // Cancel
      return;  // Do nothing
  }

  saveSettings();  // Save the new scaleFactor to the settings file

  // Show confirmation dialog with the updated scale factor
  dialog.showMessageBox(mainWindow, {
    message: `Scale factor set to ${scaleFactor}%`
  });
}

// Function to get the current scaleFactor as the default button index
function getScaleFactorButtonIndex() {
  switch (scaleFactor) {
    case 92: return 0;
    case 90: return 1;
    case 88: return 2;
    case 85: return 3;
    case 83: return 4;
    default: return 2;  // Default to 88% if no match
  }
}

// Create the main window when Electron is ready
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
