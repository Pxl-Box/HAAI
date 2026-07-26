import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  saveDigitalTwinFiles: (twinData: any) => ipcRenderer.invoke('save-digital-twin-files', twinData),
  loadDigitalTwinFiles: () => ipcRenderer.invoke('load-digital-twin-files')
});
