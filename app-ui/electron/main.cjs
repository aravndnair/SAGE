const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    backgroundColor: "#f2f2f7",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.loadURL("http://localhost:5173");
}

ipcMain.handle("open-file", async (_, filePath) => {
  if (!filePath) return;
  await shell.openPath(filePath);
});

ipcMain.handle("pick-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("save-roots", async (_, roots) => {
  const res = await fetch("http://127.0.0.1:8000/roots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roots }),
  });

  return res.json();
});

ipcMain.handle("trigger-reindex", async () => {
  // 🔥 fire-and-forget — DO NOT await indexing
  fetch("http://127.0.0.1:8000/reindex", { method: "POST" });
  return { status: "ok" };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
