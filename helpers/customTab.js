const { app, ipcMain } = require('electron');
const { exec } = require('child_process');
const { openCustomTab } = require('./path/to/your/customTab'); // Update path to where you saved the customTab file

const batchFilePath = 'D:\\test\\go.bat';

// Function to open a new tab and display the batch file output
function openOutputTab(output) {
  const outputTab = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  outputTab.loadURL(`data:text/html,
    <html>
      <body>
        <h3>Batch File Output</h3>
        <pre style="white-space: pre-wrap; word-wrap: break-word;">${output}</pre>
      </body>
    </html>
  `);
}

// Listen for the event to run the batch file and capture output
ipcMain.on('run-batch-file', () => {
  exec(`"${batchFilePath}"`, (error, stdout, stderr) => {
    if (error) {
      openOutputTab(`Error executing batch file: ${error.message}`);
      return;
    }
    if (stderr) {
      openOutputTab(`Batch file stderr: ${stderr}`);
      return;
    }
    openOutputTab(stdout);
  });
});

// Open the custom tab when the app is ready
app.whenReady().then(() => {
  openCustomTab();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    openCustomTab();
  }
});
