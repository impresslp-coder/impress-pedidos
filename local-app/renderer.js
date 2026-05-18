import * as pdfjsLib from "./vendor/pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.mjs",
  import.meta.url,
).href;

const params = new URLSearchParams(window.location.search);
let job = params.get("job");
let base = params.get("base");
let queueKey = params.get("key");

const statusEl = document.getElementById("status");
const pagesEl = document.getElementById("pages");
const ticketsViewEl = document.getElementById("ticketsView");
const ticketsListEl = document.getElementById("ticketsList");
const colaViewEl = document.getElementById("colaView");
const colaContentEl = document.getElementById("colaContent");
const refreshTicketsButton = document.getElementById("refreshTicketsButton");
const ticketPrinterSelect = document.getElementById("ticketPrinterSelect");
const toggleTicketAutoButton = document.getElementById("toggleTicketAutoButton");
const ticketAutoStatus = document.getElementById("ticketAutoStatus");
const pdfTab = document.getElementById("pdfTab");
const ticketsTab = document.getElementById("ticketsTab");
const colaTab = document.getElementById("colaTab");
const historialTab = document.getElementById("historialTab");
const historialViewEl = document.getElementById("historialView");
const fileNameEl = document.getElementById("fileName");
const pageCountEl = document.getElementById("pageCount");
const configListEl = document.getElementById("configList");
const orderListEl = document.getElementById("orderList");
const messageEl = document.getElementById("message");
const printButton = document.getElementById("printButton");
const closeButton = document.getElementById("closeButton");
const pdfOptionsContainer = document.getElementById("pdfOptionsContainer");
const errorModal = document.getElementById("errorModal");
const errorModalTitle = document.getElementById("errorModalTitle");
const errorModalSummary = document.getElementById("errorModalSummary");
const errorModalDetails = document.getElementById("errorModalDetails");
const errorModalCopy = document.getElementById("errorModalCopy");
const errorModalClose = document.getElementById("errorModalClose");
const errorModalCloseIcon = document.getElementById("errorModalCloseIcon");
const operatorModal = document.getElementById("operatorModal");
const operatorForm = document.getElementById("operatorForm");
const operatorCodeInput = document.getElementById("operatorCodeInput");
const operatorModalError = document.getElementById("operatorModalError");
const operatorCancelButton = document.getElementById("operatorCancelButton");

const PRINTED_TICKETS_KEY = "impress.printedTickets.v1";
const FILE_HISTORY_KEY = "impress.fileHistory.v1";
const PRINT_HISTORY_KEY = "impress.printHistory.v1";
const TICKET_AUTO_KEY = "impress.ticketAutoPrint.v1";
const TICKET_PRINTER_KEY = "impress.ticketPrinter.v1";

let printJob;
let previewTicket = null;
let activeTab = "pdf";
let currentPrintedUrl = "";
let ticketsLoaded = false;
let latestTickets = [];
let colaExecuting = false;
let autoTicketBusy = false;
let availablePrinters = [];
let currentPdfOptions = null;
let currentPdfPageCount = 0;

// Cola de PDFs pendientes de autorizacion: { id, name, pdfUrl, options, printedUrl }
const pdfQueue = [];

// Preserva el estado de los checkboxes entre re-renders.
const checkOverrides = new Map();
const ticketPrintOptions = new Map();
const ticketQueue = new Set();
const queuedSelection = new Map();

// Cola: impresoras pausadas por nombre
const colaPausedPrinters = new Set();

function setStatus(text) {
  statusEl.textContent = text;
  statusEl.hidden = !text || activeTab === "tickets" || activeTab === "cola";
}

function setMessage(text, kind = "ok") {
  messageEl.hidden = false;
  messageEl.textContent = text;
  messageEl.dataset.kind = kind;
}

