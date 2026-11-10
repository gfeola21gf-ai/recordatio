/* file.js — gli ALLEGATI (foto, PDF, audio, video, altri file).
   1. Appena li aggiungi vengono COPIATI dentro l'app (archivio del telefono, IndexedDB):
      se poi cancelli la foto dal rullino, qui resta.
   2. Poi vengono caricati nel tuo archivio privato su Supabase (bucket "recordatio"), così li vedi
      anche su iPad e Mac. Le foto grandi vengono rimpicciolite (bastano 2400 px per leggere tutto).
   3. Video e file oltre 45 MB restano SOLO sul dispositivo dove li hai aggiunti (lo spazio gratis è poco).
   Se manca la rete, il caricamento riparte da solo più tardi. */
import { sb, PROVA, chiSei } from "./dati.js?v=20261110152528";

const BUCKET = "recordatio";
const MAX_CLOUD = 45 * 1024 * 1024;

// ---------- archivio del telefono (IndexedDB) ----------
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((ok, ko) => {
    const r = indexedDB.open("recordatio-file", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("file");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  return dbp;
}
async function idb(modo, fn) {
  const d = await db();
  return new Promise((ok, ko) => {
    const t = d.transaction("file", modo);
    const req = fn(t.objectStore("file"));
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => ko(t.error);
  });
}
export const salvaLocale = (id, blob) => idb("readwrite", s => s.put(blob, id));
export const leggiLocale = id => idb("readonly", s => s.get(id));
export const togliLocale = id => idb("readwrite", s => s.delete(id));

// ---------- tipi ----------
export function tipoDi(file) {
  const m = file.type || "", n = (file.name || "").toLowerCase();
  if (m.startsWith("image/") || /\.(jpe?g|png|heic|webp|gif)$/.test(n)) return "img";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("audio/") || /\.(m4a|mp3|wav|aac|ogg)$/.test(n)) return "audio";
  if (m.startsWith("video/") || /\.(mov|mp4|m4v)$/.test(n)) return "video";
  return "file";
}
const estensione = (file, tipo) => (file.name?.match(/\.([a-z0-9]{2,5})$/i)?.[1] || { img: "jpg", pdf: "pdf", audio: "m4a", video: "mp4" }[tipo] || "bin").toLowerCase();
export const peso = b => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} kB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

/** rimpicciolisce le foto troppo grandi (lato lungo max 2400 px, JPEG di buona qualità) */
async function preparaFoto(file) {
  try {
    const bmp = await createImageBitmap(file);
    const lato = Math.max(bmp.width, bmp.height), k = Math.min(1, 2400 / lato);
    if (k === 1 && file.size < 1.5 * 1024 * 1024) return { blob: file, w: bmp.width, h: bmp.height };
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.86));
    return { blob: blob || file, w: c.width, h: c.height, mime: "image/jpeg" };
  } catch { return { blob: file }; }
}

/** da un file scelto/scattato/registrato → allegato pronto da salvare nella scheda */
export async function nuovoAllegato(file, schedaId, extra = {}) {
  const tipo = tipoDi(file);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let blob = file, w, h, mime = file.type || "application/octet-stream";
  if (tipo === "img") { const p = await preparaFoto(file); blob = p.blob; w = p.w; h = p.h; mime = p.mime || mime; }
  await salvaLocale(id, blob);
  const soloQui = tipo === "video" || blob.size > MAX_CLOUD;
  const ext = mime === "image/jpeg" ? "jpg" : estensione(file, tipo);
  return {
    id, tipo, nome: file.name || ({ img: "Foto", pdf: "Documento", audio: "Audio", video: "Video" }[tipo] || "File"),
    mime, dim: blob.size, w, h, soloQui, caricato: false, percorso: soloQui ? null : null, ext, schedaId, ...extra,
  };
}

