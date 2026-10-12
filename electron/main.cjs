const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const isDev = process.env.ELECTRON_DEV === "1";

let mainWindow = null;
let phrasesPath = "";
let statsPath = "";
let watcher = null;
let suppressNotificationsUntil = 0;
let notifyTimer = null;

function statsPathFor(phrasesFile) {
  const directory = path.dirname(phrasesFile);
  const base = path.basename(phrasesFile, path.extname(phrasesFile));
  return path.join(directory, `${base}.stats.json`);
}

function configFile() {
  return path.join(app.getPath("userData"), "config.json");
}

function defaultPhrasesPath() {
  if (!app.isPackaged) {
    const repoFile = path.join(process.cwd(), "data", "phrases.json");
    if (fs.existsSync(repoFile)) return repoFile;
  }
  return path.join(app.getPath("userData"), "phrases.json");
}

function readConfiguredPath() {
  try {
    const parsed = JSON.parse(fs.readFileSync(configFile(), "utf8"));
    if (parsed && typeof parsed.phrasesPath === "string" && parsed.phrasesPath.trim()) {
      return parsed.phrasesPath;
    }
  } catch {
    return null;
  }
  return null;
}

function writeConfiguredPath(nextPath) {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), `${JSON.stringify({ phrasesPath: nextPath }, null, 2)}\n`, "utf8");
}

function atomicWrite(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, contents, "utf8");
  try {
    fs.renameSync(temporary, filePath);
  } catch {
    fs.copyFileSync(temporary, filePath);
    fs.unlinkSync(temporary);
  }
}

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function storageSnapshot() {
  return {
    phrasesPath,
    statsPath,
    phrasesJson: readTextIfExists(phrasesPath),
    statsJson: readTextIfExists(statsPath),
  };
}

function notifyChanged() {
  if (Date.now() < suppressNotificationsUntil) return;
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (Date.now() < suppressNotificationsUntil) return;
    mainWindow.webContents.send("storage:changed");
  }, 200);
}

function watchPhrasesFile() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  const directory = path.dirname(phrasesPath);
  fs.mkdirSync(directory, { recursive: true });
  const targetName = path.basename(phrasesPath).toLowerCase();
  try {
    watcher = fs.watch(directory, { persistent: true }, (_event, filename) => {
      if (filename && path.basename(String(filename)).toLowerCase() !== targetName) return;
      notifyChanged();
    });
  } catch {
    watcher = null;
  }
}

function setPhrasesPath(nextPath) {
  phrasesPath = nextPath;
  statsPath = statsPathFor(nextPath);
  watchPhrasesFile();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    title: "Swedish Practice",
    backgroundColor: "#efe6d6",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) mainWindow.loadURL(process.env.ELECTRON_START_URL || "http://127.0.0.1:5173");
  else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}

async function choosePhrasesFile() {
  const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
    title: "Choose phrases file",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, ...storageSnapshot() };
  }
  writeConfiguredPath(result.filePaths[0]);
  setPhrasesPath(result.filePaths[0]);
  return { canceled: false, ...storageSnapshot() };
}

function buildMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open phrases file…",
          click: () => {
            void choosePhrasesFile().then((result) => {
              if (!result.canceled) notifyChanged();
            });
          },
        },
        {
          label: "Show phrases file",
          click: () => shell.showItemInFolder(phrasesPath),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "viewMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  setPhrasesPath(readConfiguredPath() || defaultPhrasesPath());
  buildMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("storage:read", () => storageSnapshot());

ipcMain.handle("storage:write", (_event, payload) => {
  if (!payload || typeof payload.statsJson !== "string") {
    throw new Error("Stats payload is missing.");
  }
  suppressNotificationsUntil = Date.now() + 800;
  if (typeof payload.phrasesJson === "string") atomicWrite(phrasesPath, payload.phrasesJson);
  atomicWrite(statsPath, payload.statsJson);
  return storageSnapshot();
});

ipcMain.handle("storage:choose", () => choosePhrasesFile());

ipcMain.handle("storage:reveal", () => {
  shell.showItemInFolder(phrasesPath);
});