function errorToObject(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (typeof error === "object" && error !== null) return error;
  return { message: String(error) };
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function showErrorModal(title, error, context = {}) {
  const data = errorToObject(error);
  const log = {
    timestamp: new Date().toISOString(),
    title,
    error: data,
    context: {
      activeTab,
      currentFile: fileNameEl?.textContent || "",
      currentPages: pageCountEl?.textContent || "",
      pdfQueue: pdfQueue.map((job) => ({
        id: job.id,
        name: job.name,
        selected: job.selected !== false,
        options: job.options,
      })),
      ticketsInQueue: Array.from(ticketQueue),
      ...context,
    },
  };

  errorModalTitle.textContent = title;
  errorModalSummary.textContent = data.message || "Error sin mensaje";
  errorModalDetails.textContent = safeStringify(log);
  errorModal.hidden = false;
}

function closeErrorModal() {
  errorModal.hidden = true;
}

function reportError(title, error, context = {}) {
  setMessage(error?.message || String(error), "error");
  showErrorModal(title, error, context);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rows(target, values) {
  target.innerHTML = values
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "-")}</dd></div>`)
    .join("");
}

function boolText(value, yes, no) {
  return value ? yes : no;
}

function fmtDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR");
}

function fmtARS(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(value) || 0);
}

function printedTickets() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PRINTED_TICKETS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function markTicketPrinted(ticketKey) {
  const printed = printedTickets();
  printed.add(ticketKey);
  localStorage.setItem(PRINTED_TICKETS_KEY, JSON.stringify(Array.from(printed).slice(-500)));
}

// ── Historial ──

function getFileHistory() {
  try { return JSON.parse(localStorage.getItem(FILE_HISTORY_KEY) || "[]"); } catch { return []; }
}

function recordFileHistory(name, pageCount) {
  if (!name) return;
  const history = getFileHistory().filter((h) => h.name !== name);
  history.unshift({ name, pageCount: pageCount || 0, date: new Date().toISOString() });
  localStorage.setItem(FILE_HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
}

function getPrintHistory() {
  try { return JSON.parse(localStorage.getItem(PRINT_HISTORY_KEY) || "[]"); } catch { return []; }
}

function recordPrintHistory(name, printer, copies, kind) {
  if (!name) return;
  const history = getPrintHistory();
  history.unshift({ name, printer: printer || "Predeterminada", copies: copies || 1, kind: kind || "pdf", date: new Date().toISOString() });
  localStorage.setItem(PRINT_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
}

function fmtDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
}

function renderHistorial() {
  const fileHistory = getFileHistory();
  const printHistory = getPrintHistory();

  const fileHistoryList = document.getElementById("fileHistoryList");
  const printHistoryList = document.getElementById("printHistoryList");
  const fileHistoryCount = document.getElementById("fileHistoryCount");
  const printHistoryCount = document.getElementById("printHistoryCount");

  if (fileHistoryCount) fileHistoryCount.textContent = fileHistory.length;
  if (printHistoryCount) printHistoryCount.textContent = printHistory.length;

  if (fileHistoryList) {
    fileHistoryList.innerHTML = fileHistory.length
      ? fileHistory.map((entry) => `
        <div class="historial-item">
          <div class="historial-item-icon pdf-icon">PDF</div>
          <div class="historial-item-info">
            <strong class="historial-item-name">${escapeHtml(entry.name)}</strong>
            <span class="historial-item-meta">${escapeHtml(fmtDateTime(entry.date))}${entry.pageCount ? ` &middot; ${entry.pageCount} p&aacute;gs.` : ""}</span>
          </div>
        </div>`).join("")
      : `<p class="historial-empty">Sin archivos abiertos todav&iacute;a.</p>`;
  }

  if (printHistoryList) {
    printHistoryList.innerHTML = printHistory.length
      ? printHistory.map((entry) => `
        <div class="historial-item">
          <div class="historial-item-icon ${entry.kind === "ticket" ? "ticket-icon" : "print-icon"}">${entry.kind === "ticket" ? "TKT" : "IMP"}</div>
          <div class="historial-item-info">
            <strong class="historial-item-name">${escapeHtml(entry.name)}</strong>
            <span class="historial-item-meta">${escapeHtml(fmtDateTime(entry.date))} &middot; ${escapeHtml(entry.printer)} &middot; ${entry.copies} cop.</span>
          </div>
        </div>`).join("")
      : `<p class="historial-empty">Sin impresiones registradas todav&iacute;a.</p>`;
  }
}

async function loadPrinters() {
  availablePrinters = await window.impressPrint.getPrinters();
  renderTicketPrinterSettings();
}

function defaultPrinterName() {
  return availablePrinters.find((printer) => printer.isDefault)?.name || availablePrinters[0]?.name || "";
}

function selectedTicketPrinterName() {
  const saved = localStorage.getItem(TICKET_PRINTER_KEY);
  if (saved && availablePrinters.some((printer) => printer.name === saved)) return saved;
  return defaultPrinterName();
}

function ticketAutoEnabled() {
  return localStorage.getItem(TICKET_AUTO_KEY) === "true";
}

function renderTicketPrinterSettings() {
  if (!ticketPrinterSelect || !toggleTicketAutoButton) return;
  const selected = selectedTicketPrinterName();
  ticketPrinterSelect.innerHTML = printerOptionsHtml(selected);
  if (selected && ticketPrinterSelect.value !== selected) ticketPrinterSelect.value = selected;
  toggleTicketAutoButton.textContent = ticketAutoEnabled() ? "Auto tickets: ON" : "Auto tickets: OFF";
  toggleTicketAutoButton.classList.toggle("secondary", !ticketAutoEnabled());
  updateAutoStatusText();
}

function printerByName(name) {
  return availablePrinters.find((printer) => printer.name === name) || availablePrinters.find((printer) => printer.isDefault) || availablePrinters[0];
}

function paperKey(paper) {
  if (!paper?.name) return "";
  return `${paper.name}|${paper.widthMicrons || ""}|${paper.heightMicrons || ""}`;
}

function paperMatchesRequest(paper, requested) {
  const req = String(requested || "").toLowerCase();
  const name = String(paper?.name || "").toLowerCase();
  if (!req) return false;
  if (name === req || name.includes(req) || req.includes(name)) return true;
  if (req.includes("a4") && name.includes("a4")) return true;
  if (req.includes("a3") && name.includes("a3")) return true;
  if ((req.includes("80") || req.includes("ticket")) && (name.includes("80") || name.includes("ticket") || name.includes("receipt"))) return true;
  return false;
}

function paperFromPrinter(printerName, requestedPaper) {
  const printer = printerByName(printerName);
  const papers = printer?.papers || [];
  return papers.find((paper) => paperMatchesRequest(paper, requestedPaper)) || papers[0] || null;
}

function paperByKey(printerName, key) {
  const papers = printerByName(printerName)?.papers || [];
  return papers.find((paper) => paperKey(paper) === key) || null;
}

function applyPaperToOptions(options, paper) {
  if (!paper) {
    delete options.paperKey;
    delete options.paperName;
    delete options.paperWidthMicrons;
    delete options.paperHeightMicrons;
    delete options.paperSize;
    return options;
  }

  options.paperKey = paperKey(paper);
  options.paperName = paper.name;
  options.paperWidthMicrons = paper.widthMicrons;
  options.paperHeightMicrons = paper.heightMicrons;
  delete options.paperSize;
  return options;
}

function requestedOrientation(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("landscape") || normalized.includes("horizontal")) return "landscape";
  return "portrait";
}

function requestedDuplex(archivo) {
  if (!archivo?.doble_faz) return "simplex";
  return requestedOrientation(archivo.orientacion) === "landscape" ? "shortEdge" : "longEdge";
}

function defaultPdfOptions(archivo = {}) {
  const deviceName = defaultPrinterName();
  return applyPaperToOptions({
    deviceName,
    copies: Math.max(1, Number(archivo.copias) || 1),
    orientation: requestedOrientation(archivo.orientacion),
    color: Boolean(archivo.color),
    duplexMode: requestedDuplex(archivo),
    scaleFactor: 100,
    pageRangesText: archivo.rango_paginas || "Todas",
    batches: 1,
  }, paperFromPrinter(deviceName, archivo.tamano_papel));
}

function defaultTicketOptions() {
  const deviceName = selectedTicketPrinterName();
  return applyPaperToOptions({
    deviceName,
    copies: 1,
    orientation: "portrait",
    color: false,
    duplexMode: "simplex",
    scaleFactor: 100,
    pageRangesText: "Todas",
  }, paperFromPrinter(deviceName, "ticket 80"));
}

function getTicketOptions(ticketKey) {
  if (!ticketPrintOptions.has(ticketKey)) {
    ticketPrintOptions.set(ticketKey, defaultTicketOptions());
  }
  return ticketPrintOptions.get(ticketKey);
}

function parsePageRanges(value) {
  const text = String(value || "").trim();
  if (!text || text.toLowerCase() === "todas") return undefined;

  const ranges = text.split(",").map((part) => {
    const [fromRaw, toRaw] = part.split("-").map((n) => Number(n.trim()));
    if (!Number.isFinite(fromRaw) || fromRaw < 1) return null;
    const to = Number.isFinite(toRaw) && toRaw >= fromRaw ? toRaw : fromRaw;
    return { from: fromRaw - 1, to: to - 1 };
  });

  if (ranges.some((range) => !range)) return undefined;
  return ranges;
}

function pageNumbersFromText(value, totalPages) {
  const total = Math.max(0, Number(totalPages) || 0);
  if (!total) return [];
  const ranges = parsePageRanges(value);
  const pages = [];
  const sourceRanges = ranges?.length ? ranges : [{ from: 0, to: total - 1 }];
  for (const range of sourceRanges) {
    const from = Math.max(0, Math.min(total - 1, Number(range.from) || 0));
    const to = Math.max(from, Math.min(total - 1, Number(range.to) || from));
    for (let page = from + 1; page <= to + 1; page += 1) pages.push(page);
  }
  return Array.from(new Set(pages));
}

function pagesToRangeText(pages, totalPages) {
  const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
  if (!sorted.length) return "Todas";
  if (sorted.length === totalPages && sorted[0] === 1 && sorted[sorted.length - 1] === totalPages) return "Todas";

  const parts = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let index = 1; index <= sorted.length; index += 1) {
    const current = sorted[index];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}-${prev}`);
    start = current;
    prev = current;
  }
  return parts.join(",");
}

