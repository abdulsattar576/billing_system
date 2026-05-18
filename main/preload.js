const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ipc", {
  send(channel, value) {
    ipcRenderer.send(channel, value);
  },

  on(channel, callback) {
    const handler = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, handler);

    return () => ipcRenderer.removeListener(channel, handler);
  },
});
