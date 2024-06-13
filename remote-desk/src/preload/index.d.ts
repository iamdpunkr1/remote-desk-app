import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: {
      setSize: (size: { width: number, height: number }) => void
      getScreenId: (cb: (event: Electron.IpcRendererEvent, id: string) => void) => void
    }
  }
}
