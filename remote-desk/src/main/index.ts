import { app, shell, BrowserWindow, ipcMain, desktopCapturer,  screen, dialog } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import robot from "@hurdlegroup/robotjs"
import os from "os";

// //console.log("OS: ", os.platform(), os.hostname(), os.userInfo());

let availableScreens;
let mainWindow;
//let selectedScreen;
// let scaleFactor:number=1;
let screenHeight:number;
let screenWidth:number;
let nativeOrigin = { x: 0, y: 0 };
let isQuitting:boolean = false;

const sendDisplays= async () => {
  const displays = screen.getAllDisplays();
  let display_id = displays.map(d => d.id)
  //console.log("before: ", display_id)
  
  if(displays.length>1){
    if(!screen.getPrimaryDisplay().internal){
      [display_id[1], display_id[0]] = [display_id[0], display_id[1]];
    }
  }
  
  //console.log("after: ", display_id)

  const sources = await desktopCapturer.getSources({types:["screen"]})
  // //console.log("sources: ", sources)
  availableScreens = sources.map((source, index) => {
    return {
      id: source.id,
      name: source.name,
      display_id:display_id[index]
    }
  });

  //console.log(availableScreens)

  
  mainWindow.webContents.send('AVAILABLE_SCREENS', availableScreens);
}

// const sendSelectedScreen = (item) => {
//   mainWindow.webContents.send('SET_SOURCE_ID', item.id);
// };

// const createTray = () => {
//   // //console.log("Available Screens", availableScreens);
//   const screensMenu = availableScreens.map(item => {
//     return {
//       label: item.name,
//       click: () => {
//         sendSelectedScreen(item);
//       }
//     };
//   });

//   const menu = Menu.buildFromTemplate([
//     {
//       label: app.name,
//       submenu: [
//         { role: 'quit' }
//       ]
//     },
//     {
//       label: 'Screens',
//       submenu: screensMenu
//     }
//   ]);