function printerOptionsHtml(selectedName) {
  if (!availablePrinters.length) return `<option value="">Predeterminada del sistema</option>`;
  return availablePrinters.map((printer) => {
    const selected = printer.name === selectedName ? "selected" : "";
    const label = printer.isDefault ? `${printer.displayName} (pred.)` : printer.displayName;
    return `<option value="${escapeHtml(printer.name)}" ${selected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function paperOptionsHtml(options) {
  const printer = printerByName(options.deviceName);
  const papers = printer?.papers || [];
  if (!papers.length) return `<option value="">Predeterminado del dispositivo</option>`;

  const selectedKey = options.paperKey || paperKey(papers[0]);
  return papers.map((paper) => {
    const key = paperKey(paper);
    const selected = key === selectedKey ? "selected" : "";
    return `<option value="${escapeHtml(key)}" ${selected}>${escapeHtml(paper.displayName || paper.name)}</option>`;
  }).join("");
}

function printControlsHtml(kind, id, options) {
  const data = `data-kind="${kind}" data-id="${escapeHtml(id)}"`;
  return `
    <div class="cola-print-options">
      <label>
        <span>Impresora</span>
        <select ${data} data-field="deviceName">${printerOptionsHtml(options.deviceName)}</select>
      </label>
      <label>
        <span>Copias</span>
        <input ${data} data-field="copies" type="number" min="1" value="${escapeHtml(options.copies || 1)}" />
      </label>
      <label>
        <span>Papel</span>
        <select ${data} data-field="paperKey">${paperOptionsHtml(options)}</select>
      </label>
      <label>
        <span>Orientacion</span>
        <select ${data} data-field="orientation">
          <option value="portrait" ${options.orientation !== "landscape" ? "selected" : ""}>Vertical</option>
          <option value="landscape" ${options.orientation === "landscape" ? "selected" : ""}>Horizontal</option>
        </select>
      </label>
      <label>
        <span>Color</span>
        <select ${data} data-field="color">
          <option value="false" ${options.color ? "" : "selected"}>B&N</option>
          <option value="true" ${options.color ? "selected" : ""}>Color</option>
        </select>
      </label>
      <label>
        <span>Faz</span>
        <select ${data} data-field="duplexMode">
          <option value="simplex" ${options.duplexMode === "simplex" ? "selected" : ""}>Simple</option>
          <option value="longEdge" ${options.duplexMode === "longEdge" ? "selected" : ""}>Doble largo</option>
          <option value="shortEdge" ${options.duplexMode === "shortEdge" ? "selected" : ""}>Doble corto</option>
        </select>
      </label>
      <label>
        <span>Paginas</span>
        <input ${data} data-field="pageRangesText" type="text" value="${escapeHtml(options.pageRangesText || "Todas")}" />
      </label>
      <label>
        <span>Escala</span>
        <select ${data} data-field="scaleFactor">
          <option value="100" ${Number(options.scaleFactor) === 100 ? "selected" : ""}>100%</option>
          <option value="95" ${Number(options.scaleFactor) === 95 ? "selected" : ""}>95%</option>
          <option value="90" ${Number(options.scaleFactor) === 90 ? "selected" : ""}>90%</option>
        </select>
      </label>
    </div>`;
}

function pdfPanelControlsHtml(options) {
  const data = `data-kind="current-pdf" data-id="current"`;
  return `
    <div class="pdf-print-options">
      <label>
        <span>Impresora</span>
        <select ${data} data-field="deviceName">${printerOptionsHtml(options.deviceName)}</select>
      </label>
      <label>
        <span>Copias</span>
        <input ${data} data-field="copies" type="number" min="1" value="${escapeHtml(options.copies || 1)}" />
      </label>
      <label>
        <span>Papel</span>
        <select ${data} data-field="paperKey">${paperOptionsHtml(options)}</select>
      </label>
      <label>
        <span>Orientacion</span>
        <select ${data} data-field="orientation">
          <option value="portrait" ${options.orientation !== "landscape" ? "selected" : ""}>Vertical</option>
          <option value="landscape" ${options.orientation === "landscape" ? "selected" : ""}>Horizontal</option>
        </select>
      </label>
      <label>
        <span>Color</span>
        <select ${data} data-field="color">
          <option value="false" ${options.color ? "" : "selected"}>B&N</option>
          <option value="true" ${options.color ? "selected" : ""}>Color</option>
        </select>
      </label>
      <label>
        <span>Faz</span>
        <select ${data} data-field="duplexMode">
          <option value="simplex" ${options.duplexMode === "simplex" ? "selected" : ""}>Simple</option>
          <option value="longEdge" ${options.duplexMode === "longEdge" ? "selected" : ""}>Doble largo</option>
          <option value="shortEdge" ${options.duplexMode === "shortEdge" ? "selected" : ""}>Doble corto</option>
        </select>
      </label>
      <label>
        <span>Paginas</span>
        <input ${data} data-field="pageRangesText" type="text" value="${escapeHtml(options.pageRangesText || "Todas")}" />
      </label>
      <label>
        <span>Escala</span>
        <select ${data} data-field="scaleFactor">
          <option value="100" ${Number(options.scaleFactor) === 100 ? "selected" : ""}>100%</option>
          <option value="95" ${Number(options.scaleFactor) === 95 ? "selected" : ""}>95%</option>
          <option value="90" ${Number(options.scaleFactor) === 90 ? "selected" : ""}>90%</option>
        </select>
      </label>
      <label class="wide-field">
        <span>Tandas</span>
        <input ${data} data-field="batches" type="number" min="1" value="${escapeHtml(options.batches || 1)}" />
      </label>
    </div>`;
}

function renderPdfPanelOptions() {
  if (!pdfOptionsContainer || !currentPdfOptions) return;
  pdfOptionsContainer.innerHTML = pdfPanelControlsHtml(currentPdfOptions);
  pdfOptionsContainer.querySelectorAll("select, input").forEach((input) => {
    input.addEventListener("change", () => {
      updateCurrentPdfOption(input.dataset.field, input.value);
    });
  });
}

function printOptionsForRun(options) {
  return {
    deviceName: options.deviceName,
    copies: Math.max(1, Number(options.copies) || 1),
    paperName: options.paperName,
    paperWidthMicrons: options.paperWidthMicrons,
    paperHeightMicrons: options.paperHeightMicrons,
    color: options.color === true || options.color === "true",
    orientation: options.orientation,
    duplexMode: options.duplexMode,
    scaleFactor: Number(options.scaleFactor) || 100,
    pageRanges: parsePageRanges(options.pageRangesText),
  };
}

function countPagesFromOptions(options, fallbackPages = 1) {
  const ranges = parsePageRanges(options.pageRangesText);
  if (!ranges?.length) return Math.max(1, Number(fallbackPages) || 1);
  return ranges.reduce((total, range) => total + Math.max(0, Number(range.to) - Number(range.from) + 1), 0);
}

function estimateSheets(pages, options) {
  const copies = Math.max(1, Number(options.copies) || 1);
  const pageCount = Math.max(1, Number(pages) || 1);
  const perCopy = options.duplexMode && options.duplexMode !== "simplex"
    ? Math.ceil(pageCount / 2)
    : pageCount;
  return perCopy * copies;
}

function printEventAuthPayload() {
  return {
    token: job || null,
    key: queueKey || null,
  };
}

async function recordPrintEvent(payload) {
  if (!base) return;
  const res = await fetch(`${base}/api/print-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...printEventAuthPayload(),
      ...payload,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `No pude registrar la estadistica de impresion (${res.status})`);
  }
}

async function safeRecordPrintEvent(label, payload) {
  try {
    await recordPrintEvent(payload);
  } catch (error) {
    showErrorModal(`No pude registrar estadistica de "${label}"`, error, { printEvent: payload });
    setMessage(`Se imprimio "${label}", pero no pude guardar la estadistica.`, "error");
  }
}