// ---------- caricamento su Supabase ----------
const CODA = "recordatio.caricamenti";
const coda = () => { try { return JSON.parse(localStorage.getItem(CODA) || "[]"); } catch { return []; } };
const salvaCoda = c => { try { localStorage.setItem(CODA, JSON.stringify(c)); } catch { /* */ } };
export function accoda(a) { if (!a.soloQui && !PROVA) { const c = coda().filter(x => x.id !== a.id); c.push({ id: a.id, schedaId: a.schedaId, ext: a.ext, mime: a.mime }); salvaCoda(c); } }

let caricando = false;
/** carica i file in attesa; quando uno è arrivato chiama fatto(schedaId, allegatoId, percorso) */
export async function caricaInAttesa(fatto) {
  if (caricando || PROVA || !chiSei() || !navigator.onLine) return;
  caricando = true;
  try {
    for (const x of coda()) {
      const blob = await leggiLocale(x.id);
      if (!blob) { salvaCoda(coda().filter(y => y.id !== x.id)); continue; }
      const percorso = `${chiSei().id}/${x.schedaId}/${x.id}.${x.ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(percorso, blob, { contentType: x.mime, upsert: true });
      if (error) { console.warn("Caricamento:", error.message); break; }
      salvaCoda(coda().filter(y => y.id !== x.id));
      fatto(x.schedaId, x.id, percorso);
    }
  } finally { caricando = false; }
}
export const inCoda = () => coda().length;

// ---------- aprire un allegato ----------
const indirizzi = new Map();
/** indirizzo (blob:) dell'allegato: dal telefono se c'è, se no lo scarica dal tuo archivio e lo tiene */
export async function url(a) {
  if (indirizzi.has(a.id)) return indirizzi.get(a.id);
  let blob = await leggiLocale(a.id).catch(() => null);
  if (!blob && a.percorso && !PROVA) {
    const { data, error } = await sb.storage.from(BUCKET).download(a.percorso);
    if (error) throw new Error("Non riesco a scaricare il file: " + error.message);
    blob = data;
    salvaLocale(a.id, blob).catch(() => { });
  }
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  indirizzi.set(a.id, u);
  return u;
}
export async function elimina(a) {
  await togliLocale(a.id).catch(() => { });
  salvaCoda(coda().filter(y => y.id !== a.id));
  if (a.percorso && !PROVA) await sb.storage.from(BUCKET).remove([a.percorso]).catch(() => { });
}

// ---------- PDF (pdf.js da CDN, caricato solo quando serve) ----------
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/";
let pdfjs = null;
async function libPdf() {
  if (!pdfjs) {
    pdfjs = await import(PDFJS + "pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.mjs";
  }
  return pdfjs;
}
export async function apriPdf(a) {
  const lib = await libPdf();
  const u = await url(a);
  if (!u) throw new Error("File non disponibile su questo dispositivo");
  return lib.getDocument({ url: u, isEvalSupported: false }).promise;
}
/** disegna una pagina in un canvas largo `larghezza` px (nitido sugli schermi Retina) */
export async function disegnaPagina(doc, n, larghezza, qualita = 2) {
  const p = await doc.getPage(n);
  const v1 = p.getViewport({ scale: 1 });
  const scala = larghezza / v1.width * qualita;
  const v = p.getViewport({ scale: scala });
  const c = document.createElement("canvas");
  c.width = Math.round(v.width); c.height = Math.round(v.height);
  c.style.width = larghezza + "px"; c.style.height = Math.round(v.height / qualita) + "px";
  await p.render({ canvasContext: c.getContext("2d"), viewport: v }).promise;
  return c;
}
const miniature = new Map();
/** immagine piccola della prima pagina (per le anteprime) */
export async function miniaturaPdf(a, larghezza = 240) {
  if (miniature.has(a.id)) return miniature.get(a.id);
  const doc = await apriPdf(a);
  const c = await disegnaPagina(doc, 1, larghezza, 1.5);
  const u = c.toDataURL("image/jpeg", 0.8);
  miniature.set(a.id, u);
  return u;
}
