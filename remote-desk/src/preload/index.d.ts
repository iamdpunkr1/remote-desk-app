import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: {
      setSize: (size: { width: number; height: number }) => void;
      getHostName: (callback: (event: any, hostName: string) => void) => void;  
      getScreenId: (callback: (event: any, screenId: string) => void) => void;
      getAvailableScreens: (callback: (event: any, screens: any[]) => void) => void;
      sendMouseMove: (data: { x: number, y: number }) => void;
      sendMouseClick: (data: { x: number, y: number, button: number }) => void;
      sendKeyUp: (data: { key: string, code: string }) => void;
      sendScreenChange: (data: string) => void;
      sendMouseScroll: (data: { deltaX: number, deltaY: number }) => void;
      sendMouseDown: (data: boolean) => void;
      sendMouseUp: (data: boolean) => void;
      onAppClosing: (callback: () => void) => void;
      onPerformDisconnect: (callback: () => void) => void;
      onQuitCancelled: (callback: () => void) => void;
      sendConfirmQuit: (hasActiveConnection: boolean) => void;
      sendQuitApp: () => void;
    }
  }
}