async function markPdfPrinted(job, payload) {
  if (!job.printedUrl) return;
  const res = await fetch(job.printedUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `No pude marcar impreso (${res.status})`);
  }
}

function requestOperatorCode() {
  if (!operatorModal || !operatorForm || !operatorCodeInput || !operatorCancelButton) return Promise.resolve("");
  operatorModal.hidden = false;
  operatorCodeInput.value = "";
  operatorModalError.hidden = true;
  setTimeout(() => operatorCodeInput.focus(), 0);

  return new Promise((resolve) => {
    const cleanup = () => {
      operatorForm.removeEventListener("submit", onSubmit);
      operatorCancelButton.removeEventListener("click", onCancel);
      operatorModal.hidden = true;
    };
    const onSubmit = (event) => {
      event.preventDefault();
      const code = operatorCodeInput.value.trim();
      if (!code) {
        operatorModalError.textContent = "Ingrese el codigo.";
        operatorModalError.hidden = false;
        return;
      }
      cleanup();
      resolve(code);
    };
    const onCancel = () => {
      cleanup();
      resolve("");
    };
    operatorForm.addEventListener("submit", onSubmit);
    operatorCancelButton.addEventListener("click", onCancel);
  });
}

async function verifyOperatorCode(code) {
  if (!base || !queueKey) throw new Error("No hay conexion configurada para validar el operador.");
  const res = await fetch(`${base}/api/print-operator`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: queueKey, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Codigo de usuario incorrecto");
  return data.operator;
}

function updateQueuedOption(kind, id, field, value) {
  const target = kind === "pdf"
    ? pdfQueue.find((job) => job.id === id)?.options
    : getTicketOptions(id);
  if (!target) return;

  if (field === "deviceName") {
    target.deviceName = value;
    applyPaperToOptions(target, paperFromPrinter(value, target.paperName));
    renderCola();
  } else if (field === "paperKey") {
    applyPaperToOptions(target, paperByKey(target.deviceName, value));
  } else if (field === "copies" || field === "scaleFactor") {
    target[field] = Number(value) || 1;
  } else if (field === "color") {
    target[field] = value === "true";
  } else {
    target[field] = value;
  }
}

function updateCurrentPdfOption(field, value) {
  if (!currentPdfOptions) return;

  if (field === "deviceName") {
    currentPdfOptions.deviceName = value;
    applyPaperToOptions(currentPdfOptions, paperFromPrinter(value, currentPdfOptions.paperName));
    renderPdfPanelOptions();
  } else if (field === "paperKey") {
    applyPaperToOptions(currentPdfOptions, paperByKey(currentPdfOptions.deviceName, value));
  } else if (field === "copies" || field === "scaleFactor" || field === "batches") {
    currentPdfOptions[field] = Math.max(1, Number(value) || 1);
  } else if (field === "color") {
    currentPdfOptions[field] = value === "true";
  } else {
    currentPdfOptions[field] = value;
  }
}

async function renderPdf(pdfUrl) {
  setStatus("Descargando PDF...");
  const res = await fetch(pdfUrl);
  if (!res.ok) {
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("json")
      ? (await res.json().catch(() => ({}))).error || res.statusText
      : await res.text().catch(() => res.statusText);
    throw new Error(`Error ${res.status}: ${body || "No pude descargar el PDF"}`);
  }

  const data = new Uint8Array(await res.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  currentPdfPageCount = pdf.numPages;

  pageCountEl.textContent = `${pdf.numPages} pagina(s) detectadas`;
  pagesEl.innerHTML = "";

  setStatus("Renderizando PDF...");
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = "pdf-page";
    pagesEl.appendChild(canvas);

    await page.render({ canvasContext: context, viewport }).promise;
  }

  setStatus("");
  return pdf.numPages;
}

function setTab(tab) {
  activeTab = tab;
  document.body.dataset.tab = tab;
  pdfTab.classList.toggle("active", tab === "pdf");
  ticketsTab.classList.toggle("active", tab === "tickets");
  colaTab.classList.toggle("active", tab === "cola");
  if (historialTab) historialTab.classList.toggle("active", tab === "historial");
  pagesEl.hidden = tab !== "pdf";
  ticketsViewEl.hidden = tab !== "tickets";
  colaViewEl.hidden = tab !== "cola";
  if (historialViewEl) historialViewEl.hidden = tab !== "historial";
  statusEl.hidden = tab !== "pdf" || !statusEl.textContent;

  if (tab === "cola") { renderCola(); return; }
  if (tab === "historial") { renderHistorial(); return; }

  if (tab === "tickets" && !ticketsLoaded) {
    loadTickets().catch((error) => reportError("Error cargando tickets", error));
  }
}

function currentPdfQueueKey() {
  return currentPrintedUrl || printJob?.pdfUrl || "";
}

function cloneOptions(options) {
  return JSON.parse(JSON.stringify(options || {}));
}

function batchRanges(totalPages, batches, pageRangesText = "Todas") {
  const count = Math.max(1, Number(batches) || 1);
  const pages = pageNumbersFromText(pageRangesText, totalPages);
  if (!pages.length) return [];
  if (count === 1) return [{ text: pagesToRangeText(pages, totalPages), pages }];

  const size = Math.ceil(pages.length / count);
  const ranges = [];
  for (let index = 0; index < count; index += 1) {
    const chunk = pages.slice(index * size, (index + 1) * size);
    if (chunk.length) ranges.push({ text: pagesToRangeText(chunk, totalPages), pages: chunk });
  }
  return ranges;
}

function enqueueCurrentPdfJob({ message = true } = {}) {
  if (!printJob?.pdfUrl) return false;

  const name = fileNameEl.textContent || "Documento";
  const baseOptions = cloneOptions(currentPdfOptions || defaultPdfOptions(printJob.archivo));
  const ranges = batchRanges(currentPdfPageCount, baseOptions.batches, baseOptions.pageRangesText);
  let added = 0;

  ranges.forEach((range, index) => {
    const options = cloneOptions(baseOptions);
    options.pageRangesText = range.text;
    const label = ranges.length > 1 ? `${name} - Tanda ${index + 1}/${ranges.length} (${range.text})` : name;
    const queueKey = `${currentPdfQueueKey()}::${options.pageRangesText || "Todas"}`;
    if (queueKey && pdfQueue.some((job) => job.queueKey === queueKey)) return;

    pdfQueue.push({
      id: `pdf-${Date.now()}-${pdfQueue.length}-${index}`,
      queueKey,
      name: label,
      pdfUrl: printJob.pdfUrl,
      options,
      printedUrl: currentPrintedUrl || "",
      pedidoId: printJob.pedido?.id || "",
      archivoId: printJob.archivo?.id || "",
      pagesEstimated: range.pages.length,
      selected: true,
    });
    added += 1;
  });

  if (message) {
    setMessage(added
      ? `${added} trabajo(s) PDF cargados en cola.`
      : "Ese PDF ya esta cargado en la cola.");
  }
  renderCola();
  return added > 0;
}

function getCheckedKeys() {
  const checked = new Set();
  ticketsListEl.querySelectorAll("input[type=checkbox][data-key]").forEach((cb) => {
    if (cb.checked) checked.add(cb.dataset.key);
  });
  return checked;
}

function defaultChecked(ticketKey, isPrinted) {
  // Si el usuario modifico el checkbox manualmente, respetar ese valor.
  if (checkOverrides.has(ticketKey)) return checkOverrides.get(ticketKey);
  // Default: pendientes tildados, ya impresos sin tilde.
  return !isPrinted;
}

function ticketRow(ticket, isPrinted) {
  const checked = defaultChecked(ticket.ticketKey, isPrinted) ? "checked" : "";
  const statusLabel = isPrinted ? "Impreso" : "Pendiente";
  return `
    <article class="ticket-row ${isPrinted ? "printed" : "pending"}">
      <label class="ticket-check">
        <input type="checkbox" data-key="${escapeHtml(ticket.ticketKey)}" ${checked} />
      </label>
      <div class="ticket-main">
        <strong>#${escapeHtml(ticket.numero)} - ${escapeHtml(ticket.tipoLabel)}</strong>
        <span>${escapeHtml(ticket.cliente)}</span>
        <small>${escapeHtml(fmtDate(ticket.fecha))} - ${escapeHtml(ticket.estado || "-")}</small>
      </div>
      <div class="ticket-money">
        <strong>${escapeHtml(fmtARS(ticket.total))}</strong>
        <small class="${isPrinted ? "tag-printed" : "tag-pending"}">${statusLabel}</small>
        <small>Resta ${escapeHtml(fmtARS(Math.max(0, Number(ticket.total) - Number(ticket.senia))))}</small>
      </div>
      <div class="ticket-actions">
        <button type="button" data-action="view" data-key="${escapeHtml(ticket.ticketKey)}">Ver</button>
        <button type="button" data-action="print" data-key="${escapeHtml(ticket.ticketKey)}">A cola</button>
      </div>
    </article>`;
}

function renderTickets(tickets) {
  if (!tickets.length) {
    ticketsListEl.innerHTML = `<p class="empty">No hay tickets para mostrar.</p>`;
    return;
  }

  const printed = printedTickets();

  // Agrupar: pendientes vs impresos
  const grupos = [
    { key: "pendientes", label: "Pendientes", items: tickets.filter(t => !printed.has(t.ticketKey)) },
    { key: "impresos",   label: "Ya impresos", items: tickets.filter(t =>  printed.has(t.ticketKey)) },
  ].filter(g => g.items.length);

  ticketsListEl.innerHTML = grupos.map(grupo => `
    <div class="ticket-group" data-group="${grupo.key}">
      <div class="ticket-group-header">
        <span class="ticket-group-title">${grupo.label}</span>
        <span class="ticket-group-badge">${grupo.items.length}</span>
        <span class="ticket-group-arrow">v</span>
      </div>
      <div class="ticket-group-items">
        ${grupo.items.map(t => ticketRow(t, printed.has(t.ticketKey))).join("")}
      </div>
    </div>
  `).join("");

  // Colapsar grupos al hacer clic en el header
  ticketsListEl.querySelectorAll(".ticket-group-header").forEach(header => {
    header.addEventListener("click", () => {
      header.closest(".ticket-group").classList.toggle("collapsed");
    });
  });

  // Checkboxes
  ticketsListEl.querySelectorAll("input[type=checkbox][data-key]").forEach((cb) => {
    cb.addEventListener("change", () => checkOverrides.set(cb.dataset.key, cb.checked));
  });

  // Botones
  ticketsListEl.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const ticket = latestTickets.find((item) => item.ticketKey === button.dataset.key);
      if (!ticket) return;
      if (button.dataset.action === "view") await openTicket(ticket);
      else if (button.dataset.action === "print") queueTicket(ticket);
    });
  });
}

