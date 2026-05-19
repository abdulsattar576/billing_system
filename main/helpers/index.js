//main/halpers/index.js
const { screen, BrowserWindow } = require("electron");
const Store = require("electron-store");

const createWindow = (windowName, options) => {
  const store = new Store({ name: `window-state-${windowName}` });

  const defaultSize = {
    width: options.width || 1000,
    height: options.height || 600,
  };

  let win;

  // Safe restore (prevents crash + NaN positions)
  const restore = () => {
    const saved = store.get("window-state");

    if (!saved) return defaultSize;

    return {
      width: saved.width || defaultSize.width,
      height: saved.height || defaultSize.height,
      x: Number.isFinite(saved.x) ? saved.x : undefined,
      y: Number.isFinite(saved.y) ? saved.y : undefined,
    };
  };

  // Save window state
  const saveState = () => {
    if (!win || win.isDestroyed()) return;

    if (!win.isMinimized() && !win.isMaximized()) {
      const [x, y] = win.getPosition();
      const [width, height] = win.getSize();

      store.set("window-state", { x, y, width, height });
    }
  };

  const state = restore();

  win = new BrowserWindow({
    ...state,
    ...options,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // 🔥 IMPORTANT FIX
      ...options.webPreferences,
    },
  });

  // 🔥 FIX: force proper focus + repaint
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
    win.webContents.focus();
  });

  win.on("focus", () => {
    win.webContents.focus();
  });

  win.on("close", saveState);

  return win;
};

module.exports = { createWindow };
