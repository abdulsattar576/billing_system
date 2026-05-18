const { screen, BrowserWindow } = require("electron");
const Store = require("electron-store");

const createWindow = (windowName, options) => {
  const store = new Store({ name: `window-state-${windowName}` });

  const defaultSize = {
    width: options.width || 1000,
    height: options.height || 600,
  };

  let win; // ✅ declare first

  const getState = () => {
    const saved = store.get("window-state");

    if (!saved) {
      const bounds = screen.getPrimaryDisplay().bounds;
      return {
        x: Math.round((bounds.width - defaultSize.width) / 2),
        y: Math.round((bounds.height - defaultSize.height) / 2),
        ...defaultSize,
      };
    }

    return saved;
  };

  const state = getState();

  win = new BrowserWindow({
    ...state,
    ...options,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      ...options.webPreferences,
    },
  });

  const saveState = () => {
    if (!win.isMinimized() && !win.isMaximized()) {
      const [x, y] = win.getPosition();
      const [width, height] = win.getSize();

      store.set("window-state", { x, y, width, height });
    }
  };

  win.on("close", saveState);

  return win;
};

module.exports = { createWindow };