function renderCola() {
  const printed = printedTickets();
  const ticketJobs = latestTickets.filter((ticket) => ticketQueue.has(ticket.ticketKey));
  const total = pdfQueue.length + ticketJobs.length;

  if (!total) {
    colaContentEl.innerHTML = `<p class="cola-empty">No hay trabajos en cola. Los tickets pendientes y los PDFs agregados desde el panel apareceran aqui.</p>`;
    return;
  }

  const pdfItemsHtml = pdfQueue.map(job => `
    <div class="cola-item cola-item-pdf ${job.selected === false ? "queue-muted" : ""}">
      <div class="cola-item-info">
        <div class="cola-item-title">
          <label class="cola-check">
            <input type="checkbox" class="cola-item-select" data-type="pdf" data-id="${escapeHtml(job.id)}" ${job.selected === false ? "" : "checked"} />
          </label>
          <strong><span class="queue-badge pdf-badge">PDF</span> ${escapeHtml(job.name)}</strong>
        </div>
        <div class="cola-item-prefs"><span>Configurar en IMPRESS Print</span></div>
        ${printControlsHtml("pdf", job.id, job.options)}
      </div>
      <button type="button" class="cola-item-remove" data-type="pdf" data-id="${escapeHtml(job.id)}">Quitar</button>
    </div>`).join("");

  const ticketItemsHtml = ticketJobs.map(ticket => `
    <div class="cola-item cola-item-ticket ${queuedSelection.get(ticket.ticketKey) === false ? "queue-muted" : ""}">
      <div class="cola-item-info">
        <div class="cola-item-title">
          <label class="cola-check">
            <input type="checkbox" class="cola-item-select" data-type="ticket" data-key="${escapeHtml(ticket.ticketKey)}" ${queuedSelection.get(ticket.ticketKey) === false ? "" : "checked"} />
          </label>
          <strong><span class="queue-badge ticket-badge">Ticket</span> #${escapeHtml(ticket.numero)} - ${escapeHtml(ticket.tipoLabel)}</strong>
        </div>
        <span>${escapeHtml(ticket.cliente)} - ${escapeHtml(ticket.estado || "")}</span>
        <div class="cola-item-prefs"><span>Configurar en IMPRESS Print</span></div>
        ${printControlsHtml("ticket", ticket.ticketKey, getTicketOptions(ticket.ticketKey))}
      </div>
      <button type="button" class="cola-item-remove" data-type="ticket" data-key="${escapeHtml(ticket.ticketKey)}">Quitar</button>
    </div>`).join("");

  colaContentEl.innerHTML = [
    pdfQueue.length ? queueGroupHtml("PDFs", "pdf", pdfQueue.length, pdfItemsHtml) : "",
    ticketJobs.length ? queueGroupHtml("Tickets", "ticket", ticketJobs.length, ticketItemsHtml) : "",
  ].join("");

  colaContentEl.querySelectorAll(".cola-group .collapse-toggle").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".cola-group").classList.toggle("collapsed"));
  });

  colaContentEl.querySelectorAll(".cola-play-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      renderCola();
      await executePrinterQueue(btn.dataset.kind);
    });
  });

  colaContentEl.querySelectorAll(".cola-item-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.type === "pdf") {
        const idx = pdfQueue.findIndex(j => j.id === btn.dataset.id);
        if (idx >= 0) pdfQueue.splice(idx, 1);
      } else {
        ticketQueue.delete(btn.dataset.key);
        queuedSelection.delete(btn.dataset.key);
      }
      renderCola();
    });
  });

  colaContentEl.querySelectorAll(".cola-item-select").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.dataset.type === "pdf") {
        const job = pdfQueue.find((item) => item.id === input.dataset.id);
        if (job) job.selected = input.checked;
      } else {
        queuedSelection.set(input.dataset.key, input.checked);
      }
      renderCola();
    });
  });

  colaContentEl.querySelectorAll(".cola-print-options select, .cola-print-options input").forEach((input) => {
    input.addEventListener("change", () => {
      updateQueuedOption(input.dataset.kind, input.dataset.id, input.dataset.field, input.value);
    });
  });
}

