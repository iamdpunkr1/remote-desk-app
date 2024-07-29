import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
    contextBridge.exposeInMainWorld('electronAPI', {
      setSize: (size) => ipcRenderer.send('set-size', size),
      getHostName: (callback) => ipcRenderer.on('HOSTNAME', callback),
      getScreenId: (callback) => ipcRenderer.on('SET_SOURCE_ID', callback),
      getAvailableScreens: (callback) => ipcRenderer.on('AVAILABLE_SCREENS', callback),
      sendMouseMove: (data) => ipcRenderer.send('mouse-move', data),
      sendMouseClick: (data) => ipcRenderer.send('mouse-click', data),
      sendKeyUp: (data) => ipcRenderer.send('key-up', data),
      sendScreenChange: (data:string) => ipcRenderer.send('screen-change', data),
      sendMouseScroll: (data) => ipcRenderer.send('mouse-scroll', data),
      sendMouseDown: (data) => ipcRenderer.send('mouse-down', data),
      sendMouseUp: (data) => ipcRenderer.send('mouse-up', data),
      // Add these new methods
      onAppClosing: (callback) => ipcRenderer.on('app-closing', callback),
      onPerformDisconnect: (callback) => ipcRenderer.on('perform-disconnect', callback),
      onQuitCancelled: (callback) => ipcRenderer.on('quit-cancelled', callback),
      sendConfirmQuit: (hasActiveConnection) => ipcRenderer.send('confirm-quit', hasActiveConnection),
      sendQuitApp: () => ipcRenderer.send('quit-app'),
    });
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
