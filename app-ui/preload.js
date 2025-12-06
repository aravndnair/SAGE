const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sageAPI", {
    search: (query) => ipcRenderer.send("search-query", query),
    onResult: (callback) =>
        ipcRenderer.on("search-result", (_, data) => callback(data))
});