//   Menu.setApplicationMenu(menu);
// };
function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
       
      
    },
    icon: icon
  });

  ipcMain.on('SET_SIZE', (_, size) => {
    const { width, height } = size;
    try {
      mainWindow.setSize(width, height, true);
    } catch (e) {
      //console.log(e);
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    sendDisplays();
    mainWindow.webContents.send("HOSTNAME", os.hostname());
    // desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
    //   availableScreens = sources;
      // //console.log("Sources: ", sources[0].thumbnail.toJPEG(100));
      // //console.log("Available Screens", availableScreens);
      // selectedScreen = sources[0].thumbnail.getSize();
      
      // //console.log("seleted screen: ",sources[0].thumbnail.getSize())
      
      // mainWindow.webContents.send('AVAILABLE_SCREENS', sources.map(source => ({ id: source.id, name: source.name, display_id: source.display_id})));
      // createTray();

    // });
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

  // Handle window close event
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow!.webContents.send('app-closing');
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  screenHeight = height * primaryDisplay.scaleFactor;
  screenWidth = width * primaryDisplay.scaleFactor;
  //selectedScreen = primaryDisplay.size;
  // const displays = screen.getAllDisplays();
  // //console.log("Total Displays: ", displays);
  // desktopCapturer.getSources({ types: ['screen'], thumbnailSize:{width:1, height:1} }).then((sources) => {
  //   availableScreens = sources;
  //   //console.log("Sources: ",sources)
    // mainWindow.webContents.send('AVAILABLE_SCREENS', sources.map(source => ({ id: source.id, name: source.name })));
    // createTray();


  // } );
  // desktopCapturer.getSources(sources => //console.log("Sources: ",sources))

  screen.on('display-added', (_) => {
    // //console.log("Display added: ", e);
    // const displays = screen.getAllDisplays();
    // //console.log("Total Displays: ", displays.length);
  
    // desktopCapturer.getSources({ types: ['screen'], thumbnailSize:{width:1, height:1} }).then((sources) => {
    //   availableScreens = sources;
    //   //console.log("Sources: ",sources)
    //   mainWindow.webContents.send('AVAILABLE_SCREENS', sources.map(source => ({ id: source.id, name: source.name })));
    //   // createTray();


    // } );
    sendDisplays();
  } )

  screen.on('display-removed', (_) => {
    //console.log("Display removed: ", e);
    sendDisplays();
    // const displays = screen.getAllDisplays();
    // //console.log("Total Displays: ", displays.length);
    // desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
    //   availableScreens = sources;
      // mainWindow.webContents.send('AVAILABLE_SCREENS', sources.map(source => ({ id: source.id, name: source.name })));
      // createTray();
    // } )
    // .then(()=> sendDisplays())
      //  .catch(e => //console.log("get display error occured: ", e))
    
  } )

  // scaleFactor = primaryDisplay.scaleFactor;
  nativeOrigin = primaryDisplay.nativeOrigin;


  // //console.log(`Screen Size: ${width}x${height}`);

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  //ipcMain.on('ping', () => //console.log('pong'));

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  ipcMain.on('mouse-down', (_, __) => {
    try{
      robot.mouseToggle("down");
    }catch(e){
      //console.log("Mouse-down: "+e)
    }
  });

  ipcMain.on('mouse-up', (_, __) => {
    try{
      robot.mouseToggle("up");
    }catch(e){
      //console.log("Mouse-up: "+e)
    }
  });

  ipcMain.on('mouse-move', (_, data) => {
    // //console.log("Mouse move: ", data)
    try{
    // console.time("Mouse move")
    const { x:cx, y:cy } = data;

    // if(isDraggable){
    //   robot.mouseToggle("down");

    // }else{
    //   robot.mouseToggle("up");

    // }
    // let  { width, height }  = selectedScreen;
    // //console.log("Selected Screen: ", width, height, scaleFactor)

    // width = width * scaleFactor;
    // height = height * scaleFactor;
    // //console.log("Selected Screen: multiplying scalefactor ", width, height, scaleFactor)

      //console.log("native origin: ", nativeOrigin)
    const x =  Math.round(cx * screenWidth)+ nativeOrigin.x;
    const y = Math.round(cy * screenHeight) + nativeOrigin.y;
    // const x = adjustedX 
    // const y = adjustedY

    robot.moveMouse(x, y);
    // console.timeEnd("Mouse move")
  }catch(e){
    //console.log("Mouse Move error: ", e);
  }

        // robot.moveMouse(x, y)
  });

  ipcMain.on('mouse-click', (_, data) => {
    try{
      const { x:_, y:__, button } = data;
      //console.log("Mouse click", x, y, button)
      // robot.moveMouse(x, y);
      robot.mouseClick(button === 2 ? 'right' : 'left');
    }catch(e){
      //console.log("Mouse-click: "+e)
    }
  });

  ipcMain.on('key-up', (_, data) => {
    try{
    const { key, code:modifier } = data;
    
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
      // //console.log(e)
    }
  });

  ipcMain.on("screen-change", (_, data) => {
    //console.log("Screen Change from FR: ", data)

    screen.getAllDisplays().forEach(display => {
      //console.log("Display: ", display)
      if (display.id == data) {
        //selectedScreen = display.size;
        screenHeight = display.size.height * display.scaleFactor;
        screenWidth = display.size.width * display.scaleFactor;
        // scaleFactor = display.scaleFactor;
        nativeOrigin = display.nativeOrigin;
        //console.log("screen change: native Origin :",nativeOrigin)
        //console.log("display native origin: ", display.nativeOrigin)

        //console.log("Selected Screen: ", selectedScreen);
      }
    });
  })

  ipcMain.on('mouse-scroll', (_, data) => {
    try{
      const { deltaX, deltaY} = data;
      robot.scrollMouse(deltaX, deltaY);
    }catch(e){
      // //console.log("Mouse-scroll: "+e)
    }
  });
});


ipcMain.on('confirm-quit', (event, hasActiveConnection) => {
  // //console.log("Confirm quit ", hasActiveConnection)
  if (hasActiveConnection) {
    // //console.log("Has active connection")
    dialog.showMessageBox(mainWindow!, {
      type: 'question',
      buttons: ['Stay', 'Quit'],
      title: 'Confirm',
      message: 'You have an active connection. Are you sure you want to quit?'
    }).then(({ response }) => {
      if (response === 1) { // User chose to quit
        mainWindow!.webContents.send('perform-disconnect');
      } else {
        event.sender.send('quit-cancelled');
      }
    });
  } else {
    // //console.log("No active connection")
    isQuitting = true;
    app.quit();
  }
});

ipcMain.on('quit-app', () => {
  isQuitting = true;
  app.quit();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});