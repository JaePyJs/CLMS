const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  login: (credentials) => ipcRenderer.invoke("login", credentials),
  logout: () => ipcRenderer.invoke("logout"),
  getConfig: () => ipcRenderer.invoke("get-config"),
  setConfig: (config) => ipcRenderer.invoke("set-config", config),
  testConnection: (serverUrl) =>
    ipcRenderer.invoke("test-connection", serverUrl),
  onScanResult: (callback) => {
    ipcRenderer.on("scan-result", (event, data) => callback(data));
  },
});
