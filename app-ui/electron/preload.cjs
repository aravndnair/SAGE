const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sage", {
  openFile: (filePath) => ipcRenderer.invoke("open-file", filePath),
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  saveRoots: (roots) => ipcRenderer.invoke("save-roots", roots),
  triggerReindex: () => ipcRenderer.invoke("trigger-reindex"),
});
