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
const ticketAutoStatus = document.getElementById("ticketAutoStatus");
const pdfTab = document.getElementById("pdfTab");
const ticketsTab = document.getElementById("ticketsTab");
const colaTab = document.getElementById("colaTab");
const fileNameEl = document.getElementById("fileName");
const pageCountEl = document.getElementById("pageCount");
const configListEl = document.getElementById("configList");
const orderListEl = document.getElementById("orderList");
const messageEl = document.getElementById("message");
const printButton = document.getElementById("printButton");
const systemPrintButton = document.getElementById("systemPrintButton");
const closeButton = document.getElementById("closeButton");
const printerSelect = document.getElementById("printerSelect");
const copiesInput = document.getElementById("copiesInput");
const paperSelect = document.getElementById("paperSelect");
const orientationSelect = document.getElementById("orientationSelect");
const duplexSelect = document.getElementById("duplexSelect");
const rangeInput = document.getElementById("rangeInput");
const scaleSelect = document.getElementById("scaleSelect");
const bwButton = document.getElementById("bwButton");
const colorButton = document.getElementById("colorButton");

const PRINTED_TICKETS_KEY = "impress.printedTickets.v1";
const TICKET_PRINTER_KEY = "impress.ticketPrinter.v1";

let printJob;
let selectedColor = false;
let activeTab = "pdf";
let currentPrintedUrl = "";
let ticketsLoaded = false;
let autoPrintBusy = false;
let autoPrintEnabled = true;
let latestTickets = [];
let colaExecuting = false;

// Cola de PDFs pendientes de autorización: { id, name, pdfUrl, options, printedUrl }
const pdfQueue = [];

// Preserva el estado de los checkboxes entre re-renders.
const checkOverrides = new Map();

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

function setColor(value) {
  selectedColor = value === true;
  bwButton.classList.toggle("active", !selectedColor);
  colorButton.classList.toggle("active", selectedColor);
}

function requestedOrientation(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("landscape") || normalized.includes("horizontal")) return "landscape";
  return "portrait";
}

function requestedDuplex(archivo) {
  if (!archivo.doble_faz) return "simplex";
  const orientation = requestedOrientation(archivo.orientacion);
  return orientation === "landscape" ? "shortEdge" : "longEdge";
}

function normalizePaper(value) {
  const normalized = String(value || "A4").toUpperCase();
  if (["A3", "A4", "LETTER", "LEGAL"].includes(normalized)) {
    return normalized === "LETTER" ? "Letter" : normalized === "LEGAL" ? "Legal" : normalized;
  }
  return "A4";
}

function applyTicketProfile() {
  copiesInput.value = "1";
  paperSelect.value = "ticket80";
  orientationSelect.value = "portrait";
  duplexSelect.value = "simplex";
  rangeInput.value = "Todas";
  scaleSelect.value = "100";
  setColor(false);
}

function parsePageRanges(value) {
  const text = String(value || "").trim();
  if (!text || text.toLowerCase() === "todas") return undefined;

  const ranges = text.split(",").map((part) => {
    const [fromRaw, toRaw] = part.split("-").map((n) => Number(n.trim()));
    if (!Number.isFinite(fromRaw) || fromRaw < 1) return null;
    const to = Number.isFinite(toRaw) && toRaw >= fromRaw ? toRaw : fromRaw;
    return { from: fromRaw, to };
  });

  if (ranges.some((range) => !range)) return undefined;
  return ranges;
}

function currentPrintOptions() {
  return {
    deviceName: printerSelect.value,
    copies: Number(copiesInput.value) || 1,
    paperSize: paperSelect.value,
    orientation: orientationSelect.value,
    color: selectedColor,
    duplexMode: duplexSelect.value,
    pageRanges: parsePageRanges(rangeInput.value),
    scaleFactor: Number(scaleSelect.value) || 100,
  };
}

