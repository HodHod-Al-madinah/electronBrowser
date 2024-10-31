const { app, BrowserWindow, ipcMain, BrowserView } = require('electron');
const { exec } = require('child_process');
const path = require('path');

const batchFilePath = 'D:\\test\\go.bat'; // Path to your batch file
let mainWindow;
let mainView, outputView;

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

  // Create the main view (home tab) with the action button
  mainView = new BrowserView({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.setBrowserView(mainView);
  mainView.setBounds({ x: 0, y: 30, width: 1024, height: 738 }); // Adjust height based on your screen size
  mainView.webContents.loadURL(`data:text/html,
    <html>
      <body>
        <h3>Custom Actions</h3>
        <button id="openBatchBtn" style="width: 100%; padding: 10px; margin: 5px;">Run Batch File and Open in New Tab</button>
        <script>
          const { ipcRenderer } = require('electron');
          document.getElementById('openBatchBtn').addEventListener('click', () => ipcRenderer.send('run-batch-file'));
        </script>
      </body>
    </html>
  `);

  // Listen for IPC events to create new tabs
  ipcMain.on('run-batch-file', () => runBatchFileAndDisplayOutput());
}

// Function to switch views (simulates tab switching)
function switchToView(view) {
  mainWindow.setBrowserView(view);
  view.setBounds({ x: 0, y: 30, width: 1024, height: 738 });
}

// Function to run the batch file and display output in a new tab (BrowserView)
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

    // Create the output view (new tab) and display batch output
    outputView = new BrowserView({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    mainWindow.addBrowserView(outputView);
    outputView.setBounds({ x: 0, y: 30, width: 1024, height: 738 });
    outputView.webContents.loadURL(`data:text/html,
      <html>
        <body>
          <h3>Batch File Output</h3>
          <pre style="white-space: pre-wrap; word-wrap: break-word;">${output}</pre>
        </body>
      </html>
    `);

    // Switch to the output tab after loading
    switchToView(outputView);
  });
}

// Open the custom tab when the app is ready
app.whenReady().then(() => {
  createMainWindow();
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
