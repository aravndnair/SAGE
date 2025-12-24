const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sageAPI", {
    search: (query) => ipcRenderer.send("search-query", query),
    onResult: (callback) =>
        ipcRenderer.on("search-result", (_, data) => callback(data))
});

// Expose Electron APIs for folder selection and file opening
contextBridge.exposeInMainWorld("electron", {
    selectFolder: () => ipcRenderer.invoke("select-folder"),
    openFile: (filePath) => ipcRenderer.invoke("open-file", filePath)
});
