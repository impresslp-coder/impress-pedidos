window.__IMPRESS_PRINT_READY__ = false;
window.__IMPRESS_PRINT_ERROR__ = "";
window.__IMPRESS_PRINT_LOGS__ = [];

function log(message, extra = {}) {
  const entry = {
    time: new Date().toISOString(),
    message,
    ...extra,
  };
  window.__IMPRESS_PRINT_LOGS__.push(entry);
  console.info(`[IMPRESS print-renderer] ${message}`, extra);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canvasHasInk(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const width = canvas.width;
  const height = canvas.height;
  const probes = [
    [Math.floor(width * 0.5), Math.floor(height * 0.18)],
    [Math.floor(width * 0.5), Math.floor(height * 0.32)],
    [Math.floor(width * 0.25), Math.floor(height * 0.5)],
    [Math.floor(width * 0.5), Math.floor(height * 0.5)],
    [Math.floor(width * 0.75), Math.floor(height * 0.5)],
    [Math.floor(width * 0.5), Math.floor(height * 0.72)],
  ];

  for (const [x, y] of probes) {
    const data = context.getImageData(x, y, 1, 1).data;
    if (data[3] > 0 && (data[0] < 245 || data[1] < 245 || data[2] < 245)) return true;
  }

  const sample = context.getImageData(0, 0, width, height).data;
  const step = Math.max(4, Math.floor(sample.length / 6000));
  for (let index = 0; index < sample.length; index += step - (step % 4)) {
    if (sample[index + 3] > 0 && (sample[index] < 245 || sample[index + 1] < 245 || sample[index + 2] < 245)) {
      return true;
    }
  }

  return false;
}

async function renderPage(page, canvas, viewport, pageNumber) {
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const task = page.render({ canvasContext: context, viewport, intent: "print" });
  await task.promise;
  await wait(150);

  if (!canvasHasInk(canvas)) {
    throw new Error(`La pagina ${pageNumber} se renderizo en blanco. Se cancela para no mandar hojas vacias a la impresora.`);
  }

  canvas.dataset.rendered = "true";
  log("Pagina renderizada con contenido", { pageNumber, width: canvas.width, height: canvas.height });
}

function parseRanges(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function render() {
  log("Inicio de preparacion de tanda", { href: window.location.href });

  const pdfjsLib = await import("./vendor/pdfjs/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "./vendor/pdfjs/pdf.worker.mjs",
    import.meta.url,
  ).href;

  const params = new URLSearchParams(window.location.search);
  const pdfUrl = params.get("pdfUrl");
  const ranges = parseRanges(params.get("ranges"));
  if (!pdfUrl) throw new Error("No hay PDF para imprimir");

  log("Descargando PDF", { pdfUrl, ranges });
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`No pude descargar el PDF (${res.status})`);

  const data = new Uint8Array(await res.arrayBuffer());
  log("PDF descargado", { bytes: data.byteLength });
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  if (ranges.length) {
    for (const range of ranges) {
      const from = Math.max(0, Number(range.from) || 0);
      const to = Math.min(pdf.numPages - 1, Number(range.to) || from);
      for (let pageIndex = from; pageIndex <= to; pageIndex += 1) {
        pages.push(pageIndex + 1);
      }
    }
  } else {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      pages.push(pageNumber);
    }
  }

  log("Paginas seleccionadas para imprimir", { totalPages: pdf.numPages, pages });

  for (const pageNumber of pages) {
    log("Renderizando pagina", { pageNumber });
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = "page";
    document.body.appendChild(canvas);
    await renderPage(page, canvas, viewport, pageNumber);
  }

  await wait(500);
  log("Tanda preparada", { renderedPages: pages.length });
  window.__IMPRESS_PRINT_READY__ = true;
}

render().catch((error) => {
  window.__IMPRESS_PRINT_ERROR__ = error?.stack || error?.message || String(error);
  log("Error preparando tanda", { error: window.__IMPRESS_PRINT_ERROR__ });
});
