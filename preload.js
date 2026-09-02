const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  bringToFront: () => ipcRenderer.send('bring-to-front'),
  showDesktopAlert: (message) => ipcRenderer.send('show-desktop-alert', message),
  hideDesktopAlert: () => ipcRenderer.send('hide-desktop-alert'),
  onDesktopAlertMessage: (callback) => {
    ipcRenderer.on('desktop-alert-message', (_event, message) => callback(message));
  },
  onDesktopAlertDismissed: (callback) => {
    ipcRenderer.on('desktop-alert-dismissed', () => callback());
  }
});