function currentTicketPrintOptions() {
  return {
    deviceName: ticketPrinterSelect.value || printerSelect.value,
    copies: 1,
    paperSize: "ticket80",
    orientation: "portrait",
    color: false,
    duplexMode: "simplex",
    scaleFactor: 100,
  };
}

function fillPrinterSelect(select, printers, savedName) {
  select.innerHTML = "";
  if (!printers.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No hay impresoras instaladas";
    select.appendChild(option);
    return;
  }

  for (const printer of printers) {
    const option = document.createElement("option");
    option.value = printer.name;
    option.textContent = printer.isDefault
      ? `${printer.displayName} (predeterminada)`
      : printer.displayName;
    select.appendChild(option);
  }

  const defaultPrinter = printers.find((printer) => printer.isDefault);
  select.value = savedName && printers.some((printer) => printer.name === savedName)
    ? savedName
    : defaultPrinter?.name || printers[0].name;
}

async function loadPrinters() {
  const printers = await window.impressPrint.getPrinters();
  fillPrinterSelect(printerSelect, printers, "");
  fillPrinterSelect(ticketPrinterSelect, printers, localStorage.getItem(TICKET_PRINTER_KEY) || "");
}

function applyRequestedProfile(archivo) {
  copiesInput.value = String(Math.max(1, Number(archivo.copias) || 1));
  paperSelect.value = normalizePaper(archivo.tamano_papel);
  orientationSelect.value = requestedOrientation(archivo.orientacion);
  duplexSelect.value = requestedDuplex(archivo);
  rangeInput.value = archivo.rango_paginas || "Todas";
  scaleSelect.value = "100";
  setColor(Boolean(archivo.color));
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
}

function setTab(tab) {
  activeTab = tab;
  pdfTab.classList.toggle("active", tab === "pdf");
  ticketsTab.classList.toggle("active", tab === "tickets");
  colaTab.classList.toggle("active", tab === "cola");
  pagesEl.hidden = tab !== "pdf";
  ticketsViewEl.hidden = tab !== "tickets";
  colaViewEl.hidden = tab !== "cola";
  statusEl.hidden = tab !== "pdf" || !statusEl.textContent;

  if (tab === "cola") { renderCola(); return; }

  if (tab === "tickets" && !ticketsLoaded) {
    loadTickets().catch((error) => setMessage(error.message, "error"));
  }
}

function getCheckedKeys() {
  const checked = new Set();
  ticketsListEl.querySelectorAll("input[type=checkbox][data-key]").forEach((cb) => {
    if (cb.checked) checked.add(cb.dataset.key);
  });
  return checked;
}

function defaultChecked(ticketKey, isPrinted) {
  // Si el usuario modificó el checkbox manualmente, respetar ese valor.
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
        <small>${escapeHtml(fmtDate(ticket.fecha))} · ${escapeHtml(ticket.estado || "-")}</small>
      </div>
      <div class="ticket-money">
        <strong>${escapeHtml(fmtARS(ticket.total))}</strong>
        <small class="${isPrinted ? "tag-printed" : "tag-pending"}">${statusLabel}</small>
        <small>Resta ${escapeHtml(fmtARS(Math.max(0, Number(ticket.total) - Number(ticket.senia))))}</small>
      </div>
      <div class="ticket-actions">
        <button type="button" data-action="view" data-key="${escapeHtml(ticket.ticketKey)}">Ver</button>
        <button type="button" data-action="print" data-key="${escapeHtml(ticket.ticketKey)}">Reimprimir</button>
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
        <span class="ticket-group-arrow">▾</span>
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
      else if (button.dataset.action === "print") await printTicket(ticket, { markPrinted: true });
    });
  });
}

