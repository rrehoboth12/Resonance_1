const { contextBridge, ipcRenderer } = require("electron");
const { pathToFileURL } = require("url");

contextBridge.exposeInMainWorld("resonanceDesktop", {
  chooseFolder: () => ipcRenderer.invoke("library:choose-folder"),
  chooseFiles: () => ipcRenderer.invoke("library:choose-files"),
  toFileUrl: (filePath) => pathToFileURL(filePath).href
});
