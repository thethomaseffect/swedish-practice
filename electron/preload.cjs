const { contextBridge, ipcRenderer } = require("electron");

let changeListener = null;

contextBridge.exposeInMainWorld("swedishPractice", {
  read: () => ipcRenderer.invoke("storage:read"),
  write: (payload) => ipcRenderer.invoke("storage:write", payload),
  choose: () => ipcRenderer.invoke("storage:choose"),
  reveal: () => ipcRenderer.invoke("storage:reveal"),
  subscribe: (callback) => {
    if (changeListener) ipcRenderer.removeListener("storage:changed", changeListener);
    changeListener = () => callback();
    ipcRenderer.on("storage:changed", changeListener);
  },
  unsubscribe: () => {
    if (!changeListener) return;
    ipcRenderer.removeListener("storage:changed", changeListener);
    changeListener = null;
  },
});
