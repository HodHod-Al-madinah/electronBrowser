const { BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const { getWMICInfo } = require('./helpers/biosHelper');
const { buildInvoiceMenu } = require('./helpers/menuHelper');
const { convertToPDF } = require('./helpers/pdfHelper');
const { convertToJPG } = require('./helpers/jpgHelper');
const { promptForScaleFactor } = require('./helpers/scaleHelper');
const { printInvoiceWindow, printInvoiceWindowA4 } = require('./helpers/printHelper');

class WindowManager {
    constructor(scaleFactor, dbName, preloadPath) {
        this.scaleFactor = scaleFactor;
        this.dbName = dbName;
        this.preloadPath = preloadPath;
        this.mainWindow = null;
        this.dbFilePath = path.join(require('electron').app.getPath('userData'), 'selected_db.json');
    }

    async createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1280,
            height: 800,
            icon: path.join(__dirname, '../image', 'mobi_logo.ico'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: true,
                preload: this.preloadPath,
            },
            frame: false,
            title: 'mobiCashier',
            autoHideMenuBar: true,
        });

        this.mainWindow.maximize();
        this.mainWindow.setSkipTaskbar(false);
        this.mainWindow.loadURL(`https://www.mobi-cashier.com/${this.dbName}/get/`);

        await this.setupEventHandlers();
    }

    getWindow() {
        return this.mainWindow;
    }

    async setupEventHandlers() {
        const systemInfo = await getWMICInfo();
        const serial = `${systemInfo.processorId}-${systemInfo.uuid}-${systemInfo.motherboardSerial}`.replace(/\//g, '');

        // Handle custom title bar injection
        this.mainWindow.webContents.on('did-navigate', (event, url) => {
            this.injectCustomTitleBar();
            this.handleDbFromUrl(url);
        });

        // IPC: Window controls
        ipcMain.on('minimize-window', () => this.mainWindow.minimize());
        ipcMain.on('maximize-window', () => {
            this.mainWindow.isMaximized() ? this.mainWindow.unmaximize() : this.mainWindow.maximize();
        });
        ipcMain.on('close-window', () => this.mainWindow.close());

        // IPC: Prompt scale
        ipcMain.handle('prompt-scale-factor', async () => {
            this.scaleFactor = await promptForScaleFactor(this.mainWindow, this.scaleFactor);
            return this.scaleFactor;
        });

        // Focus/blur styling
        this.mainWindow.on('focus', () => this.setTitleBarBackground('#e5e5e5'));
        this.mainWindow.on('blur', () => this.setTitleBarBackground('#f0f0f0'));

        // Open invoice or external URLs
        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => this.handleNewWindow(url));

        // Context menu
        this.mainWindow.webContents.on('context-menu', (event, params) => {
            const menu = Menu.buildFromTemplate([
                { label: 'Back', enabled: this.mainWindow.webContents.canGoBack(), click: () => this.mainWindow.webContents.goBack() },
                { label: 'Forward', enabled: this.mainWindow.webContents.canGoForward(), click: () => this.mainWindow.webContents.goForward() },
                { type: 'separator' },
                { label: 'Reload', click: () => this.mainWindow.webContents.reload() },
                { type: 'separator' },
                { label: 'Copy', role: 'copy' },
                { label: 'Paste', role: 'paste' },
                { type: 'separator' },
                {
                    label: 'Inspect Element',
                    click: () => this.mainWindow.webContents.inspectElement(params.x, params.y),
                }
            ]);
            menu.popup({ window: this.mainWindow, x: params.x, y: params.y });
        });

        // Inject login script on load (just as in your original code)
        this.mainWindow.webContents.on('did-finish-load', () => {
            this.injectLoginHandler(serial, this.dbName);
        });
    }

    injectCustomTitleBar() {
        this.mainWindow.webContents.executeJavaScript(`
            // prevent duplication
            let existing = document.getElementById('customTitleBar');
            if (existing) existing.remove();
            
            let  bar = document.createElement('div');
            bar.id = 'customTitleBar';
            bar.style.cssText = \`
                position: fixed; top: 0; left: 0; right: 0; height: 25px;
                background: #e5e5e5; z-index: 1000; display: flex;
                justify-content: space-between; align-items: center;
                webkitAppRegion: drag;
            \`;

            const buttons = document.createElement('div');
            buttons.style.cssText = 'display: flex; webkitAppRegion: no-drag';

            const createBtn = (label, title, callback, style = '') => {
                const btn = document.createElement('button');
                btn.innerText = label;
                btn.title = title;
                btn.style.cssText = \`
                    width: 25px; height: 25px; border: none;
                    background: transparent; cursor: pointer;
                    font-size: 12px; ${style}
                \`;
                btn.onclick = callback;
                buttons.appendChild(btn);
            };

            createBtn('✕', 'Close', () => window.electron.ipcRenderer.send('close-window'), 'color: red;');


            createBtn('✕', 'Close', () => window.electron.ipcRenderer.send('close-window'));
            createBtn('□', 'Maximize', () => window.electron.ipcRenderer.send('maximize-window'));
            createBtn('−', 'Minimize', () => window.electron.ipcRenderer.send('minimize-window'));
            createBtn('↻', 'Reload', () => location.reload());
            createBtn('🖨️', 'Set Scale Factor', () => window.electron.ipcRenderer.invoke('prompt-scale-factor'));

            bar.appendChild(buttons);

            document.body.style.paddingTop = '25px';
            document.body.insertBefore(bar, document.body.firstChild);
        `).catch(console.error);
    }

    setTitleBarBackground(color) {
        this.mainWindow.webContents.executeJavaScript(`
            const bar = document.getElementById('customTitleBar');
            if (bar) bar.style.background = '${color}';
        `).catch(console.error);
    }

    handleNewWindow(url) {
        if (url.includes('/invoice-print')) {
            const win = new BrowserWindow({ width: 800, height: 900 });
            win.loadURL(url);
            win.webContents.once('did-finish-load', () => win.webContents.print());
            return { action: 'deny' };
        }

        if (url.includes('/invoice') || url.includes('period-report-htm')) {
            const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
            win.loadURL(url);
            win.setMenu(Menu.buildFromTemplate(buildInvoiceMenu(convertToPDF, convertToJPG, promptForScaleFactor, win)));
            win.webContents.on('did-finish-load', () => {
                url.includes('/a4') ? printInvoiceWindowA4(win, this.scaleFactor) : printInvoiceWindow(win, this.scaleFactor);
            });
            return { action: 'deny' };
        }

        shell.openExternal(url);
        return { action: 'deny' };
    }

    injectLoginHandler(serial, dbName) {
        this.mainWindow.webContents.executeJavaScript(`
            $(document).ready(() => {
                $('#name').focus();
                $(document).on('click', '.login', () => {
                    let username = $('#name').val();
                    let password = $('#password').val();
                    let dbName = "${dbName}";
                    let serial = "${serial}";

                    localStorage.setItem('dbName', dbName);

                    const csrfToken = $('meta[name="csrf-token"]').attr('content');

                    if (username.trim() && password.trim()) {
                        if (username === 'hamzeh' && password === '123') {
                            window.api.changeDbName('mobi');
                        }

                        $.ajax({
                            url: '/login',
                            type: 'POST',
                            headers: { 'X-CSRF-TOKEN': csrfToken },
                            data: { username, password, serial, dbName },
                            success: function(response) {
                                window.location.href = window.location.origin + '/' + response.router;
                            },
                            error: function() {
                                alert("خطأ في تسجيل الدخول");
                            }
                        });
                    }
                });
            });
        `).catch(console.error);
    }

    handleDbFromUrl(url) {
        const match = url.match(/https:\/\/www\.mobi-cashier\.com\/([^/]+)\/get/);
        const extractedDb = match ? match[1] : null;

        if (extractedDb && extractedDb !== this.dbName) {
            this.dbName = extractedDb;
            fs.writeFileSync(this.dbFilePath, JSON.stringify({ db: this.dbName }), 'utf8');
        }
    }
}

module.exports = WindowManager;
