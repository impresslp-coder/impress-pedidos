const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
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

  // Si llegÃ³ una clave, guardarla en config para el modo standalone.
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
  return await Promise.all(printers.map(async (printer) => ({
    name: printer.name,
    displayName: printer.displayName || printer.name,
    isDefault: printer.isDefault,
    status: printer.status,
    papers: await getPrinterPaperSizes(printer.name),
  })));
});

function getPrinterPaperSizes(printerName) {
  if (process.platform !== "win32" || !printerName) return Promise.resolve([]);

  const script = `
    Add-Type -AssemblyName System.Drawing
    $printerName = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(printerName, "utf8").toString("base64")}'))
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $printerName
    $doc.PrinterSettings.PaperSizes | ForEach-Object {
      [PSCustomObject]@{
        name = $_.PaperName
        displayName = $_.PaperName
        widthMicrons = [int][Math]::Round($_.Width * 254)
        heightMicrons = [int][Math]::Round($_.Height * 254)
      }
    } | ConvertTo-Json -Compress
  `;
  const encoded = Buffer.from(script, "utf16le").toString("base64");

  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-EncodedCommand", encoded], { windowsHide: true }, (_err, stdout) => {
      try {
        const data = JSON.parse(stdout.trim() || "[]");
        const list = Array.isArray(data) ? data : [data];
        resolve(list.filter((paper) => paper?.name && paper.widthMicrons && paper.heightMicrons));
      } catch {
        resolve([]);
      }
    });
  });
}

function buildPrintOptions(options = {}) {
  const pageSize = options.paperWidthMicrons && options.paperHeightMicrons
    ? { width: Number(options.paperWidthMicrons), height: Number(options.paperHeightMicrons) }
    : options.paperSize || undefined;

  const printOptions = {
    silent: true,
    printBackground: true,
    deviceName: options.deviceName || undefined,
    color: options.color !== false,
    landscape: options.orientation === "landscape",
    copies: Math.max(1, Number(options.copies) || 1),
    collate: true,
    duplexMode: options.duplexMode || "simplex",
    scaleFactor: Number(options.scaleFactor) || 100,
  };

  if (pageSize) printOptions.pageSize = pageSize;
  else printOptions.usePrinterDefaultPageSize = true;

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

// Carga el PDF en una ventana auxiliar y lo envia silenciosamente con las
// opciones aprobadas dentro de IMPRESS Print.
ipcMain.handle("print:pdf-url", async (_event, { pdfUrl, options = {} }) => {
  const { screen } = require("electron");
  const display = screen.getPrimaryDisplay();
  const offX = display.bounds.x + display.bounds.width + 100;
  const hasPageRanges = Array.isArray(options.pageRanges) && options.pageRanges.length > 0;
  const rendererLogs = [];

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
      backgroundThrottling: false,
      plugins: true,
    },
  });
  hidden.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    rendererLogs.push({ type: "console", level, message, line, sourceId });
  });
  hidden.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    rendererLogs.push({ type: "did-fail-load", errorCode, errorDescription, validatedURL });
  });
  hidden.webContents.on("render-process-gone", (_event, details) => {
    rendererLogs.push({ type: "render-process-gone", details });
  });
  hidden.webContents.on("unresponsive", () => {
    rendererLogs.push({ type: "unresponsive" });
  });

  try {
    if (hasPageRanges) {
      rendererLogs.push({ type: "load-renderer", pdfUrl, pageRanges: options.pageRanges });
      await hidden.loadFile(path.join(__dirname, "print-renderer.html"), {
        query: {
          pdfUrl,
          ranges: JSON.stringify(options.pageRanges),
        },
      });
      await waitForPrintRenderer(hidden, rendererLogs);
    } else {
      rendererLogs.push({ type: "load-pdf-viewer", pdfUrl });
      await hidden.loadURL(pdfUrl);
      // Esperar a que el visor de PDF de Chromium renderice el contenido.
      // did-finish-load dispara antes de que el PDF este listo, por eso se usa un delay.
      await new Promise((r) => setTimeout(r, 3000));
    }

    return await new Promise((resolve, reject) => {
      const printOptions = hasPageRanges ? { ...options, pageRanges: undefined } : options;
      rendererLogs.push({ type: "print", printOptions: buildPrintOptions(printOptions) });
      hidden.webContents.print(buildPrintOptions(printOptions), (success, failureReason) => {
        if (success) resolve({ ok: true });
        else reject(new Error(formatPrintError(failureReason || "La impresora rechazo el trabajo", rendererLogs)));
      });
    });
  } catch (error) {
    const message = error?.message || String(error);
    throw new Error(message.includes("Contexto tecnico:")
      ? message
      : formatPrintError(message, rendererLogs));
  } finally {
    if (!hidden.isDestroyed()) hidden.close();
  }
});

function formatPrintError(message, logs) {
  const safeLogs = Array.isArray(logs) ? logs.slice(-80) : [];
  return [
    message,
    "",
    "Contexto tecnico:",
    JSON.stringify(safeLogs, null, 2),
  ].join("\n");
}

async function waitForPrintRenderer(window, logs = []) {
  let lastState = null;
  let renderedLogCount = 0;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const state = await window.webContents.executeJavaScript(`({
      ready: Boolean(window.__IMPRESS_PRINT_READY__),
      error: window.__IMPRESS_PRINT_ERROR__ || "",
      logs: window.__IMPRESS_PRINT_LOGS__ || [],
      href: window.location.href,
      readyState: document.readyState,
      canvasCount: document.querySelectorAll("canvas").length,
      renderedCount: document.querySelectorAll("canvas[data-rendered='true']").length,
      bodyText: document.body ? document.body.innerText.slice(0, 500) : ""
    })`);
    lastState = state;
    if (state.logs?.length > renderedLogCount) {
      logs.push(...state.logs.slice(renderedLogCount).map((entry) => ({ type: "renderer-log", ...entry })));
      renderedLogCount = state.logs.length;
    }
    if (state.error) throw new Error(formatPrintError(state.error, logs));
    if (state.ready) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  logs.push({ type: "timeout-state", state: lastState });
  throw new Error(formatPrintError("No se pudo preparar la tanda para imprimir", logs));
}
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
      // Si por alguna razÃ³n no hay ventana, crear una nueva.
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
