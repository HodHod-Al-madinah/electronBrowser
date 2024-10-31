const { app, BrowserWindow, BrowserView, ipcMain, globalShortcut } = require('electron');
const { exec } = require('child_process');
const path = require('path');

let mainWindow;
let mainView, outputView;
let activeView; 
const batchFilePath = 'D:\\test\\go.bat'; 

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  registerShortcuts();

  mainView = new BrowserView({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.addBrowserView(mainView);
  mainView.setBounds({ x: 0, y: 50, width: 1024, height: 718 });
  
  mainView.webContents.loadURL(`data:text/html,
    <html>
      <body>
        <button id="runBatchBtn" style="width: 40%; padding: 10px;">Open Program</button>
        <script>
          const { ipcRenderer } = require('electron');
          document.getElementById('runBatchBtn').addEventListener('click', () => ipcRenderer.send('run-batch-file'));
        </script>
      </body>
    </html>
  `);

  activeView = mainView;

  ipcMain.on('run-batch-file', () => runBatchFileAndDisplayOutput());
}

function registerShortcuts() {

  globalShortcut.register('F12', () => {
    if (activeView) {
      activeView.webContents.openDevTools();
    }
  });

  globalShortcut.register('F11', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });

  globalShortcut.register('F5', () => {
    if (activeView) {
      activeView.webContents.reload();
    }
  });
}

function switchToView(view) {
  mainWindow.removeBrowserView(activeView);
  activeView = view;
  mainWindow.addBrowserView(activeView);
  activeView.setBounds({ x: 0, y: 50, width: 1024, height: 718 });
}

function runBatchFileAndDisplayOutput() {
  exec(`"${batchFilePath}"`, (error, stdout, stderr) => {
    let output = '';
    if (error) {
      output = `Error executing batch file: ${error.message}`;
    } else if (stderr) {
      output = `Batch file stderr: ${stderr}`;
    } else {
      output = stdout;
    }

    if (!outputView) {
      outputView = new BrowserView({
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
      });
    }
    
    mainWindow.addBrowserView(outputView);
    outputView.setBounds({ x: 0, y: 50, width: 1024, height: 718 });

    outputView.webContents.loadURL(`data:text/html,
      <html>
        <body>
          <h3>Batch File Output</h3>
          <pre style="white-space: pre-wrap; word-wrap: break-word;">${output}</pre>
        </body>
      </html>
    `);

  
    switchToView(outputView);
  });
}

app.whenReady().then(createMainWindow);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