function queueGroupHtml(title, kind, count, itemsHtml) {
  return `
    <div class="cola-group" data-kind="${kind}">
      <div class="cola-group-header">
        <button type="button" class="collapse-toggle">
          <div class="cola-header-main">
            <span class="cola-printer-name">${escapeHtml(title)}</span>
            <span class="cola-count">${count} trabajo${count !== 1 ? "s" : ""}</span>
          </div>
          <span class="cola-arrow">v</span>
        </button>
        <button type="button" class="cola-play-btn playing" data-kind="${kind}">Ejecutar ${escapeHtml(title)}</button>
      </div>
      <div class="cola-group-body">${itemsHtml}</div>
    </div>`;
}

async function executePrinterQueue(kind = "all") {
  if (colaExecuting) return;
  const ticketJobs = latestTickets.filter((ticket) => (
    ticketQueue.has(ticket.ticketKey) && queuedSelection.get(ticket.ticketKey) !== false
  ));
  const jobs = [
    ...pdfQueue.filter((job) => job.selected !== false).map((job) => ({ kind: "pdf", ...job })),
    ...ticketJobs.map((ticket) => ({ kind: "ticket", ticket })),
  ].filter((job) => kind === "all" || job.kind === kind);

  if (!jobs.length) {
    ticketAutoStatus.textContent = "Cola vacia.";
    return;
  }

  const code = await requestOperatorCode();
  if (!code) {
    setMessage("Impresion cancelada: falta codigo de usuario.", "error");
    return;
  }

  try {
    const operator = await verifyOperatorCode(code);
    setMessage(`Cola autorizada por ${operator?.nombre || "operador"}.`);
  } catch (error) {
    reportError("Codigo de usuario incorrecto", error);
    return;
  }

  colaExecuting = true;
  try {
    let processed = 0;

    for (const job of jobs) {
      const label = job.kind === "pdf" ? job.name : `${job.ticket.tipoLabel} #${job.ticket.numero}`;
      ticketAutoStatus.textContent = `Confirmando "${label}" desde cola...`;
      try {
        if (job.kind === "pdf") {
          const runOpts = printOptionsForRun(job.options);
          const startedAt = new Date();
          await window.impressPrint.printPdfUrl(job.pdfUrl, runOpts);
          const completedAt = new Date();
          const pagesPrinted = countPagesFromOptions(job.options, job.pagesEstimated || currentPdfPageCount || 1);
          const printStats = {
            sourceType: "pdf",
            pedidoId: job.pedidoId,
            archivoId: job.archivoId,
            jobName: job.name,
            printerName: runOpts.deviceName,
            copies: runOpts.copies,
            pagesPrinted,
            sheetsEstimated: estimateSheets(pagesPrinted, runOpts),
            paperName: job.options.paperName,
            duplexMode: runOpts.duplexMode,
            color: runOpts.color,
            pageRangesText: job.options.pageRangesText || "Todas",
            startedAt: startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
            durationMs: completedAt.getTime() - startedAt.getTime(),
            metadata: {
              queueKind: "pdf",
              scaleFactor: runOpts.scaleFactor,
            },
          };
          await markPdfPrinted(job, printStats);
          recordPrintHistory(job.name, runOpts.deviceName, runOpts.copies, "pdf");
          const idx = pdfQueue.findIndex((item) => item.id === job.id);
          if (idx >= 0) pdfQueue.splice(idx, 1);
        } else {
          const ticketOpts = getTicketOptions(job.ticket.ticketKey);
          const runOpts = printOptionsForRun(ticketOpts);
          const startedAt = new Date();
          await window.impressPrint.printPdfUrl(job.ticket.pdfUrl, runOpts);
          const completedAt = new Date();
          await safeRecordPrintEvent(`${job.ticket.tipoLabel} #${job.ticket.numero}`, {
            sourceType: "ticket",
            ticketType: job.ticket.tipo === "entrega" ? "entrega" : "pedido",
            pedidoId: job.ticket.id,
            jobName: `${job.ticket.tipoLabel} #${job.ticket.numero}`,
            printerName: runOpts.deviceName,
            copies: runOpts.copies,
            pagesPrinted: 0,
            sheetsEstimated: 0,
            paperName: ticketOpts.paperName,
            duplexMode: runOpts.duplexMode,
            color: runOpts.color,
            pageRangesText: ticketOpts.pageRangesText || "Todas",
            startedAt: startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
            durationMs: completedAt.getTime() - startedAt.getTime(),
            metadata: {
              queueKind: "ticket",
              ticketKey: job.ticket.ticketKey,
              ticketTypeRaw: job.ticket.tipo,
              ticketPrints: runOpts.copies,
            },
          });
          recordPrintHistory(`${job.ticket.tipoLabel} #${job.ticket.numero}`, runOpts.deviceName, runOpts.copies, "ticket");
          markTicketPrinted(job.ticket.ticketKey);
          ticketQueue.delete(job.ticket.ticketKey);
          queuedSelection.delete(job.ticket.ticketKey);
        }
      } catch (err) {
        setMessage(`Error imprimiendo "${label}": ${err.message}`, "error");
        showErrorModal(`Error imprimiendo "${label}"`, err, {
          jobKind: job.kind,
          label,
          pdfUrl: job.kind === "pdf" ? job.pdfUrl : job.ticket.pdfUrl,
          options: job.kind === "pdf"
            ? printOptionsForRun(job.options)
            : printOptionsForRun(getTicketOptions(job.ticket.ticketKey)),
          ticket: job.kind === "ticket" ? job.ticket : null,
        });
        break;
      }
      processed += 1;
      renderTickets(latestTickets);
      renderCola();
    }

    ticketAutoStatus.textContent = processed
      ? `${processed} trabajo(s) procesados desde cola.`
      : "Cola vacia.";
    renderCola();
  } finally {
    colaExecuting = false;
  }
}

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Sin respuesta del servidor (${new URL(url).hostname}). Esta corriendo el servidor?`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTicketsFromServer() {
  // Modo standalone: usa /api/print-queue con la clave guardada.
  if (!job && base && queueKey) {
    const res = await fetchWithTimeout(`${base}/api/print-queue?key=${encodeURIComponent(queueKey)}`);
    if (res.status === 401) throw new Error("Clave incorrecta. Abri IMPRESS Print desde un pedido de la web para reconectar.");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error del servidor (${res.status})`);
    }
    return (await res.json()).tickets || [];
  }

  // Sin config guardada: pedir al usuario que conecte desde la web.
  if (!job && (!base || !queueKey)) {
    throw new Error("Primera vez: abri IMPRESS Print haciendo clic en 'Imprimir' desde un pedido de la web. Eso guardara la conexion para el futuro.");
  }

  // Modo job: usa el token de trabajo.
  const res = await fetchWithTimeout(`${base}/api/print-jobs/${encodeURIComponent(job)}/tickets`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No pude cargar los tickets");
  }
  return (await res.json()).tickets || [];
}

