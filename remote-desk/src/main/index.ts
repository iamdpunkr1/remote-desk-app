import { app, shell, BrowserWindow, ipcMain, desktopCapturer, Menu } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';

let availableScreens;
let mainWindow;

const sendSelectedScreen = (item) => {
  mainWindow.webContents.send('SET_SOURCE_ID', item.id);
};

const createTray = () => {
  console.log("Available Screens", availableScreens);
  const screensMenu = availableScreens.map(item => {
    return {
      label: item.name,
      click: () => {
        sendSelectedScreen(item);
      }
    };
  });

  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Screens',
      submenu: screensMenu
    }
  ]);

  Menu.setApplicationMenu(menu);
};

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  ipcMain.on('SET_SIZE', (_, size) => {
    const { width, height } = size;
    try {
      mainWindow.setSize(width, height, true);
    } catch (e) {
      console.log(e);
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      availableScreens = sources;
      mainWindow.webContents.send('AVAILABLE_SCREENS', sources.map(source => ({ id: source.id, name: source.name })));
      createTray();
    });
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; connect-src http://localhost:5000; script-src 'self'; style-src 'self'"]
      }
    });
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on('ping', () => console.log('pong'));

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
