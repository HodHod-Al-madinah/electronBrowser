const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const { convertToPDF } = require('./helpers/pdfHelper');
const { convertToJPG } = require('./helpers/jpgHelper');
const { promptForScaleFactor } = require('./helpers/scaleHelper');
const { printInvoiceWindow } = require('./helpers/printHelper');
const { buildInvoiceMenu } = require('./helpers/menuHelper');
const si = require('systeminformation');

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
async function getBiosData() {
  try {
    const biosData = await si.bios();
    return biosData;
  } catch (error) {
    console.error('Error retrieving BIOS data:', error);
    return null;
  }
}


async  function createWindow() {
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
  const biosData = await getBiosData();
  if (biosData) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('bios-data', biosData); // Send BIOS data to renderer
    });
  }

  
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      $(document).on('click', '.login', (event) => {
        let username = $('#name').val();
        let password = $('#password').val();
        let bios =;
  
        if (ValiditeData(username, password)) {
          let csrfToken = $('meta[name="csrf-token"]').attr('content'); // Get the CSRF token
  
          $.ajax({
            url: '/login',
            type: 'POST',
            headers: { 'X-CSRF-TOKEN': csrfToken }, // Add CSRF token to headers
            data: {
              username: username,
              password: password
            },
            success: function(response) {
              window.location.href = response.router;
            },
            error: function(xhr, status, error) {
              showErrorToast('خطأ', 'خطأ في تسجيل الدخول');
            }
          });
        }
      });
  
      function ValiditeData(username, password) {
        let is_valid = true;
        if (username.length === 0) {
          $('.GroupName').addClass('is-invalid');
          $('.name-error').text('يجب ادخال الاسم');
          is_valid = false;
        } else {
          $('.GroupName').removeClass('is-invalid');
          $('.name-error').text('');
        }
        if (password.length <= 0) {
          $('.GroupPassword').addClass('is-invalid');
          $('.password-error').text('يجب ان يكون الرقم السري على الاقل 5 خانات');
          is_valid = false;
        } else {
          $('.GroupPassword').removeClass('is-invalid');
          $('.password-error').text('');
        }
        return is_valid;
      }
    `).then(result => {
      console.log(result);
    }).catch(error => {
      console.error('Error accessing button:', error);
    });
  });
  
  

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
