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
      getScreenId: (callback) => ipcRenderer.on('SET_SOURCE_ID', callback),
      getAvailableScreens: (callback) => ipcRenderer.on('AVAILABLE_SCREENS', callback),
      sendMouseMove: (data) => ipcRenderer.send('mouse-move', data),
      sendMouseClick: (data) => ipcRenderer.send('mouse-click', data),
      sendKeyUp: (data) => ipcRenderer.send('key-up', data),
      sendScreenChange: (data:string) => ipcRenderer.send('screen-change', data),
      sendMouseScroll: (data) => ipcRenderer.send('mouse-scroll', data),
      sendMouseDown: (data) => ipcRenderer.send('mouse-down', data),
      sendMouseUp: (data) => ipcRenderer.send('mouse-up', data),
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
