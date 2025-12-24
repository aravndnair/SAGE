const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");

let win = null;

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: "#f5f5f7",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    win.loadFile(path.join(__dirname, "dist", "index.html"));
    
    // Open DevTools in development
    win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();
});

// Folder selection dialog
ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog(win, {
        properties: ["openDirectory"]
    });
    
    // Return first selected path or null
    return result.canceled ? null : result.filePaths[0];
});

// Open file in default app
ipcMain.handle("open-file", async (_, filePath) => {
    try {
        await shell.openPath(filePath);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Cleanup
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
