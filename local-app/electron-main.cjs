const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain } = require("electron");

const userDataPath = path.join(process.env.LOCALAPPDATA || app.getPath("appData"), "IMPRESS Print");
fs.mkdirSync(userDataPath, { recursive: true });
app.setPath("userData", userDataPath);

const configPath = path.join(userDataPath, "config.json");

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, "utf8")); }
  catch { return {}; }
}

function saveConfig(data) {
  const existing = loadConfig();
  fs.writeFileSync(configPath, JSON.stringify({ ...existing, ...data }, null, 2));
}

ipcMain.handle("config:load", () => loadConfig());
ipcMain.handle("config:save", (_event, data) => { saveConfig(data); return true; });

let mainWindow;

function findProtocolUrl(argv) {
  return argv.find((arg) => typeof arg === "string" && arg.startsWith("impress-print://")) || "";
}

function parseProtocolUrl(protocolUrl) {
  if (!protocolUrl) return {};

  try {
    const parsed = new URL(protocolUrl);
    return {
      job:  parsed.searchParams.get("job")  || "",
      base: parsed.searchParams.get("base") || "",
      key:  parsed.searchParams.get("key")  || "",
    };
  } catch {
    return {};
  }
}

function createWindow(protocolUrl) {
  const parsed = parseProtocolUrl(protocolUrl);

  // Si llegó una clave, guardarla en config para el modo standalone.
  if (parsed.base && parsed.key) {
    saveConfig({ base: parsed.base, key: parsed.key });
  }

  // Si no hay job+base en el protocol URL, arrancar en modo standalone
  // y leer la config guardada.
  const config = loadConfig();
  const query = {
    job:  parsed.job  || "",
    base: parsed.base || config.base || "",
    key:  parsed.key  || config.key  || "",
  };

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: "IMPRESS Print",
    backgroundColor: "#111124",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer.html"), { query });
}

ipcMain.handle("print:get-printers", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return [];
  const printers = await mainWindow.webContents.getPrintersAsync();
  return printers.map((printer) => ({
    name: printer.name,
    displayName: printer.displayName || printer.name,
    isDefault: printer.isDefault,
    status: printer.status,
  }));
});

function buildPrintOptions(options) {
  const pageSize = options.paperSize === "ticket80"
    ? { width: 80000, height: 297000 }
    : options.paperSize || "A4";

  const printOptions = {
    silent: true,
    printBackground: true,
    deviceName: options.deviceName || undefined,
    color: options.color !== false,
    landscape: options.orientation === "landscape",
    copies: Math.max(1, Number(options.copies) || 1),
    collate: true,
    duplexMode: options.duplexMode || "simplex",
    pageSize,
    scaleFactor: Number(options.scaleFactor) || 100,
  };

  if (Array.isArray(options.pageRanges) && options.pageRanges.length) {
    printOptions.pageRanges = options.pageRanges;
  }

  return printOptions;
}

ipcMain.handle("print:run", async (_event, options = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("La ventana de impresion no esta disponible");
  }

  return await new Promise((resolve, reject) => {
    mainWindow.webContents.print(buildPrintOptions(options), (success, failureReason) => {
      if (success) resolve({ ok: true });
      else reject(new Error(failureReason || "La impresora rechazo el trabajo"));
    });
  });
});

// Imprime un PDF directamente desde su URL.
// Se carga en una ventana fuera de pantalla (visible pero desplazada):
// el visor de PDF de Chromium requiere que la ventana sea visible para inicializarse.
ipcMain.handle("print:pdf-url", async (_event, { pdfUrl, options = {} }) => {
  const { screen } = require("electron");
  const display = screen.getPrimaryDisplay();
  const offX = display.bounds.x + display.bounds.width + 100; // justo fuera del borde derecho

  const hidden = new BrowserWindow({
    show: true,
    x: offX,
    y: display.bounds.y,
    width: 600,
    height: 800,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      plugins: true,
    },
  });

  try {
    await hidden.loadURL(pdfUrl);
    // Esperar a que el visor de PDF de Chromium renderice el contenido.
    // did-finish-load dispara antes de que el PDF esté listo, por eso se usa un delay.
    await new Promise((r) => setTimeout(r, 3000));

    return await new Promise((resolve, reject) => {
      hidden.webContents.print(buildPrintOptions(options), (success, failureReason) => {
        if (success) resolve({ ok: true });
        else reject(new Error(failureReason || "La impresora rechazo el trabajo"));
      });
    });
  } finally {
    if (!hidden.isDestroyed()) hidden.close();
  }
});

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const protocolUrl = findProtocolUrl(argv);
    if (!protocolUrl) return;

    if (mainWindow && !mainWindow.isDestroyed()) {
      // Traer al frente la ventana existente y enviarle el nuevo job.
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const { job, base, key } = parseProtocolUrl(protocolUrl);
      if (base && key) saveConfig({ base, key });
      if (job && base) {
        mainWindow.webContents.send("new-job", { job, base, key });
      }
    } else {
      // Si por alguna razón no hay ventana, crear una nueva.
      createWindow(protocolUrl);
    }
  });

  app.whenReady().then(() => {
    createWindow(findProtocolUrl(process.argv));
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