function renderCola() {
  const printed = printedTickets();
  const ticketPrinter = ticketPrinterSelect.value || "Impresora de tickets";
  const opts = currentTicketPrintOptions();

  // Agrupar trabajos por impresora: { pdfJobs: [], ticketJobs: [] }
  const groups = new Map();

  // Tickets pendientes → impresora de tickets
  latestTickets
    .filter(t => {
      const isPrinted = printed.has(t.ticketKey);
      return defaultChecked(t.ticketKey, isPrinted) && !isPrinted;
    })
    .forEach(t => {
      if (!groups.has(ticketPrinter)) groups.set(ticketPrinter, { pdfJobs: [], ticketJobs: [] });
      groups.get(ticketPrinter).ticketJobs.push(t);
    });

  // PDFs en cola → su impresora configurada (siempre usa deviceName, nunca el ticketPrinter)
  pdfQueue.forEach(job => {
    const printer = job.options.deviceName || "(sin impresora)";
    if (!groups.has(printer)) groups.set(printer, { pdfJobs: [], ticketJobs: [] });
    groups.get(printer).pdfJobs.push(job);
  });

  if (!groups.size) {
    colaContentEl.innerHTML = `<p class="cola-empty">No hay trabajos en cola. Los tickets pendientes y los PDFs agregados desde el panel aparecerán aquí.</p>`;
    return;
  }

  colaContentEl.innerHTML = [...groups.entries()].map(([printerName, group]) => {
    const isPaused = colaPausedPrinters.has(printerName);
    const total = group.pdfJobs.length + group.ticketJobs.length;

    const pdfItemsHtml = group.pdfJobs.map(job => `
      <div class="cola-item cola-item-pdf">
        <div class="cola-item-info">
          <strong>📄 ${escapeHtml(job.name)}</strong>
          <div class="cola-item-prefs">
            <span>${escapeHtml(job.options.paperSize || "A4")}</span>
            <span>${job.options.color ? "🎨 Color" : "⬛ B&N"}</span>
            <span>${job.options.duplexMode === "simplex" ? "📋 Simple faz" : "📑 Doble faz"}</span>
            <span>× ${job.options.copies || 1} copia${(job.options.copies || 1) !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <button type="button" class="cola-item-remove" data-type="pdf" data-id="${escapeHtml(job.id)}">✕ Quitar</button>
      </div>`).join("");

    const ticketItemsHtml = group.ticketJobs.map(t => `
      <div class="cola-item">
        <div class="cola-item-info">
          <strong>#${escapeHtml(t.numero)} · ${escapeHtml(t.tipoLabel)}</strong>
          <span>${escapeHtml(t.cliente)} · ${escapeHtml(t.estado || "")}</span>
          <div class="cola-item-prefs">
            <span>📄 Ticket 80mm</span>
            <span>⬛ B&amp;N</span>
            <span>📋 Simple faz</span>
            <span>× ${opts.copies} copia${opts.copies !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <button type="button" class="cola-item-remove" data-type="ticket" data-key="${escapeHtml(t.ticketKey)}">✕ Quitar</button>
      </div>`).join("");

    return `
      <div class="cola-group" data-printer="${escapeHtml(printerName)}">
        <div class="cola-group-header">
          <button type="button" class="collapse-toggle">
            <div class="cola-header-main">
              <span class="cola-printer-name">🖨 ${escapeHtml(printerName || "Sin impresora")}</span>
              <span class="cola-count">${total} trabajo${total !== 1 ? "s" : ""}</span>
            </div>
            <span class="cola-arrow">▾</span>
          </button>
          <button type="button" class="cola-play-btn ${isPaused ? "" : "playing"}" data-printer="${escapeHtml(printerName)}">
            ${isPaused ? "▶ Reanudar" : "▶ Ejecutar"}
          </button>
        </div>
        <div class="cola-group-body">
          ${pdfItemsHtml}${ticketItemsHtml}
        </div>
      </div>`;
  }).join("");

  // Colapsar grupos
  colaContentEl.querySelectorAll(".cola-group .collapse-toggle").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".cola-group").classList.toggle("collapsed"));
  });

  // ▶ Ejecutar / ▶ Reanudar
  colaContentEl.querySelectorAll(".cola-play-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const printer = btn.dataset.printer;
      if (colaPausedPrinters.has(printer)) {
        colaPausedPrinters.delete(printer);
        updateAutoStatusText();
      }
      renderCola();
      await executePrinterQueue(printer);
    });
  });

  // Quitar ítems
  colaContentEl.querySelectorAll(".cola-item-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.type === "pdf") {
        const idx = pdfQueue.findIndex(j => j.id === btn.dataset.id);
        if (idx >= 0) pdfQueue.splice(idx, 1);
      } else {
        checkOverrides.set(btn.dataset.key, false);
        renderTickets(latestTickets);
      }
      renderCola();
    });
  });
}

