const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("impressPrint", {
  getPrinters: () => ipcRenderer.invoke("print:get-printers"),
  print: (options) => ipcRenderer.invoke("print:run", options),
  printPdfUrl: (pdfUrl, options) => ipcRenderer.invoke("print:pdf-url", { pdfUrl, options }),
  onNewJob: (callback) => ipcRenderer.on("new-job", (_event, data) => callback(data)),
  loadConfig: () => ipcRenderer.invoke("config:load"),
  saveConfig: (data) => ipcRenderer.invoke("config:save", data),
});
