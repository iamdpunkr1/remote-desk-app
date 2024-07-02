import { app, shell, BrowserWindow, ipcMain, desktopCapturer, Menu, screen } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import robot from "@hurdlegroup/robotjs"



let availableScreens;
let mainWindow;
let selectedScreen;
let scaleFactor:number=1;
let nativeOrigin = { x: 0, y: 0 };

const sendSelectedScreen = (item) => {
  mainWindow.webContents.send('SET_SOURCE_ID', item.id);
};

const createTray = () => {
  // console.log("Available Screens", availableScreens);
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
    width: 800,
    height: 600,
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
      // console.log("Sources: ", sources);

      // console.log("Available Screens", availableScreens);
      // selectedScreen = sources[0].thumbnail.getSize();
      
      // console.log("seleted screen: ",sources[0].thumbnail.getSize())
      mainWindow.webContents.send('AVAILABLE_SCREENS', sources.map(source => ({ id: source.id, name: source.name, display_id: source.display_id})));
      createTray();
    });
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; connect-src https://alegralabs.com:5007; script-src 'self'; style-src 'self'"]
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
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  selectedScreen = primaryDisplay.size;
  const displays = screen.getAllDisplays();
  console.log("Total Displays: ", displays);

  screen.on('display-added', (e) => {
    console.log("Display added: ", e);
    const displays = screen.getAllDisplays();
    console.log("Total Displays: ", displays.length);
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      availableScreens = sources;
      mainWindow.webContents.send('AVAILABLE_SCREENS', sources.map(source => ({ id: source.id, name: source.name })));
      createTray();
    } );
  } )

  screen.on('display-removed', (e) => {
    console.log("Display removed: ", e);
    const displays = screen.getAllDisplays();
    console.log("Total Displays: ", displays.length);
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      availableScreens = sources;
      mainWindow.webContents.send('AVAILABLE_SCREENS', sources.map(source => ({ id: source.id, name: source.name })));
      createTray();
    } );
    
  } )

  scaleFactor = primaryDisplay.scaleFactor;
  nativeOrigin = primaryDisplay.nativeOrigin;


  console.log(`Screen Size: ${width}x${height}`);

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

  ipcMain.on('mouse-move', (_, data) => {
    console.log("===Mouse-MOVE===");
    const { x:cx, y:cy } = data;
    // console.log("Remote screen: ",clientWidth, clientHeight)
    let  { width, height }  = selectedScreen;
    console.log("Selected Screen: ", width, height, scaleFactor)
    // console.log("Local screen: ", width, height)
    // const ratioX = width / clientWidth;
    // const ratioY = height / clientHeight;
    width = width * scaleFactor;
    height = height * scaleFactor;
    console.log("Selected Screen: multiplying scalefactor ", width, height, scaleFactor)

    // console.log("After Scale: Local screen: ", width, height)
    const adjustedX =  Math.round(cx * width);
    const adjustedY = Math.round(cy * height);
    const x = adjustedX + nativeOrigin.x;
    const y = adjustedY + nativeOrigin.y;
    // console.log("recieved X & Y ", x, y);
    // console.log("adjusted X & Y ", adjustedX, adjustedY);
    robot.moveMouseSmooth(x, y);
    console.log("===Mouse-MOVE===")

        // robot.moveMouse(x, y)
  });

  ipcMain.on('mouse-click', (_, data) => {
    const { x, y, button } = data;
    console.log("Mouse click", x, y, button)
    // robot.moveMouse(x, y);
    robot.mouseClick(button === 2 ? 'right' : 'left');
  });

  ipcMain.on('key-up', (_, data) => {
    const { key, code:modifier } = data;
    try{
     // Map of special keys to their robotjs equivalents
     const specialKeysMap = {
      'Shift': 'shift',
      'Enter': 'enter',
      'Control': 'control',
      'Alt': 'alt',
      'Meta': 'command',
      'Backspace': 'backspace',
      'Delete': 'delete',
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'Tab': 'tab'
    };

    const robotKey = specialKeysMap[key] || key.toLowerCase();
    // robot.keyTap(robotKey);
    robot.keyToggle(robotKey, 'down', modifier);
    robot.keyToggle(robotKey, 'up', modifier);
  
    }catch(e){
      console.log(e)
    }
  });

  ipcMain.on("screen-change", (_, data) => {
    console.log("Screen Change from FR: ", data)
    screen.getAllDisplays().forEach(display => {
      if (display.id == data) {
        selectedScreen = display.size;
        scaleFactor = display.scaleFactor;
        nativeOrigin = display.nativeOrigin;
        console.log("Selected Screen: ", selectedScreen);
      }
    });
  })

  ipcMain.on('mouse-scroll', (_, data) => {
    const { deltaX, deltaY} = data;
    robot.scrollMouse(deltaX, deltaY);
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