async function loadTickets() {
  if (!latestTickets.length) ticketsListEl.innerHTML = `<p class="empty">Cargando tickets...</p>`;

  let incoming;
  try {
    incoming = await fetchTicketsFromServer();
  } catch (err) {
    ticketsListEl.innerHTML = `<p class="empty error-msg">Atencion: ${escapeHtml(err.message)}</p>`;
    showErrorModal("Error cargando tickets", err, { base, job, queueKeyPresent: Boolean(queueKey) });
    return;
  }

  ticketsLoaded = true;

  // Fusionar: agregar solo tickets nuevos, preservar los existentes.
  const existingKeys = new Set(latestTickets.map((t) => t.ticketKey));
  const nuevos = incoming.filter((t) => !existingKeys.has(t.ticketKey));
  if (nuevos.length || !latestTickets.length) {
    latestTickets = [...nuevos, ...latestTickets.filter(t => incoming.some(i => i.ticketKey === t.ticketKey))];
    if (!latestTickets.length) latestTickets = incoming;
  }
  renderTickets(latestTickets);
  renderCola();
  await autoPrintTicketsIfEnabled(nuevos.length ? nuevos : latestTickets);
}

async function printTicketDirect(ticket) {
  const ticketOpts = cloneOptions(defaultTicketOptions());
  ticketPrintOptions.set(ticket.ticketKey, ticketOpts);
  const runOpts = printOptionsForRun(ticketOpts);
  const startedAt = new Date();
  await window.impressPrint.printPdfUrl(ticket.pdfUrl, runOpts);
  const completedAt = new Date();
  await safeRecordPrintEvent(`${ticket.tipoLabel} #${ticket.numero}`, {
    sourceType: "ticket",
    ticketType: ticket.tipo === "entrega" ? "entrega" : "pedido",
    pedidoId: ticket.id,
    jobName: `${ticket.tipoLabel} #${ticket.numero}`,
    printerName: runOpts.deviceName,
    copies: runOpts.copies,
    pagesPrinted: 0,
    sheetsEstimated: 0,
    paperName: ticketOpts.paperName,
    duplexMode: runOpts.duplexMode,
    color: runOpts.color,
    pageRangesText: "Ticket",
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    metadata: {
      queueKind: "ticket-auto",
      ticketKey: ticket.ticketKey,
      ticketTypeRaw: ticket.tipo,
      ticketPrints: runOpts.copies,
    },
  });
  recordPrintHistory(`${ticket.tipoLabel} #${ticket.numero}`, runOpts.deviceName, runOpts.copies, "ticket");
  markTicketPrinted(ticket.ticketKey);
}

async function autoPrintTicketsIfEnabled(candidates) {
  if (!ticketAutoEnabled() || autoTicketBusy) {
    updateAutoStatusText();
    return;
  }
  const printed = printedTickets();
  const pending = candidates.filter((ticket) => !printed.has(ticket.ticketKey));
  if (!pending.length) {
    updateAutoStatusText();
    return;
  }

  autoTicketBusy = true;
  try {
    for (const ticket of pending) {
      ticketAutoStatus.textContent = `Autoimprimiendo ${ticket.tipoLabel.toLowerCase()} #${ticket.numero}...`;
      await printTicketDirect(ticket);
    }
    setMessage(`${pending.length} ticket(s) autoimpresos.`);
  } catch (error) {
    reportError("Error autoimprimiendo tickets", error);
  } finally {
    autoTicketBusy = false;
    renderTickets(latestTickets);
    updateAutoStatusText();
  }
}

async function openTicket(ticket) {
  setTab("pdf");
  previewTicket = ticket;
  currentPdfOptions = null;
  if (pdfOptionsContainer) pdfOptionsContainer.innerHTML = `<p class="device-note">Este ticket se configura desde la cola.</p>`;
  currentPrintedUrl = "";
  fileNameEl.textContent = `${ticket.tipoLabel} ${ticket.numero}`;
  pageCountEl.textContent = "Ticket termico";
  rows(configListEl, [
    ["Tipo", ticket.tipoLabel],
    ["Impresion", "Desde cola"],
  ]);
  rows(orderListEl, [
    ["Numero", ticket.numero],
    ["Cliente", ticket.cliente],
    ["Telefono", ticket.telefono || "-"],
    ["Estado", ticket.estado || "-"],
  ]);
  await renderPdf(ticket.pdfUrl);
  printButton.disabled = false;
}

function queueTicket(ticket) {
  ticketQueue.add(ticket.ticketKey);
  queuedSelection.set(ticket.ticketKey, true);
  getTicketOptions(ticket.ticketKey);
  setMessage(`Ticket #${ticket.numero} agregado a la cola.`);
  renderTickets(latestTickets);
  setTab("cola");
}

async function printSelectedTickets() {
  const checkedKeys = getCheckedKeys();
  if (!checkedKeys.size) {
    setMessage("No hay tickets seleccionados", "error");
    return;
  }

  const toprint = latestTickets.filter((t) => checkedKeys.has(t.ticketKey));
  for (const ticket of toprint) {
    ticketQueue.add(ticket.ticketKey);
    queuedSelection.set(ticket.ticketKey, true);
    getTicketOptions(ticket.ticketKey);
  }
  setMessage(`${toprint.length} ticket(s) agregados a la cola.`);
  renderCola();
  setTab("cola");
}

function updateAutoStatusText() {
  ticketAutoStatus.dataset.paused = "false";
  ticketAutoStatus.textContent = ticketAutoEnabled()
    ? `Auto tickets activo en ${selectedTicketPrinterName() || "impresora predeterminada"}.`
    : "Los tickets se imprimen solo desde la cola.";
}

