const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"]);
const COVER_NAMES = ["cover", "folder", "album", "front"];
const COVER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function createWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1050,
    minHeight: 680,
    backgroundColor: "#08090c",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile("index.html");
}

function imageDataUrl(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mime = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function findCover(folderPath) {
  for (const name of COVER_NAMES) {
    for (const extension of COVER_EXTENSIONS) {
      const candidate = path.join(folderPath, `${name}${extension}`);
      if (fs.existsSync(candidate)) return imageDataUrl(candidate);
    }
  }
  return "";
}

function findAudioFiles(folderPath) {
  const tracks = [];
  const queue = [folderPath];

  while (queue.length) {
    const current = queue.shift();
    let entries = [];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    const cover = findCover(current);
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (!AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

      tracks.push({
        id: fullPath,
        name: path.basename(entry.name, path.extname(entry.name)),
        fileName: entry.name,
        path: fullPath,
        album: path.basename(current),
        artist: path.basename(path.dirname(current)) || "Local library",
        cover
      });
    }
  }

  return tracks.sort((a, b) => a.name.localeCompare(b.name));
}

function trackFromPath(filePath) {
  const folderPath = path.dirname(filePath);
  return {
    id: filePath,
    name: path.basename(filePath, path.extname(filePath)),
    fileName: path.basename(filePath),
    path: filePath,
    album: path.basename(folderPath),
    artist: path.basename(path.dirname(folderPath)) || "Local library",
    cover: findCover(folderPath)
  };
}

ipcMain.handle("library:choose-folder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) return [];
  return findAudioFiles(result.filePaths[0]);
});

ipcMain.handle("library:choose-files", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Audio files", extensions: Array.from(AUDIO_EXTENSIONS, (extension) => extension.slice(1)) }
    ]
  });
  if (result.canceled) return [];
  return result.filePaths.map(trackFromPath);
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
