const path = require("path");
const { app, ipcMain } = require("electron");
const serve = require("electron-serve");
const { createWindow } = require("./helpers/index.js");

const isProd = process.env.NODE_ENV === "production";

// ⚡ Fix rendering / input focus issues (important for your case)
app.disableHardwareAcceleration();

if (isProd) {
  serve({ directory: "app" });
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`);
}

let mainWindow; // ✅ keep reference globally

async function createMainWindow() {
  mainWindow = createWindow("main", {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 🔥 FIX: ensure proper focus + input click bug fix
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.focus();
  });

  if (isProd) {
    await mainWindow.loadURL("app://./");
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/`);

    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

// ⚡ Electron lifecycle (correct structure)
app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // macOS fix
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC (unchanged)
ipcMain.on("message", (event, arg) => {
  event.reply("message", `${arg} World!`);
});