async function loadJob() {
  await loadPrinters();

  // Modo standalone: sin job pero con config guardada, ir directo a la cola.
  if (!job && base && queueKey) {
    setTab("cola");
    setStatus("");
    fileNameEl.textContent = "Cola del dia";
    pageCountEl.textContent = "Modo standalone";
    rows(configListEl, [["Modo", "Cola autonoma"], ["Servidor", base]]);
    rows(orderListEl, [["Estado", "Conectado"]]);
    await loadTickets();
    return;
  }

  if (!job || !base) {
    throw new Error("No hay conexion configurada. Abri IMPRESS Print desde un pedido para conectarlo al servidor.");
  }

  const res = await fetch(`${base}/api/print-jobs/${encodeURIComponent(job)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No pude abrir el trabajo de impresion");
  }

  printJob = await res.json();
  previewTicket = null;
  const { pedido, archivo } = printJob;
  currentPrintedUrl = printJob.printedUrl || "";
  currentPdfOptions = defaultPdfOptions(archivo);

  fileNameEl.textContent = archivo.nombre_archivo || "-";
  rows(configListEl, [
    ["Copias", archivo.copias ?? 1],
    ["Color", boolText(archivo.color, "Color", "Blanco y negro")],
    ["Faz", boolText(archivo.doble_faz, "Doble faz", "Simple faz")],
    ["Papel", archivo.tamano_papel || "A4"],
    ["Orientacion", archivo.orientacion || "-"],
    ["Paginas por hoja", archivo.paginas_por_hoja ?? 1],
    ["Rango", archivo.rango_paginas || "Todas"],
  ]);
  rows(orderListEl, [
    ["Numero", pedido.numero],
    ["Cliente", pedido.clientes?.nombre || "-"],
    ["Telefono", pedido.clientes?.telefono || "-"],
    ["Estado", archivo.estado || pedido.estado || "-"],
  ]);

  renderPdfPanelOptions();
  await renderPdf(printJob.pdfUrl);
  recordFileHistory(archivo.nombre_archivo || String(pedido.numero), currentPdfPageCount);
  printButton.disabled = false;
  await loadTickets();
  setMessage(`"${archivo.nombre_archivo || pedido.numero}" cargado. Configuralo y agregalo a cola.`);
  setTab("pdf");
}

// Recibe un nuevo job desde una segunda instancia del protocolo.
// Actualiza el panel PDF con el nuevo archivo y fusiona los tickets nuevos
// a la cola existente sin perder el estado del dia.
async function loadNewJob(newJob, newBase, newKey) {
  await loadPrinters();

  job = newJob;
  base = newBase;
  if (newKey) queueKey = newKey;

  setTab("pdf");
  setStatus("Cargando nuevo trabajo...");
  printButton.disabled = true;

  try {
    const res = await fetch(`${newBase}/api/print-jobs/${encodeURIComponent(newJob)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "No pude abrir el nuevo trabajo");
    }

    printJob = await res.json();
    previewTicket = null;
    const { pedido, archivo } = printJob;
    currentPrintedUrl = printJob.printedUrl || "";
    currentPdfOptions = defaultPdfOptions(archivo);

    fileNameEl.textContent = archivo.nombre_archivo || "-";
    rows(configListEl, [
      ["Copias", archivo.copias ?? 1],
      ["Color", boolText(archivo.color, "Color", "Blanco y negro")],
      ["Faz", boolText(archivo.doble_faz, "Doble faz", "Simple faz")],
      ["Papel", archivo.tamano_papel || "A4"],
      ["Orientacion", archivo.orientacion || "-"],
      ["Paginas por hoja", archivo.paginas_por_hoja ?? 1],
      ["Rango", archivo.rango_paginas || "Todas"],
    ]);
    rows(orderListEl, [
      ["Numero", pedido.numero],
      ["Cliente", pedido.clientes?.nombre || "-"],
      ["Telefono", pedido.clientes?.telefono || "-"],
      ["Estado", archivo.estado || pedido.estado || "-"],
    ]);

    renderPdfPanelOptions();
    await renderPdf(printJob.pdfUrl);
    recordFileHistory(printJob.archivo?.nombre_archivo || String(printJob.pedido?.numero || ""), currentPdfPageCount);
    printButton.disabled = false;

    // Cargar y fusionar tickets nuevos sin pisar los existentes.
    const ticketRes = await fetch(`${newBase}/api/print-jobs/${encodeURIComponent(newJob)}/tickets`);
    if (ticketRes.ok) {
      const ticketData = await ticketRes.json();
      const incoming = ticketData.tickets || [];
      const existingKeys = new Set(latestTickets.map((t) => t.ticketKey));
      const nuevos = incoming.filter((t) => !existingKeys.has(t.ticketKey));
      if (nuevos.length) {
        latestTickets = [...nuevos, ...latestTickets];
        renderTickets(latestTickets);
        renderCola();
        await autoPrintTicketsIfEnabled(nuevos);
      }
    }

    setMessage(`Nuevo trabajo cargado: ${archivo.nombre_archivo || pedido.numero}`);
    setTab("pdf");
  } catch (err) {
    setStatus("");
    reportError("Error cargando nuevo trabajo", err, { job: newJob, base: newBase });
  }
}

// Agrega el PDF actual a la cola de impresion (no imprime de inmediato).
function addToPdfQueue() {
  if (previewTicket) {
    queueTicket(previewTicket);
    return;
  }

  if (!printJob?.pdfUrl) {
    setMessage("No hay PDF cargado para agregar a la cola.", "error");
    return;
  }
  enqueueCurrentPdfJob();
  setTab("cola");
}

const printSelectedButton = document.getElementById("printSelectedButton");
const selectAllButton = document.getElementById("selectAllButton");
const selectNoneButton = document.getElementById("selectNoneButton");

printButton.addEventListener("click", addToPdfQueue);
pdfTab.addEventListener("click", () => setTab("pdf"));
ticketsTab.addEventListener("click", () => setTab("tickets"));
colaTab.addEventListener("click", () => setTab("cola"));
if (historialTab) historialTab.addEventListener("click", () => setTab("historial"));
ticketPrinterSelect?.addEventListener("change", () => {
  localStorage.setItem(TICKET_PRINTER_KEY, ticketPrinterSelect.value);
  ticketPrintOptions.clear();
  renderTicketPrinterSettings();
});
toggleTicketAutoButton?.addEventListener("click", () => {
  localStorage.setItem(TICKET_AUTO_KEY, ticketAutoEnabled() ? "false" : "true");
  renderTicketPrinterSettings();
  if (ticketAutoEnabled()) {
    autoPrintTicketsIfEnabled(latestTickets).catch((error) => reportError("Error autoimprimiendo tickets", error));
  }
});

document.getElementById("clearHistorialButton")?.addEventListener("click", () => {
  localStorage.removeItem(FILE_HISTORY_KEY);
  localStorage.removeItem(PRINT_HISTORY_KEY);
  renderHistorial();
});
refreshTicketsButton.addEventListener("click", () => {
  ticketsLoaded = false;
  loadTickets().catch((error) => reportError("Error actualizando tickets", error));
});
document.getElementById("colaRefreshButton").addEventListener("click", () => {
  ticketsLoaded = false;
  loadTickets().catch((error) => reportError("Error actualizando cola", error));
});

// Collapsible right-panel cards
document.querySelectorAll(".collapsible .collapse-toggle").forEach((btn) => {
  btn.addEventListener("click", () => btn.closest(".collapsible").classList.toggle("collapsed"));
});
closeButton.addEventListener("click", () => window.close());
printSelectedButton.addEventListener("click", () => {
  printSelectedTickets().catch((error) => reportError("Error agregando tickets a cola", error));
});
selectAllButton.addEventListener("click", () => {
  ticketsListEl.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.checked = true;
    checkOverrides.set(cb.dataset.key, true);
  });
});
selectNoneButton.addEventListener("click", () => {
  ticketsListEl.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.checked = false;
    checkOverrides.set(cb.dataset.key, false);
  });
});

errorModalClose.addEventListener("click", closeErrorModal);
errorModalCloseIcon.addEventListener("click", closeErrorModal);
errorModal.addEventListener("click", (event) => {
  if (event.target === errorModal) closeErrorModal();
});
errorModalCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(errorModalDetails.textContent || "");
    errorModalCopy.textContent = "Log copiado";
    setTimeout(() => {
      errorModalCopy.textContent = "Copiar log";
    }, 1400);
  } catch (error) {
    setMessage(`No pude copiar el log: ${error.message}`, "error");
  }
});
window.addEventListener("error", (event) => {
  showErrorModal("Error inesperado de interfaz", event.error || event.message, {
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
  });
});
window.addEventListener("unhandledrejection", (event) => {
  showErrorModal("Promesa rechazada sin capturar", event.reason);
});

// Escuchar jobs nuevos enviados desde otra instancia del protocolo.
window.impressPrint.onNewJob(({ job: newJob, base: newBase, key: newKey }) => {
  loadNewJob(newJob, newBase, newKey).catch((err) => reportError("Error recibiendo nuevo trabajo", err, { job: newJob, base: newBase }));
});

loadJob().catch((error) => {
  setStatus("");
  reportError("Error iniciando IMPRESS Print", error, { job, base });
});

setInterval(() => {
  if ((job && base) || (!job && base && queueKey)) {
    loadTickets().catch((error) => reportError("Error actualizando en segundo plano", error));
  }
}, 15000);