// Ejecuta SOLO los PDFs en cola para una impresora dada.
// Los tickets tienen su propio flujo (auto-print por pestaña Tickets).
async function executePrinterQueue(printerName) {
  if (colaExecuting) return;
  colaExecuting = true;
  try {
    const jobs = pdfQueue.filter(j => (j.options.deviceName || "(sin impresora)") === printerName);
    for (const job of [...jobs]) {
      ticketAutoStatus.textContent = `Imprimiendo "${job.name}"...`;
      try {
        await window.impressPrint.printPdfUrl(job.pdfUrl, job.options);
        if (job.printedUrl) await fetch(job.printedUrl, { method: "POST" }).catch(() => {});
        const idx = pdfQueue.findIndex(j => j.id === job.id);
        if (idx >= 0) pdfQueue.splice(idx, 1);
      } catch (err) {
        setMessage(`Error imprimiendo "${job.name}": ${err.message}`, "error");
        break;
      }
      renderCola();
    }
    ticketAutoStatus.textContent = jobs.length
      ? `${jobs.length} trabajo(s) enviados a impresión.`
      : "Cola vacía para esta impresora.";
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
    if (err.name === "AbortError") throw new Error(`Sin respuesta del servidor (${new URL(url).hostname}). ¿Está corriendo el servidor?`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTicketsFromServer() {
  // Modo standalone: usa /api/print-queue con la clave guardada.
  if (!job && base && queueKey) {
    const res = await fetchWithTimeout(`${base}/api/print-queue?key=${encodeURIComponent(queueKey)}`);
    if (res.status === 401) throw new Error("Clave incorrecta. Abrí IMPRESS Print desde un pedido de la web para reconectar.");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error del servidor (${res.status})`);
    }
    return (await res.json()).tickets || [];
  }

  // Sin config guardada: pedir al usuario que conecte desde la web.
  if (!job && (!base || !queueKey)) {
    throw new Error("Primera vez: abrí IMPRESS Print haciendo clic en 'Imprimir' desde un pedido de la web. Eso guardará la conexión para el futuro.");
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
    ticketsListEl.innerHTML = `<p class="empty error-msg">⚠ ${escapeHtml(err.message)}</p>`;
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
  await autoPrintNewTickets(latestTickets);
}

async function openTicket(ticket) {
  setTab("pdf");
  currentPrintedUrl = "";
  fileNameEl.textContent = `${ticket.tipoLabel} ${ticket.numero}`;
  pageCountEl.textContent = "Ticket termico";
  applyTicketProfile();
  rows(configListEl, [
    ["Tipo", ticket.tipoLabel],
    ["Copias", "1"],
    ["Color", "Blanco y negro"],
    ["Papel", "Ticket 80mm"],
    ["Faz", "Simple faz"],
  ]);
  rows(orderListEl, [
    ["Numero", ticket.numero],
    ["Cliente", ticket.cliente],
    ["Telefono", ticket.telefono || "-"],
    ["Estado", ticket.estado || "-"],
  ]);
  await renderPdf(ticket.pdfUrl);
  printButton.disabled = false;
  systemPrintButton.disabled = false;
}

async function printTicket(ticket, { markPrinted = true } = {}) {
  // Imprime en segundo plano — no toca el panel PDF ni cambia de tab.
  ticketAutoStatus.textContent = `Imprimiendo ${ticket.tipoLabel.toLowerCase()} #${ticket.numero}...`;
  await window.impressPrint.printPdfUrl(ticket.pdfUrl, currentTicketPrintOptions());
  if (markPrinted) markTicketPrinted(ticket.ticketKey);
  ticketAutoStatus.textContent = `Ticket #${ticket.numero} enviado a impresion`;
  renderTickets(latestTickets);
}

async function printSelectedTickets() {
  const checkedKeys = getCheckedKeys();
  if (!checkedKeys.size) {
    setMessage("No hay tickets seleccionados", "error");
    return;
  }

  const toprint = latestTickets.filter((t) => checkedKeys.has(t.ticketKey));
  setMessage(`Imprimiendo ${toprint.length} ticket(s)...`);
  for (const ticket of toprint) {
    await printTicket(ticket, { markPrinted: true });
  }
  setMessage(`${toprint.length} ticket(s) enviados a impresion`);
}

function updateAutoStatusText() {
  const printerName = ticketPrinterSelect.value || "";
  const printerPaused = colaPausedPrinters.has(printerName);
  const paused = !autoPrintEnabled || printerPaused;
  ticketAutoStatus.dataset.paused = paused ? "true" : "false";
  if (!autoPrintEnabled) {
    ticketAutoStatus.textContent = "Autoimpresion pausada globalmente.";
  } else if (printerPaused) {
    ticketAutoStatus.textContent = `Autoimpresion pausada para "${printerName}".`;
  } else {
    ticketAutoStatus.textContent = "Autoimpresion activa: imprime una sola vez cada ticket nuevo.";
  }
}

async function autoPrintNewTickets(tickets) {
  const printerName = ticketPrinterSelect.value || "";
  if (autoPrintBusy || !autoPrintEnabled || !printerName) return;
  if (colaPausedPrinters.has(printerName)) {
    updateAutoStatusText();
    return;
  }

  const printed = printedTickets();
  const pending = tickets.filter((ticket) => !printed.has(ticket.ticketKey));
  if (!pending.length) {
    updateAutoStatusText();
    return;
  }

  autoPrintBusy = true;
  try {
    for (const ticket of pending) {
      if (!autoPrintEnabled) break;
      ticketAutoStatus.textContent = `Autoimprimiendo ${ticket.tipoLabel.toLowerCase()} #${ticket.numero}...`;
      await printTicket(ticket, { markPrinted: true });
    }
    updateAutoStatusText();
  } finally {
    autoPrintBusy = false;
  }
}

async function loadJob() {
  // Modo standalone: sin job pero con config guardada → ir directo a la cola.
  if (!job && base && queueKey) {
    await loadPrinters();
    setTab("tickets");
    setStatus("");
    fileNameEl.textContent = "Cola del día";
    pageCountEl.textContent = "Modo standalone";
    rows(configListEl, [["Modo", "Cola autónoma"], ["Servidor", base]]);
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
  const { pedido, archivo } = printJob;
  currentPrintedUrl = printJob.printedUrl || "";

  fileNameEl.textContent = archivo.nombre_archivo || "-";
  await loadPrinters();
  applyRequestedProfile(archivo);
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

  await renderPdf(printJob.pdfUrl);
  printButton.disabled = false;
  systemPrintButton.disabled = false;
  await loadTickets();
}

// Recibe un nuevo job desde una segunda instancia del protocolo.
// Actualiza el panel PDF con el nuevo archivo y fusiona los tickets nuevos
// a la cola existente sin perder el estado del día.
async function loadNewJob(newJob, newBase, newKey) {
  job = newJob;
  base = newBase;
  if (newKey) queueKey = newKey;

  setTab("pdf");
  setStatus("Cargando nuevo trabajo...");
  printButton.disabled = true;
  systemPrintButton.disabled = true;

  try {
    const res = await fetch(`${newBase}/api/print-jobs/${encodeURIComponent(newJob)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "No pude abrir el nuevo trabajo");
    }

    printJob = await res.json();
    const { pedido, archivo } = printJob;
    currentPrintedUrl = printJob.printedUrl || "";

    fileNameEl.textContent = archivo.nombre_archivo || "-";
    applyRequestedProfile(archivo);
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

    await renderPdf(printJob.pdfUrl);
    printButton.disabled = false;
    systemPrintButton.disabled = false;

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
        await autoPrintNewTickets(latestTickets);
      }
    }

    setMessage(`Nuevo trabajo cargado: ${archivo.nombre_archivo || pedido.numero}`);
  } catch (err) {
    setStatus("");
    setMessage(err.message, "error");
  }
}

// Agrega el PDF actual a la cola de impresión (no imprime de inmediato).
function addToPdfQueue() {
  if (!printJob?.pdfUrl) {
    setMessage("No hay PDF cargado para agregar a la cola.", "error");
    return;
  }
  const opts = currentPrintOptions();
  const name = fileNameEl.textContent || "Documento";
  pdfQueue.push({
    id: `pdf-${Date.now()}`,
    name,
    pdfUrl: printJob.pdfUrl,
    options: opts,
    printedUrl: currentPrintedUrl || "",
  });
  setMessage(`"${name}" agregado a la cola. Autorizalo desde la pestaña Cola.`);
  setTab("cola");
}

const printSelectedButton = document.getElementById("printSelectedButton");
const selectAllButton = document.getElementById("selectAllButton");
const selectNoneButton = document.getElementById("selectNoneButton");
const toggleAutoPrintButton = document.getElementById("toggleAutoPrintButton");

printButton.addEventListener("click", addToPdfQueue);
systemPrintButton.addEventListener("click", () => window.print());
colorButton.addEventListener("click", () => setColor(true));
bwButton.addEventListener("click", () => setColor(false));
pdfTab.addEventListener("click", () => setTab("pdf"));
ticketsTab.addEventListener("click", () => setTab("tickets"));
colaTab.addEventListener("click", () => setTab("cola"));
refreshTicketsButton.addEventListener("click", () => {
  ticketsLoaded = false;
  loadTickets().catch((error) => setMessage(error.message, "error"));
});
document.getElementById("colaRefreshButton").addEventListener("click", () => {
  ticketsLoaded = false;
  loadTickets().catch((error) => setMessage(error.message, "error"));
});

// Collapsible right-panel cards
document.querySelectorAll(".collapsible .collapse-toggle").forEach((btn) => {
  btn.addEventListener("click", () => btn.closest(".collapsible").classList.toggle("collapsed"));
});
ticketPrinterSelect.addEventListener("change", () => {
  localStorage.setItem(TICKET_PRINTER_KEY, ticketPrinterSelect.value);
});
closeButton.addEventListener("click", () => window.close());
printSelectedButton.addEventListener("click", () => {
  printSelectedTickets().catch((error) => setMessage(error.message, "error"));
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
toggleAutoPrintButton.addEventListener("click", () => {
  autoPrintEnabled = !autoPrintEnabled;
  toggleAutoPrintButton.textContent = autoPrintEnabled ? "⏸ Pausar auto" : "▶ Reanudar auto";
  toggleAutoPrintButton.classList.toggle("secondary", !autoPrintEnabled);
  updateAutoStatusText();
});

// Escuchar jobs nuevos enviados desde otra instancia del protocolo.
window.impressPrint.onNewJob(({ job: newJob, base: newBase, key: newKey }) => {
  loadNewJob(newJob, newBase, newKey).catch((err) => setMessage(err.message, "error"));
});

loadJob().catch((error) => {
  setStatus("");
  setMessage(error.message, "error");
});

setInterval(() => {
  if ((job && base) || (!job && base && queueKey)) {
    loadTickets().catch((error) => setMessage(error.message, "error"));
  }
}, 15000);
