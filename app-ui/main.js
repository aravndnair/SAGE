const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let pyProcess = null;
let win = null;

function createWindow() {
    win = new BrowserWindow({
        width: 1000,
        height: 700,
        backgroundColor: "#111",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    win.loadFile("index.html");
}

function startPython() {
    const scriptPath = path.join(__dirname, "../backend_service.py");
    pyProcess = spawn("python", [scriptPath]);

    console.log("🚀 Python backend started");

    // Correct stdout handler
    pyProcess.stdout.on("data", (data) => {
        const text = data.toString().trim();
        console.log("PY:", text);

        // If it's JSON → forward to UI
        try {
            const parsed = JSON.parse(text);
            win?.webContents.send("search-result", parsed);
        } catch (_) {
            // Not JSON → ignore, just a log message
        }
    });

    // Log warnings, not errors
    pyProcess.stderr.on("data", (data) => {
        console.warn("PY WARN:", data.toString());
    });

    // If backend crashes → restart
    pyProcess.on("exit", (code) => {
        console.log("⚠️ Backend crashed with code", code, "- Restarting...");
        setTimeout(startPython, 1500);
    });
}

app.whenReady().then(() => {
    createWindow();
    startPython();
});

// Forward search query to Python
ipcMain.on("search-query", (_, query) => {
    if (!pyProcess) return;
    pyProcess.stdin.write(JSON.stringify({ query }) + "\n");
});

// Cleanup
app.on("window-all-closed", () => {
    if (pyProcess) {
        console.log("🛑 Killing Python backend...");
        pyProcess.kill();
    }
    if (process.platform !== "darwin") app.quit();
});
