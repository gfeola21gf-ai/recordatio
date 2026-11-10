/* app.js — le SCHERMATE di Recordatio.
   Oggi (il neurone) · Cartelle · Calendario · Progressi, più gli schermi a tutto schermo
   (Ripasso, Fine giornata, Dettaglio scheda, Cartella, Impostazioni), i fogli dal basso
   (Nuova scheda, Cartella, Sequenza, Registra audio, Vacanza) e il visore con lo zoom.
   Ogni pulsante ha data-a="nome": l'azione corrispondente sta nell'oggetto AZ. */
import * as D from "./dati.js?v=20261110152528";
import * as L from "./logica.js?v=20261110152528";
import * as F from "./file.js?v=20261110152528";
import * as P from "./push.js?v=20261110152528";

const app = document.getElementById("app");
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const aspetta = ms => new Promise(r => setTimeout(r, ms));

// ---------- stato dell'interfaccia (non salvato) ----------
const U = { vista: "oggi", aperte: new Set(), cerca: "", tag: null, mese: null, giorno: null, schermi: [], foglio: null, bozza: null };
const schermo = () => U.schermi[U.schermi.length - 1] || null;

// ---------- dati ----------
const prof = () => D.leggi("profilo") || {};
const schede = () => D.elenco("sch:").map(([k, v]) => ({ ...v, id: k.slice(4) }));
const scheda = id => { const v = D.leggi("sch:" + id); return v ? { ...v, id } : null; };
const cartelle = () => Object.fromEntries(D.elenco("cart:").map(([k, v]) => [k.slice(5), { ...v, id: k.slice(5) }]));
const sequenze = () => L.tutteSequenze(Object.fromEntries(D.elenco("seq:").map(([k, v]) => [k.slice(4), v])));
const ctx = (lista = schede()) => ({ sequenze: sequenze(), cartelle: cartelle(), carico: L.carico(lista), profilo: prof() });
function salvaScheda(s) { const { id, ...v } = s; D.scrivi("sch:" + id, v); }
const attivi = () => Object.fromEntries(D.elenco("att:").map(([k]) => [k.slice(4), 1]));

function percorso(id, C = cartelle()) {
  const nomi = []; let giri = 0;
  while (id && C[id] && giri++ < 20) { nomi.unshift(C[id].nome); id = C[id].padre; }
  return nomi.join(" › ");
}
function coloreDi(id, C = cartelle()) {
  let giri = 0;
  while (id && C[id] && giri++ < 20) { if (C[id].colore) return C[id].colore; id = C[id].padre; }
  return "var(--mu)";
}
const figlie = (id, C = cartelle()) => Object.values(C).filter(c => (c.padre || null) === (id || null)).sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0) || a.nome.localeCompare(b.nome));
function discendenti(id, C = cartelle()) { const out = [id]; for (const f of figlie(id, C)) out.push(...discendenti(f.id, C)); return out; }
const nomeModo = (m, S = sequenze()) => S[L.normaModo(m).slice(4)]?.nome || S.solido.nome;
const nSchede = n => `${n} ${n === 1 ? "scheda" : "schede"}`;
const ripassiOggi = lista => lista.reduce((n, s) => n + (s.storico || []).filter(r => r.data === L.oggi()).length, 0);

// ---------- icone (tratti sottili, niente emoji) ----------
const sv = (d, w = 21, sw = 1.5, extra = "") => `<svg width="${w}" height="${w}" viewBox="0 0 21 21" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICO = {
  oggi: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="2.5" fill="currentColor"/><circle cx="10" cy="10" r="7"/></svg>`,
  cartelle: sv('<path d="M3 6.5a1.5 1.5 0 011.5-1.5h3.5l2 2h6.5A1.5 1.5 0 0118 8.5v6.5a1.5 1.5 0 01-1.5 1.5h-12A1.5 1.5 0 013 15z"/>'),
  cal: sv('<rect x="3.5" y="4.5" width="14" height="13" rx="2.5"/><path d="M3.5 9h14M7.5 3v3M13.5 3v3"/>'),
  prog: sv('<path d="M3 15l4.5-5 3.5 3 6.5-7"/><circle cx="17.5" cy="6" r="1.5" fill="currentColor"/>'),
  piu: sv('<path d="M10.5 4v13M4 10.5h13"/>', 22, 2.1),
  x: sv('<path d="M5 5l11 11M16 5L5 16"/>', 14, 2),
  ind: sv('<path d="M13 4l-6 6.5 6 6.5"/>', 14, 2),
  ava: sv('<path d="M8 4l6 6.5-6 6.5"/>', 14, 2),
  giu: sv('<path d="M5 8l5.5 5.5L16 8"/>', 14, 1.8),
  freccia: sv('<path d="M4 10.5h12M11.5 6l4.5 4.5-4.5 4.5"/>', 16, 1.8),
  ingr: sv('<path d="M3 8V3h5M18 8V3h-5M3 13v5h5M18 13v5h-5"/>', 16),
  matita: sv('<path d="M4 17l1-4 9-9 3 3-9 9z"/>', 18),
  cerca: sv('<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4"/>', 16, 1.6),
  ingr2: sv('<path d="M3 6.5h5l1.6-2h1.8L13 6.5h5v10.5H3z"/><circle cx="10.5" cy="11.5" r="3.2"/>', 22),
  foto: sv('<path d="M3 7h3l2-3h5l2 3h3v10.5H3z"/><circle cx="10.5" cy="11.5" r="3.3"/>', 22),
  galleria: sv('<rect x="3" y="4" width="15" height="13" rx="2"/><path d="M3 14l4.5-4.5 4 4 2-2 4.5 4.5"/>', 22),
  file: sv('<path d="M6 2.5h6.5l3.5 3.5v12.5H6z"/><path d="M12.5 2.5V6H16"/>', 22),
  mic: sv('<rect x="8" y="2.5" width="5" height="10" rx="2.5"/><path d="M4.5 10a6 6 0 0012 0M10.5 16v2.5"/>', 22),
  play: `<svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><path d="M1 1l8 5-8 5z" fill="currentColor"/></svg>`,
  pausa: `<svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><path d="M1.5 1h2.4v10H1.5zM6.1 1h2.4v10H6.1z" fill="currentColor"/></svg>`,
  pdf: sv('<path d="M6 2.5h6.5l3.5 3.5v12.5H6z"/><path d="M8.5 11h4M8.5 14h4M8.5 8h2"/>', 20),
  audio: sv('<path d="M4 10.5v0M7 7.5v6M10 4.5v12M13 7.5v6M16 9.5v2"/>', 20, 1.7),
  video: sv('<rect x="3" y="5" width="11" height="11" rx="2"/><path d="M14 9l4-2.5v8L14 12"/>', 20),
  ingranaggio: sv('<circle cx="10.5" cy="10.5" r="2.8"/><path d="M10.5 2.5v2.2M10.5 16.3v2.2M2.5 10.5h2.2M16.3 10.5h2.2M4.8 4.8l1.6 1.6M14.6 14.6l1.6 1.6M4.8 16.2l1.6-1.6M14.6 6.4l1.6-1.6"/>', 18),
  nuovaCart: sv('<path d="M2.5 6h5l2 2h7.5v8.5h-14.5z"/><path d="M10 10v4M8 12h4"/>', 18),
  maschera: sv('<rect x="3" y="5" width="15" height="11" rx="2" stroke-dasharray="3 2.5"/><path d="M7 10.5h7"/>', 18),
  spunta: `<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M1.5 4l1.8 1.8L6.5 2"/></svg>`,
  cestino: sv('<path d="M4 6h13M8 6V4h5v2M5.5 6l1 11.5h8L15.5 6"/>', 18),
};

// ---------- pezzi comuni ----------
function barra() {
  const T = [["oggi", "Oggi", ICO.oggi], ["cartelle", "Cartelle", ICO.cartelle], ["calendario", "Calendario", ICO.cal], ["progressi", "Progressi", ICO.prog]];
  return `<div class="sfuma"></div><nav class="bar"><div class="cap">${T.map(([k, n, i]) =>
    `<button class="it ${U.vista === k ? "on" : ""}" data-a="vai" data-v="${k}" aria-label="${n}">${i}${U.vista === k ? n : ""}</button>`).join("")}</div>
    <button class="fab" data-a="nuova" aria-label="Nuova scheda">${ICO.piu}</button></nav>`;
}
function segs(f, tot = 5) {
  const n = f == null ? 0 : Math.round(Math.min(1, Math.max(0, (f - .5) / .45)) * tot);
  return `<span class="segs" aria-label="solidità ${n} su ${tot}">${Array.from({ length: tot }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
}
/** solidità di una scheda: quanto è "stabile" (giorni di stabilità → 0..1) */
function solidita(s) {
  const st = s.storico || [];
  if (!st.length) return null;
  const u = st[st.length - 1].s || 1;
  return Math.min(1, 0.5 + Math.log10(1 + u) / 2.2 * 0.5);
}
function miniatura(s, cls = "") {
  const a = (s.allegati || []).find(x => !x.spiegazione) || (s.allegati || [])[0];
  if (!a) return `<span class="mini ${cls}">${ICO.file}</span>`;
  if (a.tipo === "img") return `<span class="mini ${cls}" data-sfondo="${s.id}|${a.id}"></span>`;
  if (a.tipo === "pdf") return `<span class="mini ${cls}" data-pdfmini="${s.id}|${a.id}">${ICO.pdf}</span>`;
  return `<span class="mini ${cls}">${ICO[a.tipo] || ICO.file}</span>`;
}
function rigaScheda(s, { badge = "", C } = {}) {
  const sot = [percorso(s.cartella, C) || "Senza cartella", s.prossimo ? L.quando(s.prossimo) : ""].filter(Boolean).join(" · ");
  return `<button class="riga card" data-a="apriScheda" data-id="${s.id}">${miniatura(s)}
    <span class="corpo"><span class="tit" style="display:block">${esc(s.titolo || "Senza titolo")}</span><span class="sot" style="display:block">${esc(sot)}</span></span>
    ${badge || segs(solidita(s))}</button>`;
}

/** il NEURONE: un segmento di mielina per ogni ripasso del giorno (fino a 8) */
function neurone(tot, fatti, { tutto = false } = {}) {
  const n = Math.max(1, Math.min(tot || 6, 8));
  const accesi = tutto ? n : tot ? Math.min(n, Math.round(fatti / tot * n)) : 0;
  const ora = !tutto && tot > fatti ? accesi : -1;
  const x0 = 136, x1 = 314, g = 6, w = (x1 - x0 - g * (n - 1)) / n;
  let seg = "", glow = "";
  for (let i = 0; i < n; i++) {
    const x = (x0 + i * (w + g)).toFixed(1), c = i < accesi ? "on" : i === ora ? "ora" : "off";
    if (c !== "off") glow += `<rect class="n-glow" x="${x}" y="131" width="${w.toFixed(1)}" height="14" rx="7" style="fill:${c === "on" ? "var(--pk)" : "var(--az)"}" filter="url(#ng)"/>`;
    seg += `<rect class="n-seg ${c}" x="${x}" y="131" width="${w.toFixed(1)}" height="14" rx="7"/>`;
  }
  const fine = accesi ? x0 + accesi * (w + g) - g : 120;
  const asse = `M110 128 C118 133 122 137 132 138 L${tutto ? 320 : fine.toFixed(1)} 138`;
  const stelle = tutto ? [[366, 86, 6, "--pk", 0], [370, 170, 5, "--az", .4], [330, 196, 4, "--pk", .8], [318, 92, 4, "--az", 1.2], [300, 112, 3, "--pk2", .2]]
    .map(([x, y, s, c, d]) => `<path class="n-star" style="fill:var(${c});animation-delay:${d}s" d="M${x} ${y - s}L${x + s * .3} ${y - s * .3}L${x + s} ${y}L${x + s * .3} ${y + s * .3}L${x} ${y + s}L${x - s * .3} ${y + s * .3}L${x - s} ${y}L${x - s * .3} ${y - s * .3}Z"/>`).join("") : "";
  return `<svg class="neurone ${tutto ? "tutto" : ""}" viewBox="0 0 375 250" role="img" aria-label="Neurone: ${fatti} ripassi fatti su ${tot}">
    <defs><filter id="ng" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter></defs>
    <g class="n-dend" stroke-width="2.2"><path d="M78 112 C70 96 58 84 40 70"/><path d="M96 106 C100 90 104 70 100 48"/><path d="M68 132 C54 132 40 128 24 120"/><path d="M74 150 C64 166 52 180 36 196"/><path d="M96 154 C100 172 102 190 98 212"/></g>
    <g class="n-dend" stroke-width="1.2"><path d="M58 86 C50 74 46 64 46 52"/><path d="M48 76 C36 74 26 76 16 72"/><path d="M102 72 C114 62 120 52 122 40"/><path d="M100 58 C92 50 86 44 82 34"/><path d="M44 129 C34 136 24 142 14 146"/><path d="M54 176 C52 190 50 200 44 212"/><path d="M44 188 C34 188 26 192 18 196"/><path d="M100 186 C110 196 116 204 118 216"/></g>
    <g class="n-dend" stroke-width=".7" opacity=".7"><path d="M46 52 L42 44M46 52 L52 45M16 72 L9 74M122 40 L126 32M82 34 L76 28M14 146 L8 152M44 212 L46 220M18 196 L10 196M118 216 L124 222M98 212 L94 220M40 70 L32 66M36 196 L30 204M24 120 L16 116"/></g>
    <path class="n-glow" d="M76 112 C82 104 96 104 102 112 C110 118 114 128 112 136 C110 146 102 154 92 154 C80 156 70 148 68 138 C66 128 70 118 76 112 Z" style="fill:var(--pk)" filter="url(#ng)" opacity=".5"/>
    <path class="n-soma" d="M76 112 C82 104 96 104 102 112 C110 118 114 128 112 136 C110 146 102 154 92 154 C80 156 70 148 68 138 C66 128 70 118 76 112 Z"/>
    <circle class="n-nuc" cx="90" cy="131" r="10"/><circle class="n-nuc2" cx="92" cy="129" r="3.2"/>
    <path class="n-ax" d="M110 128 C118 133 122 137 132 138 L320 138"/>
    ${accesi || tutto ? `<path class="n-ax on" d="${asse}"/><path class="n-spike" d="${asse}" stroke-dasharray="6 194"/>` : ""}
    ${glow}${seg}
    <g class="n-term"><path d="M320 138 C330 130 336 116 342 102"/><path d="M320 138 C334 138 344 140 356 142"/><path d="M320 138 C330 148 336 162 342 176"/><path d="M336 116 C344 112 350 110 358 104"/></g>
    ${tutto ? [[342, 102], [356, 142], [342, 176], [358, 104]].map(([x, y]) => `<circle class="n-glow" cx="${x}" cy="${y}" r="9" style="fill:var(--pk)" filter="url(#ng)"/>`).join("") : ""}
    <g class="n-bot"><circle cx="342" cy="102" r="4"/><circle cx="356" cy="142" r="4"/><circle cx="342" cy="176" r="4"/><circle cx="358" cy="104" r="3"/></g>
    ${stelle}</svg>`;
}
/** piccolo assone per l'avanzamento del ripasso */
function assone(tot, fatti) {
  const n = Math.max(1, Math.min(tot, 12)), acc = Math.min(n, Math.round(fatti / Math.max(1, tot) * n));
  const w = (246 - 6 * (n - 1)) / n;
  let r = "";
  for (let i = 0; i < n; i++) {
    const x = (2 + i * (w + 6)).toFixed(1), c = i < acc ? "on" : i === acc ? "ora" : "off";
    r += `<rect class="n-seg ${c}" x="${x}" y="2" width="${w.toFixed(1)}" height="12" rx="6"/>`;
  }
  return `<svg class="assone" viewBox="0 0 250 16" role="img" aria-label="Ripasso ${fatti + 1} di ${tot}"><line x1="0" y1="8" x2="250" y2="8" style="stroke:var(--dim)" stroke-width="1.4"/>
    <line x1="0" y1="8" x2="${(2 + acc * (w + 6)).toFixed(1)}" y2="8" style="stroke:var(--pk)" stroke-width="2"/>${r}</svg>`;
}

// =====================================================================
// VISTE PRINCIPALI
// =====================================================================
function vistaOggi() {
  const tutte = schede(), g = L.oggi(), p = prof();
  const dovute = L.daFare(tutte, g);
  const coda = p.tetto ? dovute.slice(0, p.tetto) : dovute;
  const fatti = ripassiOggi(tutte);
  const tot = coda.length + fatti;
  const serie = L.serie(tutte, attivi()).n;
  const vac = p.vacanza?.fino >= g ? p.vacanza : null;
  const C = cartelle();
  let bottone;
  if (!tutte.length) bottone = `<button class="btn principale" data-a="nuova">Crea la tua prima scheda ${ICO.freccia}</button>`;
  else if (coda.length) bottone = `<button class="btn principale" data-a="iniziaRipasso">${fatti ? "Continua" : "Inizia"} · ${esc(coda[0].titolo || "Senza titolo")} ${ICO.freccia}</button>`;
  else if (fatti) bottone = `<button class="btn chiaro" data-a="festa">Giornata completata</button>`;
  else bottone = `<button class="btn chiaro" data-a="nuova">Niente da ripassare oggi · aggiungi una scheda</button>`;
  const domani = (L.carico(tutte)[L.piu(g, 1)] || 0) + Math.max(0, dovute.length - coda.length);
  return `<div class="halo"></div><div class="vista">
    <div class="testa"><div><div class="marchio">recordatio<i>.</i></div><div class="data">${L.maiuscola(L.giornoLungo(g))}</div></div>
      <span class="pill" aria-label="${serie} giorni di fila"><span class="pt"></span>${serie} ${serie === 1 ? "giorno" : "giorni"}</span></div>
    ${!D.PROVA && !p.nascondiInvito && tutte.length && ["da-attivare", "serve-installazione"].includes(P.statoNotifiche()) ? `<div class="card" style="margin-top:14px;padding:12px 14px;display:flex;align-items:center;gap:10px">
      <span style="flex:1;font-size:13px;line-height:1.4">${P.statoNotifiche() === "da-attivare" ? "Vuoi un avviso quando è ora di ripassare?" : "Per le notifiche: Safari › Condividi › Aggiungi alla schermata Home, poi apri l'app da lì."}</span>
      ${P.statoNotifiche() === "da-attivare" ? `<button class="badge" style="border:0" data-a="attivaNotifiche">Attiva</button>` : ""}<button class="link" style="color:var(--mu);font-size:12px" data-a="nascondiInvito">Non ora</button></div>` : ""}
    ${vac ? `<div class="avviso" style="margin-top:14px">In vacanza fino a ${L.giornoLungo(vac.fino)}: niente ripassi e niente notifiche. <button class="link" data-a="fineVacanza" style="padding:0">Torna ora</button></div>` : ""}
    ${neurone(tot, fatti, { tutto: tot > 0 && !coda.length })}
    <div class="conto">${tot ? `${fatti}<span>/${tot}</span>` : `<span style="font-size:20px;letter-spacing:-.4px;color:var(--mu)">Tutto tranquillo</span>`}</div>
    <div style="margin-top:16px">${bottone}</div>
    ${coda.length ? `<div class="lista" style="margin-top:14px">${coda.map((s, i) => rigaScheda(s, { C, badge: i === 0 ? `<span class="badge az">ora</span>` : "" })).join("")}</div>` : ""}
    ${dovute.length > coda.length ? `<p class="nota" style="text-align:center">Altre ${dovute.length - coda.length} oltre il tetto di ${p.tetto} al giorno: passano a domani.</p>` : ""}
    ${tutte.length ? `<p class="nota" style="text-align:center;margin-top:16px">Domani: ${domani ? `${domani} ${domani === 1 ? "ripasso" : "ripassi"}` : "nessun ripasso"}</p>` : ""}
  </div>${barra()}`;
}

function vistaCartelle() {
  const C = cartelle(), tutte = schede(), g = L.oggi();
  const tags = [...new Set(tutte.flatMap(s => s.tag || []))].sort();
  const q = U.cerca.trim().toLowerCase();
  let corpo;
  if (q || U.tag) {
    const trovate = tutte.filter(s => (!U.tag || (s.tag || []).includes(U.tag)) &&
      (!q || [s.titolo, s.domande, s.note, ...(s.tag || []), percorso(s.cartella, C)].join(" ").toLowerCase().includes(q)));
    corpo = trovate.length ? `<div class="lista">${trovate.map(s => rigaScheda(s, { C })).join("")}</div>` : `<div class="vuoto">Nessuna scheda trovata.</div>`;
  } else {
    const radici = figlie(null, C);
    const dovutePer = id => { const ids = new Set(discendenti(id, C)); return tutte.filter(s => ids.has(s.cartella) && s.prossimo && s.prossimo <= g && !s.archiviata).length; };
    const quante = id => { const ids = new Set(discendenti(id, C)); return tutte.filter(s => ids.has(s.cartella)).length; };
    const forzaDi = id => { const ids = new Set(discendenti(id, C)); const v = tutte.filter(s => ids.has(s.cartella)).map(solidita).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    corpo = radici.map(c => {
      const sub = figlie(c.id, C), aperta = U.aperte.has(c.id), d = dovutePer(c.id), col = c.colore || "var(--az)";
      return `<div class="card cart">
        <div style="display:flex;align-items:center;gap:6px">
          <button class="capo" data-a="apriCartella" data-id="${c.id}">
            <span class="ico" style="background:color-mix(in srgb, ${col} 18%, transparent);color:${col}">${esc(c.nome.charAt(0).toUpperCase())}</span>
            <span style="flex:1;min-width:0"><span style="display:block;font-size:16px;font-weight:600">${esc(c.nome)}</span>
            <span class="mu" style="display:block;font-size:12px;margin-top:2px">${sub.length ? `${sub.length} ${sub.length === 1 ? "sottocartella" : "sottocartelle"} · ` : ""}${nSchede(quante(c.id))}${c.esame && c.esame >= g ? ` · esame ${L.quando(c.esame)}` : ""}</span></span>
            ${d ? `<span class="badge">${d} oggi</span>` : segs(forzaDi(c.id))}
          </button>
          ${sub.length ? `<button class="iconbtn" style="border:0;background:none;transform:rotate(${aperta ? 180 : 0}deg);transition:transform .25s" data-a="espandi" data-id="${c.id}" aria-label="${aperta ? "Chiudi" : "Apri"} sottocartelle">${ICO.giu}</button>` : ""}
        </div>
        ${aperta && sub.length ? `<div class="sub">${sub.map(f => {
          const df = dovutePer(f.id), fc = coloreDi(f.id, C);
          return `<button data-a="apriCartella" data-id="${f.id}"><span class="ramo"></span><span class="punto" style="background:${fc};color:${fc}"></span>
            <span style="flex:1;min-width:0"><span style="display:block;font-size:14px;font-weight:500">${esc(f.nome)}</span>
            <span class="mu" style="display:block;font-size:11px;margin-top:2px">${nSchede(quante(f.id))} · ${nomeModo(f.modo)}${f.esame && f.esame >= g ? ` · esame ${L.quando(f.esame)}` : ""}</span></span>
            <span style="text-align:right">${segs(forzaDi(f.id))}<span style="display:block;font-size:10px;color:var(--pktx);margin-top:4px;min-height:12px">${df ? df + " oggi" : ""}</span></span></button>`;
        }).join("")}</div>` : ""}
      </div>`;
    }).join("");
    const senza = tutte.filter(s => !s.cartella || !C[s.cartella]);
    if (senza.length) corpo += `<div class="sez"><b>Senza cartella</b><span>${senza.length}</span></div><div class="lista">${senza.map(s => rigaScheda(s, { C })).join("")}</div>`;
    if (!radici.length && !senza.length) corpo = `<div class="vuoto">Crea una cartella per ogni materia o argomento:<br>Università, Crescita personale, Lingue…<br><br><button class="btn" data-a="nuovaCartella">Crea la prima cartella</button></div>`;
  }
  return `<div class="halo"></div><div class="vista">
    <div class="testa"><h1 class="h1">Cartelle</h1><button class="iconbtn" data-a="nuovaCartella" aria-label="Nuova cartella">${ICO.nuovaCart}</button></div>
    <label class="cerca" style="margin-top:14px">${ICO.cerca}<input type="search" placeholder="Cerca schede, #etichette…" value="${esc(U.cerca)}" data-in="cerca" enterkeyhint="search"></label>
    ${tags.length ? `<div class="chips" style="margin-top:10px"><button class="chip ${!U.tag ? "on" : ""}" data-a="tag" data-t="">Tutte</button>${tags.map(t => `<button class="chip ${U.tag === t ? "on" : ""}" data-a="tag" data-t="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px" id="corpoCartelle">${corpo}</div>
  </div>${barra()}`;
}

function vistaCalendario() {
  const g = L.oggi(), tutte = schede(), C = cartelle();
  const mese = U.mese || g.slice(0, 7);
  const [a, m] = mese.split("-").map(Number);
  const primo = new Date(a, m - 1, 1), giorni = new Date(a, m, 0).getDate();
  const vuoti = (primo.getDay() + 6) % 7;
  const scelto = U.giorno || g;
  const perGiorno = {};
  for (const s of tutte) {
    if (s.archiviata) continue;
    if (s.prossimo) { const d = s.prossimo < g ? g : s.prossimo; (perGiorno[d] ||= []).push({ s, fatto: false }); }
    for (const r of s.storico || []) if (r.data < g || r.data === g) (perGiorno[r.data] ||= []).push({ s, fatto: true });
  }
  let celle = "<span></span>".repeat(vuoti);
  let mese_tot = 0;
  for (let d = 1; d <= giorni; d++) {
    const ds = `${mese}-${String(d).padStart(2, "0")}`, voci = perGiorno[ds] || [];
    const pass = ds < g, oggi = ds === g;
    if (!pass) mese_tot += voci.filter(v => !v.fatto).length;
    const colori = [...new Set(voci.map(v => coloreDi(v.s.cartella, C)))].slice(0, 3);
    const punti = colori.map(c => `<i style="background:${c};${pass ? "opacity:.4" : `box-shadow:0 0 6px ${c}`}"></i>`).join("");
    celle += `<button class="gg ${pass ? "pass" : ""} ${oggi ? "oggi" : ""} ${ds === scelto ? "scelto" : ""}" data-a="giorno" data-d="${ds}" aria-label="${L.giornoLungo(ds)}, ${voci.length} ripassi">
      <b>${d}${pass && voci.some(v => v.fatto) ? ICO.spunta : ""}</b><span class="pp">${punti}</span></button>`;
  }
  const voci = perGiorno[scelto] || [];
  const unici = [...new Map(voci.map(v => [v.s.id + v.fatto, v])).values()];
  const lista = unici.length ? `<div class="lista">${unici.map(v => rigaScheda(v.s, { C, badge: v.fatto ? `<span class="badge az">fatto</span>` : "" })).join("")}</div>`
    : `<div class="vuoto" style="padding:16px">Nessun ripasso ${scelto < g ? "fatto" : "previsto"} ${scelto === g ? "oggi" : "in questo giorno"}.</div>`;
  const car = L.carico(tutte);
  const sett = Array.from({ length: 7 }, (_, i) => { const d = L.piu(g, i); return { d, n: i === 0 ? L.daFare(tutte, g).length : (car[d] || 0) }; });
  const max = Math.max(4, ...sett.map(x => x.n));
  const radici = figlie(null, C).slice(0, 4);
  return `<div class="halo"></div><div class="vista">
    <div class="testa"><div><h1 class="h1">${L.maiuscola(L.nomeMese(m - 1))}${a !== new Date().getFullYear() ? " " + a : ""}</h1><div class="data">${mese_tot} ripassi in programma</div></div>
      <div style="display:flex;gap:8px"><button class="iconbtn" data-a="mese" data-d="-1" aria-label="Mese precedente">${ICO.ind}</button><button class="iconbtn" data-a="mese" data-d="1" aria-label="Mese successivo">${ICO.ava}</button></div></div>
    <div style="margin:14px -8px 0"><div class="calgrid sett"><span>L</span><span>M</span><span>M</span><span>G</span><span>V</span><span>S</span><span>D</span></div><div class="calgrid">${celle}</div></div>
    <div class="sez"><b>${L.maiuscola(scelto === g ? "oggi" : L.giornoLungo(scelto))}</b><span>${unici.length || ""}</span></div>${lista}
    <div class="card" style="padding:14px 16px;margin-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:15px;font-weight:600">Prossimi 7 giorni</b><span class="mu" style="font-size:12px">${sett.reduce((x, y) => x + y.n, 0)} ripassi</span></div>
      <div class="barre">${sett.map((x, i) => `<div><span class="mu" style="font-size:10px">${x.n}</span><span class="b ${i === 0 ? "oggi" : ""}" style="height:${Math.round(x.n / max * 64) + 4}px"></span><span style="font-size:11px;${i === 0 ? "color:var(--pktx);font-weight:600" : "color:var(--mu)"}">${["Do", "Lu", "Ma", "Me", "Gi", "Ve", "Sa"][L.daData(x.d).getDay()]}</span></div>`).join("")}</div>
      ${radici.length ? `<div class="mu" style="display:flex;gap:12px;font-size:11px;margin-top:10px;flex-wrap:wrap">${radici.map(c => `<span style="display:flex;align-items:center;gap:5px"><i class="punto" style="width:7px;height:7px;background:${c.colore || "var(--az)"}"></i>${esc(c.nome)}</span>`).join("")}</div>` : ""}
    </div>
  </div>${barra()}`;
}

function vistaProgressi() {
  const tutte = schede(), g = L.oggi();
  const se = L.serie(tutte, attivi());
  const lun = L.piu(g, -((L.daData(g).getDay() + 6) % 7));
  const settimana = ["L", "M", "M", "G", "V", "S", "D"].map((n, i) => {
    const d = L.piu(lun, i);
    const c = se.giorni.has(d) ? "on" : d === g ? "ora" : "";
    return `<div><i class="${c}"></i><span style="color:${d <= g ? "var(--tx)" : "var(--mu)"}">${n}</span></div>`;
  }).join("");
  const solide = tutte.filter(s => (solidita(s) || 0) >= .85).length;
  const voti = tutte.flatMap(s => s.storico || []).filter(r => r.data >= L.piu(g, -30));
  const ricordate = voti.length ? Math.round(voti.filter(r => r.voto >= 3).length / voti.length * 100) : null;
  const serieF = L.forzaNelTempo(tutte, 8, g);
  const vals = serieF.map(v => v == null ? null : Math.round(v * 100));
  const ultima = [...vals].reverse().find(v => v != null);
  const prima = vals.find(v => v != null);
  const pts = vals.map((v, i) => v == null ? null : [12 + i * 42, 100 - (Math.max(40, v) - 40) * 1.5]).filter(Boolean);
  const linea = pts.length ? "M" + pts.map(p => p.map(n => n.toFixed(0)).join(" ")).join(" L") : "";
  const area = pts.length > 1 ? `${linea} L${pts[pts.length - 1][0]} 104 L${pts[0][0]} 104 Z` : "";
  const conta = {};
  for (const s of tutte) for (const r of s.storico || []) conta[r.data] = (conta[r.data] || 0) + 1;
  const inizio = L.piu(lun, -17 * 7);
  let heat = "";
  for (let i = 0; i < 18 * 7; i++) {
    const d = L.piu(inizio, i), n = conta[d] || 0;
    heat += d > g ? `<i style="background:none;border:1px dashed var(--line)"></i>` : `<i style="${n ? `background:var(--pk);opacity:${Math.min(1, .2 + n * .14)}` : ""}" title="${d}: ${n}"></i>`;
  }
  return `<div class="halo"></div><div class="vista">
    <div class="testa"><h1 class="h1">Progressi</h1><button class="iconbtn" data-a="impostazioni" aria-label="Impostazioni">${ICO.ingranaggio}</button></div>
    <div class="card" style="padding:14px 16px;margin-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:15px;font-weight:600"><span style="color:var(--pktx)">${se.n} ${se.n === 1 ? "giorno" : "giorni"}</span> di fila</span><span class="mu" style="font-size:12px">record: ${se.record}</span></div>
      <div class="settimana">${settimana}</div>
    </div>
    <div class="stat3"><div class="card"><b>${tutte.length}</b><span>schede</span></div><div class="card"><b style="color:var(--pktx)">${solide}</b><span>solide</span></div><div class="card"><b>${ricordate == null ? "–" : ricordate + "%"}</b><span>ricordate</span></div></div>
    <div class="card" style="padding:14px 16px;margin-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:15px;font-weight:600">Forza della memoria</b><span style="font-size:13px;font-weight:600;color:var(--pktx)">${ultima != null ? ultima + "%" + (prima != null && ultima > prima ? " ↑" : "") : ""}</span></div>
      ${pts.length ? `<svg viewBox="0 0 320 110" style="display:block;width:100%;height:96px;margin-top:6px"><defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--pk);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--pk);stop-opacity:0"/></linearGradient></defs>
        <path d="M12 55H308M12 100H308" style="stroke:var(--line)" stroke-dasharray="3 4"/>${area ? `<path d="${area}" fill="url(#ar)"/>` : ""}<path d="${linea}" fill="none" style="stroke:var(--pk)" stroke-width="2" stroke-linejoin="round"/>
        ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1].toFixed(0)}" r="${i === pts.length - 1 ? 4 : 2.4}" style="fill:${i === pts.length - 1 ? "var(--pk)" : "var(--bg)"};stroke:var(--pk);stroke-width:1.5"/>`).join("")}</svg>
        <div class="mu" style="display:flex;justify-content:space-between;font-size:10px"><span>8 settimane fa</span><span>oggi</span></div>`
      : `<div class="vuoto" style="padding:14px">Comparirà dopo i primi ripassi.</div>`}
    </div>
    <div class="card" style="padding:14px 16px;margin-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:15px;font-weight:600">Ultimi 4 mesi</b><span class="mu" style="font-size:11px">un quadrato = un giorno</span></div>
      <div class="heat">${heat}</div>
    </div>
  </div>${barra()}`;
}

// =====================================================================
// SCHERMI A TUTTO SCHERMO
// =====================================================================
function schermoRipasso(st) {
  const s = scheda(st.coda[st.i]);
  if (!s) return "";
  const c = ctx(), C = c.cartelle;
  const prev = L.anteprimaVoti(s, c);
  const mats = (s.allegati || []).filter(a => !s.spiegazione || !a.spiegazione).filter(a => !a.spiegazione);
  const spieg = (s.allegati || []).find(a => a.spiegazione);
  const a = mats[st.all || 0];
  const n = (s.storico || []).length + 1;
  return `<div class="halo"></div><div class="rip">
    <div class="su"><button class="iconbtn" data-a="chiudiSchermo" aria-label="Chiudi ripasso">${ICO.x}</button>${assone(st.coda.length, st.i)}<span class="mu" style="font-size:12px">${st.i + 1}/${st.coda.length}</span></div>
    <div><div style="font-size:12px;color:var(--az)">${esc(percorso(s.cartella, C) || "Senza cartella")} · ${n}° ripasso</div>
      <h1>${esc(s.titolo || "Senza titolo")}</h1>${s.domande ? `<p class="dom">${esc(s.domande).replace(/\n/g, "<br>")}</p>` : ""}</div>
    <div class="mat ${st.arriva ? "arriva" : ""}" id="materiale">
      ${a ? materiale(s, a, st) : `<div class="vuoto">Nessun allegato: prova a ricordare tutto quello che sai su<br><b style="color:var(--tx)">${esc(s.titolo)}</b>${s.note ? `<br><br>${esc(s.note)}` : ""}</div>`}
      ${mats.length > 1 ? `<div class="pag">${mats.map((_, i) => `<i class="${i === (st.all || 0) ? "on" : ""}"></i>`).join("")}</div>` : ""}
      <div class="giu">
        ${spieg ? `<button class="capsula" data-a="suonaSpiegazione" data-s="${s.id}|${spieg.id}" style="flex:1"><span class="play">${ICO.play}</span>La tua spiegazione</button>`
          : `<button class="capsula" data-a="registra" data-per="spiegazione" data-id="${s.id}" style="flex:1"><span class="play" style="background:var(--pk)">${ICO.mic.replace('width="22" height="22"', 'width="15" height="15"')}</span>Spiegalo con parole tue</button>`}
        ${mats.length > 1 ? `<button class="iconbtn" data-a="pagina" data-d="1" aria-label="Allegato successivo">${ICO.ava}</button>` : ""}
        ${a && (a.tipo === "img" || a.tipo === "pdf") ? `<button class="iconbtn" data-a="zoom" data-s="${s.id}|${a.id}" aria-label="Schermo intero">${ICO.ingr}</button>` : ""}
      </div>
    </div>
    <div><div class="mu" style="font-size:12px;text-align:center;margin-bottom:8px">Quanto era solido il ricordo?</div>
    <div class="voti">${L.VOTI.map((v, i) => `<button class="voto v${v.v}" data-a="voto" data-v="${v.v}"><b>${v.nome.replace(" che ", "<br>che ").replace("Non ", "Non<br>")}</b><span>${L.breve(prev[i])}</span></button>`).join("")}</div></div>
  </div>`;
}
function materiale(s, a, st = {}) {
  const k = `${s.id}|${a.id}`;
  if (a.tipo === "img") {
    const sc = st.scoperte || {};
    const m = a.maschere || [];
    const restano = m.filter((_, i) => !sc[i]).length;
    return `${m.length ? `<span class="info">${restano ? `${restano} ${restano === 1 ? "parte nascosta" : "parti nascoste"} · tocca per scoprire` : "Tutto scoperto"}</span>` : `<span class="info">Tocca per ingrandire</span>`}
      <div class="fig" data-a="zoom" data-s="${k}"><img alt="${esc(a.nome)}" data-carica="${k}">${m.map((r, i) =>
        `<button class="masc ${sc[i] ? "via" : ""}" data-a="scopri" data-m="${i}" aria-label="Parte nascosta ${i + 1}" style="left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%"></button>`).join("")}</div>`;
  }
  if (a.tipo === "pdf") return `<span class="info">PDF · tocca per leggerlo e ingrandirlo</span><button data-a="zoom" data-s="${k}" style="border:0;background:none;padding:0;height:100%;width:100%;display:flex;align-items:center;justify-content:center"><img alt="${esc(a.nome)}" data-pdf="${k}" style="max-width:86%;max-height:42vh;box-shadow:var(--ombra);border-radius:4px;background:#fff"></button>`;
  if (a.tipo === "audio") return `<div style="width:100%;padding:20px"><div class="mu" style="font-size:13px;margin-bottom:10px">${esc(a.nome)}</div><audio controls preload="metadata" data-carica="${k}"></audio></div>`;
  if (a.tipo === "video") return `<video controls playsinline preload="metadata" data-carica="${k}" style="max-width:100%;max-height:100%"></video>`;
  return `<div class="vuoto">${ICO.file}<br>${esc(a.nome)}<br><button class="link" data-a="apriFile" data-s="${k}">Apri il file</button></div>`;
}

function schermoFesta() {
  const tutte = schede(), g = L.oggi(), p = prof();
  const oggiR = tutte.flatMap(s => (s.storico || []).filter(r => r.data === g).map(r => ({ ...r, s })));
  const min = Math.max(1, Math.round(oggiR.reduce((a, r) => a + (r.sec || 0), 0) / 60));
  const nuoveSolide = oggiR.filter(r => r.s >= 21 && ((r.s.storico || []).filter(x => x.data < g).pop()?.s || 0) < 21).length;
  const se = L.serie(tutte, attivi()).n;
  const domani = L.carico(tutte)[L.piu(g, 1)] || 0;
  const notif = P.statoNotifiche() === "attive" && p.notifiche !== false;
  return `<div class="halo" style="left:-40px;top:20px;width:520px;height:520px"></div><div class="vista" style="text-align:center;padding-bottom:40px">
    <div class="su"><span></span><button class="iconbtn" data-a="chiudiSchermo" aria-label="Chiudi">${ICO.x}</button></div>
    ${neurone(oggiR.length || 6, oggiR.length || 6, { tutto: true })}
    <div style="font-size:30px;font-weight:600;letter-spacing:-.8px;margin-top:4px">${oggiR.length > 1 ? `Tutti e ${oggiR.length}` : "Fatto"}<span style="color:var(--pk)">.</span></div>
    <div class="mu" style="font-size:14px;line-height:1.45;margin-top:8px">L'impulso è arrivato fino in fondo:<br>oggi le tue connessioni sono più forti.</div>
    <div class="stat3" style="margin-top:24px"><div class="card"><b style="color:var(--pktx)">${se}</b><span>giorni di fila</span></div><div class="card"><b>${min}'</b><span>di ripasso</span></div><div class="card"><b style="color:var(--az)">${nuoveSolide ? "+" + nuoveSolide : oggiR.length}</b><span>${nuoveSolide ? "schede solide" : "ripassi"}</span></div></div>
    <p class="mu" style="font-size:12px;margin:28px 0 10px">Domani: ${domani ? `${domani} ${domani === 1 ? "ripasso" : "ripassi"}` : "nessun ripasso"}${notif && domani ? ` · notifica alle ${p.oraMattina || "08:30"}` : ""}</p>
    <button class="btn" data-a="chiudiSchermo">A domani</button>
  </div>`;
}

function schermoDettaglio(st) {
  const s = scheda(st.id);
  if (!s) return `<div class="vista"><button class="iconbtn" data-a="chiudiSchermo">${ICO.ind}</button><div class="vuoto">Scheda eliminata.</div></div>`;
  const C = cartelle(), g = L.oggi();
  const cv = L.curva(s, g);
  const W = 300, H = 110, X = 12, Y = 10;
  const sx = d => X + d * (W - 2 * X) / cv.giorni, sy = r => Y + (1 - r) * (H - 2 * Y);
  const passati = cv.punti.filter(p => p[0] <= cv.oggi), futuri = cv.punti.filter(p => p[0] >= cv.oggi);
  const pth = ps => ps.length ? "M" + ps.map(p => `${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(" L") : "";
  const yOggi = futuri[0] ? sy(futuri[0][1]) : sy(1);
  const f = L.forza(s, g);
  const es = L.esameDi(s, ctx());
  const alleg = (s.allegati || []);
  const storico = [...(s.storico || [])].reverse().slice(0, 8);
  return `<div class="halo"></div><div class="vista">
    <div class="su"><button class="iconbtn" data-a="chiudiSchermo" aria-label="Indietro">${ICO.ind}</button><button class="iconbtn" data-a="modifica" data-id="${s.id}" aria-label="Modifica">${ICO.matita}</button></div>
    <div style="margin-top:12px"><div style="font-size:12px;color:var(--az)">${esc(percorso(s.cartella, C) || "Senza cartella")}</div>
      <h1 class="h1" style="margin-top:3px">${esc(s.titolo || "Senza titolo")}</h1>
      <div class="chips" style="margin-top:10px"><span class="chip">${nomeModo(s.modo)}</span>${(s.tag || []).map(t => `<span class="chip">#${esc(t)}</span>`).join("")}<span class="chip">${(s.storico || []).length} ripassi</span>${es ? `<span class="chip">esame ${L.giornoCorto(es.data)}</span>` : ""}</div></div>
    ${s.domande ? `<div class="card" style="padding:12px 14px;margin-top:12px;font-size:14px;line-height:1.4"><span class="mu" style="font-size:11px;display:block;margin-bottom:3px">Domande guida</span>${esc(s.domande).replace(/\n/g, "<br>")}</div>` : ""}
    <div style="display:flex;gap:8px;margin-top:12px">
      <div class="allegati" style="flex:1">${alleg.length ? alleg.map(a => `<button data-a="zoom" data-s="${s.id}|${a.id}" style="border:0;background:none;padding:0;position:relative">${miniaturaAll(s, a, "grande")}${a.spiegazione ? `<span class="badge" style="position:absolute;left:6px;bottom:6px">spiegazione</span>` : a.soloQui ? `<span class="badge az" style="position:absolute;left:6px;bottom:6px">solo qui</span>` : ""}</button>`).join("") : `<span class="mini grande">${ICO.file}</span>`}</div>
    </div>
    <div class="card" style="padding:12px 14px;margin-top:10px;display:flex;justify-content:space-between;align-items:center">
      <div><div class="mu" style="font-size:11px">Prossimo ripasso</div><div style="font-size:18px;font-weight:600;margin-top:2px">${s.prossimo ? L.giornoCorto(s.prossimo) : "–"}</div><div style="font-size:11px;color:var(--pktx);margin-top:2px">${s.prossimo ? L.quando(s.prossimo) : ""}</div></div>
      <button class="link" data-a="rimanda" data-id="${s.id}">Rimanda a domani</button>
    </div>
    <div class="card" style="padding:14px 16px;margin-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:15px;font-weight:600">Curva dell'oblio</b><span style="font-size:12px;font-weight:600;color:var(--pktx)">${f != null ? `ricordo al ${Math.round(f * 100)}%` : "ancora da ripassare"}</span></div>
      <svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:104px;margin-top:6px" role="img" aria-label="Curva dell'oblio: scende tra un ripasso e l'altro e risale a ogni ripasso">
        <path d="M${X} ${sy(.5)}H${W - X}" style="stroke:var(--line)" stroke-dasharray="3 4"/>
        <path d="${pth(passati)}" fill="none" style="stroke:var(--pk)" stroke-width="2" stroke-linejoin="round"/>
        <path d="${pth(futuri)}" fill="none" style="stroke:var(--dim)" stroke-width="1.6" stroke-dasharray="3 4"/>
        ${cv.tappe.map(t => `<circle cx="${sx(t).toFixed(1)}" cy="${sy(1).toFixed(1)}" r="3.5" style="fill:var(--pk)"/>`).join("")}
        <line x1="${sx(cv.oggi).toFixed(1)}" y1="${Y}" x2="${sx(cv.oggi).toFixed(1)}" y2="${H - Y}" style="stroke:var(--az)" stroke-width="1"/>
        <circle cx="${sx(cv.oggi).toFixed(1)}" cy="${yOggi.toFixed(1)}" r="4" style="fill:var(--az);animation:pulsa 1.6s infinite"/>
        ${s.prossimo && s.prossimo > g ? `<circle cx="${(W - X - 1).toFixed(1)}" cy="${sy(1)}" r="3.5" style="fill:none;stroke:var(--pk)" stroke-dasharray="2 2"/>` : ""}
      </svg>
      <div class="mu" style="display:flex;justify-content:space-between;font-size:10px"><span>studiata ${L.giornoCorto(cv.inizio)}</span><span style="color:var(--az)">oggi</span><span>${L.giornoCorto(cv.fine)}</span></div>
    </div>
    ${storico.length ? `<div class="card blocco" style="margin-top:10px">${storico.map(r => `<div class="voce" style="padding:10px 14px"><span style="font-size:13px">${L.giornoCorto(r.data)}</span><span class="badge ${r.voto >= 3 ? "az" : ""}">${L.VOTI[r.voto - 1].nome}</span></div>`).join("")}</div>` : ""}
    ${s.note ? `<div class="card" style="padding:12px 14px;margin-top:10px;font-size:14px;line-height:1.45">${esc(s.note).replace(/\n/g, "<br>")}</div>` : ""}
    <div style="display:flex;gap:8px;margin-top:16px"><button class="btn" data-a="ripassaOra" data-id="${s.id}">Ripassa ora</button></div>
    <button class="link rosso" data-a="eliminaScheda" data-id="${s.id}" style="display:block;margin:14px auto 0">Elimina la scheda</button>
  </div>`;
}
function miniaturaAll(s, a, cls = "") {
  if (a.tipo === "img") return `<span class="mini ${cls}" data-sfondo="${s.id}|${a.id}"></span>`;
  if (a.tipo === "pdf") return `<span class="mini ${cls}" data-pdfmini="${s.id}|${a.id}">${ICO.pdf}</span>`;
  return `<span class="mini ${cls}">${ICO[a.tipo] || ICO.file}</span>`;
}

function schermoCartella(st) {
  const C = cartelle(), c = C[st.id];
  if (!c) return `<div class="vista"><button class="iconbtn" data-a="chiudiSchermo">${ICO.ind}</button><div class="vuoto">Cartella eliminata.</div></div>`;
  const g = L.oggi(), tutte = schede().filter(s => s.cartella === c.id);
  const sub = figlie(c.id, C);
  const ordinate = [...tutte].sort((a, b) => (a.prossimo || "9").localeCompare(b.prossimo || "9"));
  const col = coloreDi(c.id, C);
  return `<div class="halo"></div><div class="vista">
    <div class="su"><button class="iconbtn" data-a="chiudiSchermo" aria-label="Indietro">${ICO.ind}</button><button class="iconbtn" data-a="modificaCartella" data-id="${c.id}" aria-label="Modifica cartella">${ICO.matita}</button></div>
    <div style="margin-top:12px">${c.padre ? `<div style="font-size:12px;color:var(--az)">${esc(percorso(c.padre, C))}</div>` : ""}
      <h1 class="h1" style="display:flex;align-items:center;gap:10px;margin-top:3px"><span class="punto" style="width:12px;height:12px;background:${col};color:${col}"></span>${esc(c.nome)}</h1>
      <div class="chips" style="margin-top:10px"><span class="chip">${nomeModo(c.modo)}</span>${c.esame ? `<span class="chip">esame ${L.giornoCorto(c.esame)}${c.esame >= g ? " · " + L.quando(c.esame) : ""}</span>` : ""}<span class="chip">${nSchede(tutte.length)}</span></div></div>
    ${sub.length ? `<div class="sez"><b>Sottocartelle</b></div><div class="lista">${sub.map(f => `<button class="riga card" data-a="apriCartella" data-id="${f.id}"><span class="punto" style="background:${coloreDi(f.id, C)};color:${coloreDi(f.id, C)}"></span><span class="corpo"><span class="tit" style="display:block">${esc(f.nome)}</span><span class="sot" style="display:block">${nSchede(schede().filter(s => discendenti(f.id, C).includes(s.cartella)).length)}</span></span>${ICO.ava}</button>`).join("")}</div>` : ""}
    <div class="sez"><b>Schede</b><button data-a="nuovaQui" data-id="${c.id}">+ nuova qui</button></div>
    ${ordinate.length ? `<div class="lista">${ordinate.map(s => rigaScheda(s, { C, badge: s.prossimo && s.prossimo <= g ? `<span class="badge">oggi</span>` : "" })).join("")}</div>` : `<div class="vuoto">Ancora nessuna scheda qui.<br><br><button class="btn" data-a="nuovaQui" data-id="${c.id}">Aggiungi la prima</button></div>`}
    <button class="link" data-a="nuovaCartella" data-padre="${c.id}" style="display:block;margin:16px auto 0">+ Nuova sottocartella</button>
  </div>`;
}

function schermoImpostazioni() {
  const p = prof(), S = sequenze(), stN = P.statoNotifiche(), g = L.oggi();
  const testoN = { "attive": "Attive su questo dispositivo", "da-attivare": "Non ancora attive", "bloccate": "Bloccate nelle impostazioni dell'iPhone", "serve-installazione": "Prima aggiungi l'app alla schermata Home (Safari › Condividi › Aggiungi alla schermata Home)", "non-supportate": "Questo browser non le supporta" }[stN];
  const vac = p.vacanza?.fino >= g;
  return `<div class="halo"></div><div class="vista">
    <div class="su"><button class="iconbtn" data-a="chiudiSchermo" aria-label="Indietro">${ICO.ind}</button><b style="font-size:17px">Impostazioni</b><span style="width:40px"></span></div>
    <div class="sez"><b>Notifiche</b></div>
    <div class="card blocco">
      <div class="voce"><span>Notifiche push<br><small>${esc(testoN)}</small></span>${stN === "da-attivare" ? `<button class="badge" data-a="attivaNotifiche" style="border:0">Attiva</button>` : ""}</div>
      <label class="interr"><span>Ricevi le notifiche</span><input type="checkbox" data-imp="notifiche" ${p.notifiche !== false ? "checked" : ""}></label>
      <div class="voce"><span>Ripassi del giorno<br><small>«Oggi hai 6 ripassi»</small></span><input type="time" value="${p.oraMattina || "08:30"}" data-imp="oraMattina"></div>
      <label class="interr"><span>Promemoria la sera<br><small class="mu" style="font-size:12px">solo se mancano dei ripassi</small></span><input type="checkbox" data-imp="sera" ${p.sera !== false ? "checked" : ""}></label>
      ${p.sera !== false ? `<div class="voce"><span>Ora del promemoria</span><input type="time" value="${p.oraSera || "21:00"}" data-imp="oraSera"></div>` : ""}
    </div>
    <div class="sez"><b>Ripassi</b></div>
    <div class="card blocco">
      <div class="voce"><span>Modalità per le nuove schede</span><select data-imp="modo">${opzioniModo(L.normaModo(p.modo || L.MODO_BASE), S)}</select></div>
      <div class="voce"><span>Tetto al giorno<br><small>oltre, passano a domani</small></span><select data-imp="tetto">${[0, 5, 10, 15, 20, 30, 40].map(n => `<option value="${n}" ${(p.tetto || 0) === n ? "selected" : ""}>${n ? n + " ripassi" : "Nessuno"}</option>`).join("")}</select></div>
      <div class="voce"><span>Ripassi minimi prima di un esame</span><select data-imp="minEsame">${[2, 3, 4, 5, 6].map(n => `<option ${(p.minEsame || 3) === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
    </div>
    <div class="sez"><b>Come ripassare</b></div>
    <div class="card blocco"><button class="voce" data-a="gestisci"><span>Sequenze e livelli Smart<br><small>${Object.keys(S).length} modalità · crea, modifica, elimina</small></span>${ICO.ava}</button></div>
    <p class="nota">Smart decide il tuo voto; le sequenze fisse hanno giorni stabiliti e, finita la sequenza, l'intervallo cresce secondo il voto (al massimo 2 anni).</p>
    <div class="sez"><b>Vacanza</b></div>
    <div class="card blocco"><button class="voce" data-a="${vac ? "fineVacanza" : "vacanza"}"><span>${vac ? `In vacanza fino a ${L.giornoLungo(p.vacanza.fino)}` : "Metti in pausa i ripassi"}<br><small>${vac ? "Tocca per tornare adesso" : "Tutte le date slittano, niente notifiche"}</small></span>${ICO.ava}</button></div>
    <div class="sez"><b>Account</b></div>
    <div class="card blocco">
      <div class="voce"><span>${D.PROVA ? "Modalità prova (dati solo su questo dispositivo)" : esc(D.chiSei()?.email || "")}</span></div>
      ${F.inCoda() ? `<div class="voce"><span>File in attesa di caricamento<br><small>partono appena c'è rete</small></span><span class="badge az">${F.inCoda()}</span></div>` : ""}
      ${D.PROVA ? `<button class="voce rosso" data-a="ricominciaProva"><span>Ricomincia la prova</span></button>` : `<button class="voce rosso" data-a="esci"><span>Esci</span></button>`}
    </div>
    <p class="nota" style="text-align:center;margin-top:18px">Recordatio · versione 1 · ${new Date().getFullYear()}</p>
  </div>`;
}
function opzioniModo(scelto, S = sequenze()) {
  scelto = L.normaModo(scelto);
  const o = ([id, s]) => `<option value="seq:${id}" ${scelto === "seq:" + id ? "selected" : ""}>${esc(s.nome)}${s.smart ? "" : ` (${s.giorni.join("-")})`}</option>`;
  const gr = (nome, el) => el.length ? `<optgroup label="${nome}">${el.map(o).join("")}</optgroup>` : "";
  const E = Object.entries(S);
  return gr("Smart", E.filter(([, s]) => s.predef && s.smart)) + gr("Sequenze fisse", E.filter(([, s]) => s.predef && !s.smart)) + gr("Le mie", E.filter(([, s]) => !s.predef));
}

// ---------- asse dei giorni in scala vera (0 = oggi) ----------
const etichettaGiorni = d => {
  if (d === 0) return "oggi";
  if (d < 60) return d + " g";
  const anni = d / 365;
  if (Math.abs(anni - Math.round(anni)) < .01) return Math.round(anni) === 1 ? "1 anno" : Math.round(anni) + " anni";
  return Math.round(d / 30.42) + " mesi";
};
/** punti = [{giorno, dopo}] da L.previsione; dopo = oltre la fine della sequenza (diventa una freccia) */
function asseGiorni(punti, { smart = false, esame = null } = {}) {
  const W = 300, H = 30, x0 = 7, x1 = W - 7, y = 10;
  const gg = punti.filter(p => !p.dopo).map(p => p.giorno), seguito = punti.some(p => p.dopo);
  const fine = Math.max(1, gg.at(-1) || 1, esame ?? 0);
  const passo = [1, 2, 3, 5, 7, 10, 14, 30, 60, 91.25, 182.5, 365, 730].find(x => fine / x <= 5) || 730;
  const max = Math.max(passo, Math.ceil(fine * 1.06 / passo) * passo);
  const X = d => +(x0 + d / max * (x1 - x0)).toFixed(1);
  let h = `<line class="base" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`;
  for (let d = 0; d <= max + .01; d += passo) {
    if (esame != null && Math.abs(X(d) - X(esame)) < 24) continue;
    const an = d === 0 ? "start" : d >= max ? "end" : "middle", dx = d === 0 ? -4 : d >= max ? 4 : 0;
    h += `<line class="tick" x1="${X(d)}" y1="${y + 4}" x2="${X(d)}" y2="${y + 7}"/><text x="${X(d) + dx}" y="${y + 17}" text-anchor="${an}">${etichettaGiorni(Math.round(d))}</text>`;
  }
  if (esame != null) h += `<line class="es-linea" x1="${X(esame)}" y1="1" x2="${X(esame)}" y2="${y + 6}"/><rect class="es-rombo" x="${X(esame) - 3}" y="-2" width="6" height="6" transform="rotate(45 ${X(esame)} 1)"/><text class="es-t" x="${X(esame)}" y="${y + 17}" text-anchor="middle">esame</text>`;
  h += `<circle class="oggi-anello" cx="${X(0)}" cy="${y}" r="6.5"/>`;
  if (!gg.includes(0)) h += `<circle class="oggi" cx="${X(0)}" cy="${y}" r="4"/>`;
  if (seguito && gg.length) h += `<line class="seguito" x1="${X(gg.at(-1)) + 6}" y1="${y}" x2="${x1 + 3}" y2="${y}" stroke-dasharray="2 2.5"/><path class="seguito" d="M${x1} ${y - 3} l3 3 -3 3"/>`;
  h += gg.map(d => `<circle class="m ${smart ? "s" : "f"}" cx="${X(d)}" cy="${y}" r="3.4"/>`).join("");
  return `<svg class="ax" viewBox="0 0 ${W} ${H}" aria-hidden="true">${h}</svg>`;
}
/** i prossimi ripassi di una scheda (vera o di prova) con una certa sequenza, anche non ancora salvata */
function puntiDi(base, seqObj, quanti, c = ctx(), voto = 3) {
  const c2 = { ...c, sequenze: { ...c.sequenze, __prova: seqObj } };
  return L.previsione({ ...base, modo: "seq:__prova", storico: [], prossimo: null, fsrs: null, ultimo: null }, c2, quanti, L.oggi(), voto);
}
const quantiPunti = seq => seq.smart ? 6 : seq.giorni.length + 1;
const ogniQuanto = t => t >= 365 ? (t === 365 ? "1 anno" : Math.round(t / 365 * 10) / 10 + " anni") : L.durata(t);
const sottoSeq = s => s.smart ? `ricordo ${Math.round(s.R * 100)}% · al massimo ogni ${ogniQuanto(s.tetto)}` : s.giorni.join(" · ");
/** una voce del menù (scelta) o di Gestisci (gestisci = true) */
function voceSeq(id, s, { base, scelto, gestisci, esame, c, conta } = {}) {
  const on = !gestisci && scelto === "seq:" + id;
  const destra = gestisci ? `<span class="conta">${nSchede(conta || 0)} ›</span>` : `<span class="g">${s.smart ? Math.round(s.R * 100) + "%" : s.giorni.join(" · ")}</span>`;
  const etich = gestisci ? (s.predef ? `<span class="etich">${s.modificata ? "modificata" : "predefinita"}</span>` : `<span class="etich rosa">tua</span>`) : "";
  return `<button class="op ${on ? "on" : ""}" data-a="${gestisci ? "modificaSequenza" : "sceltaModo"}" data-id="${id}">
    <div class="r1"><span class="n">${esc(s.nome)}${on ? `<span class="spunta">✓</span>` : ""}${etich}</span>${destra}</div>
    <div class="d">${gestisci ? sottoSeq(s) : esc(s.desc || (s.smart ? "decide il tuo voto" : ""))}</div>
    ${asseGiorni(puntiDi(base, s, quantiPunti(s), c), { smart: s.smart, esame })}</button>`;
}
function gruppiSeq(S, voce) {
  const E = Object.entries(S);
  const g = (titolo, nota, el) => el.length ? `<div class="gruppo">${titolo}${nota ? `<em>${nota}</em>` : ""}</div><div class="opz">${el.map(([id, s]) => voce(id, s)).join("")}</div>` : "";
  return g("Smart", "decide il tuo voto", E.filter(([, s]) => s.predef && s.smart)) +
    g("Sequenze fisse", "giorni dalla data di studio", E.filter(([, s]) => s.predef && !s.smart)) +
    g("Le mie", "", E.filter(([, s]) => !s.predef));
}

// =====================================================================
// FOGLI DAL BASSO
// =====================================================================
function foglio() {
  const f = U.foglio;
  if (!f) return "";
  let dentro = "";
  if (f.tipo === "scheda") dentro = foglioScheda();
  else if (f.tipo === "cartella") dentro = foglioCartella(f);
  else if (f.tipo === "sequenza") dentro = foglioSequenza(f);
  else if (f.tipo === "modi") dentro = foglioModi();
  else if (f.tipo === "gestisci") dentro = foglioGestisci();
  else if (f.tipo === "registra") dentro = foglioRegistra(f);
  else if (f.tipo === "vacanza") dentro = `<div class="tt"><b>Vacanza</b><button class="link" data-a="chiudiFoglio">Annulla</button></div>
    <p class="mu" style="margin:0;font-size:14px;line-height:1.45">Per quanti giorni metti in pausa? Tutti i ripassi slittano in avanti e non arrivano notifiche.</p>
    <div class="chips">${[3, 7, 10, 14, 21, 30].map(n => `<button class="chip" data-a="iniziaVacanza" data-n="${n}">${n} giorni</button>`).join("")}</div>`;
  else if (f.tipo === "conferma") dentro = `<div class="tt"><b>${esc(f.titolo)}</b></div><p class="mu" style="margin:0;font-size:14px;line-height:1.45">${esc(f.testo)}</p>
    <button class="btn" style="background:#D2475B;color:#fff" data-a="confermaSi">${esc(f.ok || "Conferma")}</button><button class="btn chiaro" data-a="chiudiFoglio">Annulla</button>`;
  return `<div class="velo" data-a="chiudiFoglio"></div><div class="foglio" role="dialog" aria-modal="true"><span class="maniglia"></span>${dentro}</div>`;
}

function foglioScheda() {
  const b = U.bozza, S = sequenze(), C = cartelle(), g = L.oggi();
  const opz = (id, liv) => figlie(id, C).map(c => `<option value="${c.id}" ${b.cartella === c.id ? "selected" : ""}>${"  ".repeat(liv)}${liv ? "› " : ""}${esc(c.nome)}</option>` + opz(c.id, liv + 1)).join("");
  // anteprima delle date (stessi calcoli dell'app, esame della cartella compreso)
  const c = ctx(), prova = L.inizializza({ ...b, storico: [] }, c, g);
  const seq = S[L.normaModo(b.modo).slice(4)] || S.solido;
  const punti = puntiDi(b, seq, quantiPunti(seq), c);
  const es = L.esameDi(b, c, g), esG = es ? L.tra(g, es.data) : null;
  const chip = punti.filter(p => !p.dopo).slice(0, 8).map(p => ({ g: p.giorno, h: `<span class="${seq.smart ? "az" : ""}">${p.giorno === 0 ? "oggi" : p.giorno === 1 ? "domani" : L.giornoCorto(p.data)}</span>` }));
  if (es) chip.push({ g: esG - .5, h: `<span class="es">esame ${L.giornoCorto(es.data)}</span>` });
  const spiega = (seq.smart ? `Decide il tuo voto (ricordo ${Math.round(seq.R * 100)}%). Esempio se rispondi sempre «Più sì che no».` : `${L.maiuscola(seq.desc || "Giorni fissi")}. Dopo l'ultimo giorno continua secondo il voto.`)
    + (es ? " Con l'esame i ripassi si stringono: l'ultimo cade il giorno prima." : "");
  const passati = b.inizio && b.inizio < g && prova.prossimo === g && !b.id_esistente;
  return `<div class="tt"><b>${b.esistente ? "Modifica scheda" : "Nuova scheda"}</b><button class="link" data-a="chiudiFoglio" style="color:var(--mu)">Annulla</button></div>
    <div class="fonti">
      <label class="fonte">${ICO.foto}Scatta<input type="file" accept="image/*" capture="environment" data-file="1"></label>
      <label class="fonte">${ICO.galleria}Foto o file<input type="file" multiple data-file="1"></label>
      <button class="fonte" data-a="registra" data-per="bozza">${ICO.mic}Audio</button>
    </div>
    ${b.allegati.length || b.caricando ? `<div class="allegati">${b.allegati.map((a, i) => `<span style="position:relative;flex-shrink:0">${miniaturaAll({ id: b.id }, a)}<button class="togli" data-a="togliAllegato" data-i="${i}" aria-label="Togli ${esc(a.nome)}">×</button></span>`).join("")}
      ${b.caricando ? `<span class="mini" style="width:58px;height:58px"><span class="mu" style="font-size:10px">…</span></span>` : ""}
      <span class="mu" style="font-size:12px;align-self:center;margin-left:4px;white-space:nowrap">${b.allegati.length} ${b.allegati.length === 1 ? "allegato" : "allegati"}</span></div>` : ""}
    ${b.allegati.some(a => a.tipo === "img") ? `<button class="link" data-a="maschereBozza" style="padding:0;text-align:left">${ICO.maschera.replace('width="18"', 'width="15"').replace('height="18"', 'height="15"')} Nascondi delle parti dell'immagine (maschere)</button>` : ""}
    <label class="campo"><span>Titolo${b.allegati.length ? " (anche dopo)" : ""}</span><input value="${esc(b.titolo)}" data-bz="titolo" placeholder="Es. Legge di Gauss" enterkeyhint="done"></label>
    <div class="due">
      <label class="campo"><span>Cartella</span><select data-bz="cartella"><option value="">Senza cartella</option>${opz(null, 0)}</select></label>
      <label class="campo"><span>Studiata il</span><input type="date" value="${b.inizio}" max="${g}" data-bz="inizio"></label>
    </div>
    ${passati ? `<div class="avviso">Il primo ripasso è già passato: lo trovi in «Oggi». I successivi restano agganciati al ${L.giornoCorto(b.inizio)}.</div>` : ""}
    <div><button class="campo scelta" data-a="scegliModo"><span class="corpo"><span>Come ripassare</span><span class="nome">${esc(seq.nome)}</span></span>${ICO.giu}</button>
      <div class="nota">${spiega}</div>
      <div class="prev-date">${chip.sort((x, y) => x.g - y.g).map(x => x.h).join("")}</div>
      ${asseGiorni(punti, { smart: seq.smart, esame: esG })}</div>
    <label class="campo"><span>Domande guida (facoltative)</span><textarea rows="2" data-bz="domande" placeholder="Es. Quali sono le 4 leggi del cambiamento?">${esc(b.domande)}</textarea></label>
    <div class="due"><label class="campo"><span>Etichette</span><input value="${esc((b.tag || []).join(" "))}" data-bz="tag" placeholder="formule definizioni"></label></div>
    <button class="btn rosa" data-a="salvaBozza" ${b.caricando ? "disabled" : ""}>${b.esistente ? "Salva le modifiche" : "Salva scheda"}</button>`;
}

function foglioCartella(f) {
  const C = cartelle(), c = f.bozza, S = sequenze();
  const opz = (id, liv) => figlie(id, C).filter(x => x.id !== c.id).map(x => `<option value="${x.id}" ${c.padre === x.id ? "selected" : ""}>${"  ".repeat(liv)}${liv ? "› " : ""}${esc(x.nome)}</option>` + opz(x.id, liv + 1)).join("");
  return `<div class="tt"><b>${f.nuova ? "Nuova cartella" : "Modifica cartella"}</b><button class="link" data-a="chiudiFoglio" style="color:var(--mu)">Annulla</button></div>
    <label class="campo"><span>Nome</span><input value="${esc(c.nome)}" data-cb="nome" placeholder="Es. Fisica 2" enterkeyhint="done"></label>
    <div><div class="lab">Colore</div><div class="colori">${L.COLORI.map(k => `<button class="${c.colore === k ? "on" : ""}" style="background:${k}" data-a="coloreCart" data-c="${k}" aria-label="Colore ${k}"></button>`).join("")}</div></div>
    <label class="campo"><span>Dentro a</span><select data-cb="padre"><option value="">Nessuna (cartella principale)</option>${opz(null, 0)}</select></label>
    <label class="campo"><span>Modalità per le sue schede</span><select data-cb="modo">${opzioniModo(c.modo || prof().modo || L.MODO_BASE, S)}</select></label>
    <div class="due"><label class="campo"><span>Data dell'esame (facoltativa)</span><input type="date" value="${c.esame || ""}" data-cb="esame"></label>
      <label class="campo" style="flex:.6"><span>Ripassi minimi</span><select data-cb="minRipassi">${[2, 3, 4, 5, 6].map(n => `<option ${(c.minRipassi || prof().minEsame || 3) === n ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
    <p class="nota" style="margin:-6px 0 0">Con la data dell'esame gli intervalli si stringono: ogni scheda arriva all'esame ripassata almeno quel numero di volte, l'ultima il giorno prima.</p>
    <button class="btn rosa" data-a="salvaCartella">Salva cartella</button>
    ${f.nuova ? "" : `<button class="link rosso" data-a="eliminaCartella" style="align-self:center">Elimina la cartella</button>`}`;
}

function foglioModi() {
  const b = U.bozza, S = sequenze(), c = ctx(), g = L.oggi();
  const es = L.esameDi(b, c, g), esame = es ? L.tra(g, es.data) : null, scelto = L.normaModo(b.modo);
  return `<div class="tt"><b>Come ripassare</b><button class="link" data-a="chiudiFoglio" style="color:var(--mu)">Annulla</button></div>
    <div class="legenda"><span><i class="l-oggi"></i>oggi</span><span><i class="l-f"></i>giorno fisso</span><span><i class="l-s"></i>decide il voto</span>${es ? `<span><i class="l-es"></i>esame ${L.giornoCorto(es.data)}</span>` : ""}</div>
    ${gruppiSeq(S, (id, s) => voceSeq(id, s, { base: b, scelto, esame, c }))}
    <button class="nuova" data-a="gestisci">+ Crea o gestisci…</button>`;
}
function foglioGestisci() {
  const S = sequenze(), c = ctx(), tutte = schede();
  const quante = id => tutte.filter(s => !s.archiviata && L.normaModo(s.modo) === "seq:" + id).length;
  const base = { inizio: L.oggi(), cartella: null };
  return `<div class="tt"><b>Sequenze</b><button class="link" data-a="chiudiFoglio" style="color:var(--mu)">Fatto</button></div>
    <div class="due"><button class="btn chiaro" data-a="nuovaSequenza" data-t="fissa" style="min-height:46px;font-size:14px">+ Fissa</button><button class="btn chiaro" data-a="nuovaSequenza" data-t="smart" style="min-height:46px;font-size:14px">+ Smart</button></div>
    ${gruppiSeq(S, (id, s) => voceSeq(id, s, { base, gestisci: true, c, conta: quante(id) }))}
    <p class="nota" style="margin:0">Tocca una riga per modificarla. Le predefinite hanno «Ripristina» per tornare ai valori di partenza; se elimini una tua sequenza, le sue schede passano a Smart 2.</p>`;
}
function esempiSmart(b) {
  const base = { inizio: L.oggi(), cartella: null }, c = ctx();
  const a = puntiDi(base, b, 7, c, 3), p = puntiDi(base, b, 7, c, 4);
  return `<span class="k">se rispondi sempre «Più sì che no»</span>${a.map(x => x.giorno).join(" · ")}${asseGiorni(a, { smart: true })}
    <span class="k">se rispondi sempre «Perfetto»</span>${p.map(x => x.giorno).join(" · ")}${asseGiorni(p, { smart: true })}`;
}
function foglioSequenza(f) {
  const s = f.bozza;
  const titolo = f.nuova ? (s.smart ? "Nuovo Smart" : "Nuova sequenza") : esc(s.nome || "Sequenza");
  const tetti = [30, 60, 90, 180, 365, 730];
  return `<div class="tt"><b>${titolo}</b><button class="link" data-a="chiudiFoglio" style="color:var(--mu)">Annulla</button></div>
    <div class="seg3"><button class="${s.smart ? "" : "on"}" data-a="tipoSeq" data-s="0">Giorni fissi</button><button class="${s.smart ? "on" : ""}" data-a="tipoSeq" data-s="1">Smart</button></div>
    <label class="campo"><span>Nome</span><input value="${esc(s.nome)}" data-sq="nome" placeholder="${s.smart ? "Es. Smart · Anatomia" : "Es. Esame veloce"}" enterkeyhint="done"></label>
    <label class="campo"><span>A cosa serve (facoltativo)</span><input value="${esc(s.desc || "")}" data-sq="desc" placeholder="Es. esame tra 10 giorni" enterkeyhint="done"></label>
    ${s.smart ? `<div class="riquadro">
        <div class="cursore"><span class="t">Quanto vuoi ricordare</span><b id="rVal">${Math.round(s.R * 100)}%</b></div>
        <input type="range" class="ritenzione" min="85" max="97" step="1" value="${Math.round(s.R * 100)}" data-sq="R" aria-label="Quanto vuoi ricordare">
        <div class="estremi"><span>85 · ripassi radi</span><span>97 · ripassi fitti</span></div></div>
      <label class="campo"><span>Al massimo torna ogni</span><select data-sq="tetto">${tetti.map(t => `<option value="${t}" ${s.tetto === t ? "selected" : ""}>${ogniQuanto(t)}</option>`).join("")}</select></label>
      <div class="riquadro"><div class="t">Esempio (giorni dopo lo studio)</div><div class="esempi" id="esSmart">${esempiSmart(s)}</div></div>`
    : `<div class="campo"><span>Giorni dopo lo studio · 0 = la sera stessa</span>
        <div class="gchips">${s.giorni.map((d, i) => `<span class="gchip">${d}<button data-a="togliGiorno" data-i="${i}" aria-label="Togli il giorno ${d}">✕</button></span>`).join("")}
        <input class="gchip-in" type="number" min="0" max="3650" inputmode="numeric" placeholder="+ giorno" data-sq="nuovoGiorno" enterkeyhint="done"></div></div>
      <div class="riquadro"><div class="t">Come cade nel tempo</div>${s.giorni.length ? asseGiorni(puntiDi({ inizio: L.oggi(), cartella: null }, s, s.giorni.length + 1)) : ""}
        <div class="nota" style="margin-top:8px">Dopo l'ultimo giorno continua secondo il voto (Perfetto ×2,5 · Più sì ×2 · Più no ×1,2), al massimo ogni 2 anni. «Non ricordavo»: torna domani, poi 2 passi indietro.</div></div>`}
    <button class="btn rosa" data-a="salvaSequenza">Salva</button>
    ${!f.nuova && (s.predef ? s.modificata : true) ? `<div style="display:flex;justify-content:${s.predef ? "center" : "center"}">${s.predef ? `<button class="link" data-a="ripristinaSequenza">Ripristina i valori di partenza</button>` : `<button class="link rosso" data-a="eliminaSequenza">Elimina la sequenza</button>`}</div>` : ""}`;
}

function foglioRegistra(f) {
  const sec = f.inizio ? Math.floor((Date.now() - f.inizio) / 1000) : (f.durata || 0);
  const mm = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  return `<div class="tt"><b>${f.per === "spiegazione" ? "Spiegalo con parole tue" : "Registra un audio"}</b><button class="link" data-a="chiudiFoglio" style="color:var(--mu)">Annulla</button></div>
    ${f.per === "spiegazione" ? `<p class="mu" style="margin:0;font-size:13px;line-height:1.45">Spiega l'argomento come a un bambino (tecnica Feynman): la prossima volta riascolti la tua voce.</p>` : ""}
    <div class="reg"><div class="tempo" id="tempoReg">${mm}</div>
      ${f.blob ? `<audio controls src="${f.url}"></audio><div class="due" style="width:100%"><button class="btn chiaro" data-a="rifaiReg">Rifai</button><button class="btn rosa" data-a="usaReg">Usa questo</button></div>`
        : `<button class="rec ${f.inizio ? "on" : ""}" data-a="${f.inizio ? "fermaReg" : "avviaReg"}" aria-label="${f.inizio ? "Ferma" : "Registra"}">${f.inizio ? `<span style="width:24px;height:24px;border-radius:5px;background:#fff"></span>` : `<span style="width:26px;height:26px;border-radius:13px;background:#fff"></span>`}</button>
        <span class="mu" style="font-size:13px">${f.inizio ? "Sto registrando… tocca per fermare" : "Tocca per iniziare"}</span>`}
      ${f.errore ? `<span class="errore">${esc(f.errore)}</span>` : ""}
    </div>`;
}

// =====================================================================
// DISEGNO
// =====================================================================
function render() {
  const sc = schermo();
  const scrollFoglio = $(".foglio")?.scrollTop || 0;
  let html;
  if (sc) {
    const corpo = sc.tipo === "ripasso" ? schermoRipasso(sc) : sc.tipo === "festa" ? schermoFesta() : sc.tipo === "dettaglio" ? schermoDettaglio(sc)
      : sc.tipo === "cartella" ? schermoCartella(sc) : sc.tipo === "impostazioni" ? schermoImpostazioni() : "";
    html = `<div class="schermo" id="schermo">${corpo}</div>`;
  } else {
    html = U.vista === "cartelle" ? vistaCartelle() : U.vista === "calendario" ? vistaCalendario() : U.vista === "progressi" ? vistaProgressi() : vistaOggi();
  }
  app.innerHTML = html + foglio();
  if (scrollFoglio && $(".foglio")) $(".foglio").scrollTop = scrollFoglio;
  if (sc?.tipo === "ripasso") sc.arriva = false;
  idrata();
  dopoDisegno();
  bloccaSfondo();
}
/** quando è aperto un foglio, uno schermo o il visore, la pagina sotto resta FERMA (iPhone la faceva scorrere lo stesso) */
let fermoA = null;
function bloccaSfondo() {
  const serve = !!(U.foglio || schermo() || $(".visore"));
  const b = document.body;
  if (serve && fermoA === null) {
    fermoA = scrollY;
    Object.assign(b.style, { position: "fixed", top: -fermoA + "px", left: "0", right: "0", overflow: "hidden" });
  } else if (!serve && fermoA !== null) {
    const y = fermoA; fermoA = null;
    Object.assign(b.style, { position: "", top: "", left: "", right: "", overflow: "" });
    scrollTo(0, y);
  }
}
/** carica le immagini/PDF/audio dopo aver disegnato (sono nel telefono o nell'archivio online) */
function trova(k) {
  const [sid, aid] = k.split("|");
  const s = sid === U.bozza?.id ? U.bozza : scheda(sid);
  return (s?.allegati || []).find(a => a.id === aid);
}
function idrata() {
  for (const el of $$("[data-carica]")) { const a = trova(el.dataset.carica); if (a) F.url(a).then(u => { if (u) el.src = u; }).catch(e => mostra(e.message)); }
  for (const el of $$("[data-sfondo]")) { const a = trova(el.dataset.sfondo); if (a) F.url(a).then(u => { if (u) el.style.backgroundImage = `url("${u}")`; }).catch(() => { }); }
  for (const el of $$("[data-pdfmini]")) { const a = trova(el.dataset.pdfmini); if (a) F.miniaturaPdf(a).then(u => { el.innerHTML = ""; el.style.backgroundImage = `url("${u}")`; el.style.backgroundColor = "#fff"; }).catch(() => { }); }
  for (const el of $$("[data-pdf]")) { const a = trova(el.dataset.pdf); if (a) F.miniaturaPdf(a, 420).then(u => { el.src = u; }).catch(e => mostra(e.message)); }
}
let badgeUltimo = -1;
function dopoDisegno() {
  const tutte = schede(), g = L.oggi();
  const n = L.daFare(tutte, g).length;
  if (n !== badgeUltimo && "setAppBadge" in navigator) { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => { }); badgeUltimo = n; }
  if (tutte.length && !n && !D.leggi("att:" + g) && !ripassiOggi(tutte)) D.scrivi("att:" + g, true);   // giornata senza ripassi: la serie non si spezza
}
let toastT;
function mostra(testo) {
  $(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = testo;
  document.body.append(t);
  clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2800);
}
let avvisiT;
function aggiornaAvvisi() { clearTimeout(avvisiT); avvisiT = setTimeout(() => P.programmaAvvisi(L.avvisi(schede(), prof())).catch(() => { }), 1500); }
function caricaFile() {
  F.caricaInAttesa((sid, aid, percorso) => {
    const s = scheda(sid);
    if (!s) return;
    s.allegati = (s.allegati || []).map(a => a.id === aid ? { ...a, percorso, caricato: true } : a);
    salvaScheda(s);
  });
}
const apriSchermo = s => { U.schermi.push(s); render(); $("#schermo")?.scrollTo(0, 0); };

// =====================================================================
// AZIONI
// =====================================================================
const AZ = {
  vai: ({ v }) => { U.vista = v; U.schermi = []; render(); scrollTo(0, 0); },
  nuova: () => apriBozza({ cartella: U.schermi.findLast?.(s => s.tipo === "cartella")?.id || null }),
  nuovaQui: ({ id }) => apriBozza({ cartella: id }),
  apriScheda: ({ id }) => apriSchermo({ tipo: "dettaglio", id }),
  apriCartella: ({ id }) => apriSchermo({ tipo: "cartella", id }),
  espandi: ({ id }) => { U.aperte.has(id) ? U.aperte.delete(id) : U.aperte.add(id); render(); },
  tag: ({ t }) => { U.tag = t || null; render(); },
  impostazioni: () => apriSchermo({ tipo: "impostazioni" }),
  chiudiSchermo: () => { U.schermi.pop(); render(); },
  festa: () => apriSchermo({ tipo: "festa" }),
  mese: ({ d }) => {
    const [a, m] = (U.mese || L.oggi().slice(0, 7)).split("-").map(Number);
    const n = new Date(a, m - 1 + Number(d), 1);
    U.mese = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
    render();
  },
  giorno: ({ d }) => { U.giorno = d; render(); },

  // ripasso
  iniziaRipasso: () => {
    const p = prof(), dov = L.daFare(schede());
    const coda = (p.tetto ? dov.slice(0, p.tetto) : dov).map(s => s.id);
    if (!coda.length) return;
    apriSchermo({ tipo: "ripasso", coda, i: 0, t0: Date.now(), scoperte: {}, all: 0 });
  },
  ripassaOra: ({ id }) => apriSchermo({ tipo: "ripasso", coda: [id], i: 0, t0: Date.now(), scoperte: {}, all: 0, singola: true }),
  scopri: ({ m }, el, e) => { e.stopPropagation(); const st = schermo(); st.scoperte[m] = true; el.classList.add("via"); aggiornaInfoMaschere(); },
  pagina: ({ d }) => { const st = schermo(), s = scheda(st.coda[st.i]); const n = (s.allegati || []).filter(a => !a.spiegazione).length; st.all = ((st.all || 0) + Number(d) + n) % n; st.scoperte = {}; render(); },
  voto: async ({ v }) => {
    const st = schermo();
    if (st.bloccato) return;
    st.bloccato = true;
    const s = scheda(st.coda[st.i]);
    const nuova = L.dopoVoto(s, Number(v), ctx(), L.oggi(), (Date.now() - st.t0) / 1000);
    salvaScheda(nuova);
    $("#materiale")?.classList.add("volo");
    await aspetta(380);
    st.i++; st.scoperte = {}; st.all = 0; st.t0 = Date.now(); st.arriva = true; st.bloccato = false;
    aggiornaAvvisi();
    if (st.i >= st.coda.length) {
      U.schermi.pop();
      if (st.singola) { render(); mostra(`Prossimo ripasso: ${L.quando(nuova.prossimo)}`); }
      else if (!L.daFare(schede()).length) apriSchermo({ tipo: "festa" });
      else render();
    } else render();
  },
  suonaSpiegazione: async ({ s }, el) => {
    const a = trova(s); if (!a) return;
    let au = document.getElementById("audioSpieg");
    if (!au) { au = document.createElement("audio"); au.id = "audioSpieg"; document.body.append(au); }
    if (!au.paused && au.dataset.k === s) { au.pause(); el.querySelector(".play").innerHTML = ICO.play; return; }
    au.src = await F.url(a); au.dataset.k = s; au.play();
    el.querySelector(".play").innerHTML = ICO.pausa;
    au.onended = () => { const p = el.querySelector(".play"); if (p) p.innerHTML = ICO.play; };
  },
  zoom: ({ s }, el, e) => { if (e.target.closest(".masc")) return; apriVisore(s); },
  apriFile: async ({ s }) => { const a = trova(s); const u = a && await F.url(a); if (u) open(u, "_blank"); },
  rimanda: ({ id }) => { const s = scheda(id); salvaScheda(L.rimanda(s, 1)); aggiornaAvvisi(); render(); mostra("Spostata a domani"); },
  eliminaScheda: ({ id }) => chiedi("Eliminare la scheda?", "Spariscono anche i suoi allegati e il suo storico.", "Elimina", async () => {
    const s = scheda(id);
    for (const a of s?.allegati || []) F.elimina(a);
    D.scrivi("sch:" + id, null);
    U.schermi = U.schermi.filter(x => x.id !== id);
    aggiornaAvvisi(); render(); mostra("Scheda eliminata");
  }),
  modifica: ({ id }) => { const s = scheda(id); apriBozza({ ...s, esistente: true }); },

  // fogli
  chiudiFoglio: () => {
    const torna = U.foglio?.tipo === "registra" && U.foglio.ritorno === "scheda" && U.bozza;
    fermaRegistrazione(true);
    if (U.foglio?.url) URL.revokeObjectURL(U.foglio.url);
    const ritorno = U.foglio?.ritorno && typeof U.foglio.ritorno === "object" ? U.foglio.ritorno : null;
    U.foglio = torna ? { tipo: "scheda" } : ritorno; render();
  },
  confermaSi: async () => { const f = U.foglio; U.foglio = null; await f.azione(); },
  scegliModo: () => { U.foglio = { tipo: "modi", ritorno: { tipo: "scheda" } }; render(); },
  sceltaModo: ({ id }) => { U.bozza.modo = "seq:" + id; U.foglio = { tipo: "scheda" }; render(); },
  gestisci: () => { U.foglio = { tipo: "gestisci", ritorno: U.foglio?.tipo === "modi" ? U.foglio : null }; render(); },
  togliAllegato: ({ i }) => { const a = U.bozza.allegati.splice(Number(i), 1)[0]; if (a && !U.bozza.originali?.includes(a.id)) F.elimina(a); render(); },
  maschereBozza: () => { const a = U.bozza.allegati.find(x => x.tipo === "img"); if (a) apriVisore(`${U.bozza.id}|${a.id}`, { modifica: true }); },
  salvaBozza: () => salvaBozza(),
  registra: ({ per, id }) => { U.foglio = { tipo: "registra", per, id, ritorno: U.foglio?.tipo === "scheda" ? "scheda" : null }; render(); },
  avviaReg: () => avviaRegistrazione(),
  fermaReg: () => fermaRegistrazione(),
  rifaiReg: () => { const f = U.foglio; URL.revokeObjectURL(f.url); Object.assign(f, { blob: null, url: null, durata: 0 }); render(); },
  usaReg: async () => {
    const f = U.foglio, ext = f.blob.type.includes("mp4") ? "m4a" : "webm";
    const file = new File([f.blob], (f.per === "spiegazione" ? "Spiegazione" : "Audio") + "." + ext, { type: f.blob.type });
    if (f.per === "spiegazione") {
      const s = scheda(f.id);
      const a = await F.nuovoAllegato(file, s.id, { spiegazione: true, nome: "La tua spiegazione" });
      s.allegati = [...(s.allegati || []).filter(x => !x.spiegazione), a];
      salvaScheda(s); F.accoda(a); caricaFile();
      U.foglio = null; render(); mostra("Spiegazione salvata");
    } else {
      const a = await F.nuovoAllegato(file, U.bozza.id);
      U.bozza.allegati.push(a);
      if (!U.bozza.titolo) U.bozza.titolo = "";
      U.foglio = { tipo: "scheda" }; render();
    }
  },

  // cartelle
  nuovaCartella: ({ padre }) => { U.foglio = { tipo: "cartella", nuova: true, bozza: { id: L.nuovoId(), nome: "", padre: padre || null, colore: L.COLORI[Object.keys(cartelle()).length % L.COLORI.length] } }; render(); setTimeout(() => $("[data-cb=nome]")?.focus(), 350); },
  modificaCartella: ({ id }) => { U.foglio = { tipo: "cartella", bozza: { ...cartelle()[id] } }; render(); },
  coloreCart: ({ c }) => { U.foglio.bozza.colore = c; render(); },
  salvaCartella: () => {
    const c = U.foglio.bozza;
    if (!c.nome?.trim()) return mostra("Scrivi un nome");
    const { id, ...v } = c;
    v.nome = v.nome.trim();
    D.scrivi("cart:" + id, v);
    if (U.foglio.nuova && v.padre) U.aperte.add(v.padre);
    // la data d'esame cambia le date delle schede che non hanno ancora ripassi programmati oltre l'esame
    U.foglio = null; aggiornaAvvisi(); render();
  },
  eliminaCartella: () => {
    const c = U.foglio.bozza;
    chiedi(`Eliminare «${c.nome}»?`, "Le sue schede e sottocartelle non si perdono: passano nella cartella che la contiene.", "Elimina", () => {
      for (const f of figlie(c.id)) D.scrivi("cart:" + f.id, { ...f, id: undefined, padre: c.padre || null });
      for (const s of schede().filter(s => s.cartella === c.id)) salvaScheda({ ...s, cartella: c.padre || null });
      D.scrivi("cart:" + c.id, null);
      U.schermi = U.schermi.filter(x => x.id !== c.id);
      render();
    });
  },

  // sequenze e livelli Smart
  nuovaSequenza: ({ t }) => {
    const bozza = t === "smart" ? { nome: "", desc: "", smart: true, R: .92, tetto: 180 } : { nome: "", desc: "", giorni: [1, 3, 7, 14, 30] };
    U.foglio = { tipo: "sequenza", nuova: true, id: L.nuovoId(), bozza, ritorno: U.foglio }; render();
  },
  modificaSequenza: ({ id }) => { U.foglio = { tipo: "sequenza", id, bozza: { ...sequenze()[id] }, ritorno: U.foglio }; render(); },
  tipoSeq: ({ s }) => {
    const b = U.foglio.bozza; b.smart = s === "1";
    if (b.smart && !b.R) Object.assign(b, { R: .92, tetto: 180 });
    if (!b.smart && !b.giorni?.length) b.giorni = [1, 3, 7, 14, 30];
    render();
  },
  togliGiorno: ({ i }) => { U.foglio.bozza.giorni.splice(Number(i), 1); render(); },
  salvaSequenza: () => {
    const f = U.foglio, b = f.bozza;
    if (!b.nome?.trim()) return mostra("Scrivi un nome");
    const v = { nome: b.nome.trim(), desc: (b.desc || "").trim() };
    if (b.smart) Object.assign(v, { smart: true, R: b.R, tetto: Number(b.tetto) || 180 });
    else {
      const giorni = [...new Set(b.giorni)].sort((x, y) => x - y);
      if (!giorni.length) return mostra("Aggiungi almeno un giorno");
      v.giorni = giorni;
    }
    D.scrivi("seq:" + f.id, v);
    U.foglio = f.ritorno || null;
    render(); mostra("Salvata");
  },
  ripristinaSequenza: () => { const f = U.foglio; D.scrivi("seq:" + f.id, null); U.foglio = f.ritorno || null; render(); mostra("Ripristinata"); },
  eliminaSequenza: () => {
    const f = U.foglio, m = "seq:" + f.id;
    chiedi("Eliminare la sequenza?", "Le schede che la usano passano a Smart 2 · Solido.", "Elimina", () => {
      for (const s of schede().filter(s => s.modo === m)) salvaScheda({ ...s, modo: L.MODO_BASE });
      for (const c of Object.values(cartelle()).filter(c => c.modo === m)) { const { id, ...v } = c; D.scrivi("cart:" + id, { ...v, modo: L.MODO_BASE }); }
      if (prof().modo === m) D.scrivi("profilo", { ...prof(), modo: L.MODO_BASE });
      D.scrivi(m, null); U.foglio = f.ritorno || null; render();
    });
  },

  // impostazioni
  attivaNotifiche: async () => { try { await P.attivaNotifiche(); mostra("Notifiche attive"); aggiornaAvvisi(); } catch (e) { mostra(e.message); } render(); },
  nascondiInvito: () => { D.scrivi("profilo", { ...prof(), nascondiInvito: true }); render(); },
  vacanza: () => { U.foglio = { tipo: "vacanza" }; render(); },
  iniziaVacanza: ({ n }) => {
    n = Number(n);
    const g = L.oggi();
    for (const s of schede()) if (!s.archiviata && s.prossimo) salvaScheda({ ...s, prossimo: L.piu(s.prossimo < g ? g : s.prossimo, n), base: s.base ? L.piu(s.base, n) : s.base });
    D.scrivi("profilo", { ...prof(), vacanza: { dal: g, fino: L.piu(g, n - 1) } });
    U.foglio = null; aggiornaAvvisi(); render(); mostra(`Buona vacanza: si riparte ${L.giornoLungo(L.piu(g, n))}`);
  },
  fineVacanza: () => {
    const p = prof(), g = L.oggi();
    if (!p.vacanza) return;
    const avanzo = L.tra(g, p.vacanza.fino) + 1;   // giorni di vacanza non usati: le date tornano indietro
    if (avanzo > 0) for (const s of schede()) if (s.prossimo && s.prossimo > g) salvaScheda({ ...s, prossimo: L.piu(s.prossimo, -avanzo) < g ? g : L.piu(s.prossimo, -avanzo), base: s.base ? L.piu(s.base, -avanzo) : s.base });
    D.scrivi("profilo", { ...p, vacanza: null });
    aggiornaAvvisi(); render();
  },
  esci: () => chiedi("Uscire?", "I dati restano al sicuro nel tuo account: rientrando ritrovi tutto.", "Esci", async () => { await D.esci(); location.reload(); }),
  ricominciaProva: () => chiedi("Ricominciare la prova?", "Cancella i dati di prova su questo dispositivo.", "Ricomincia", () => { localStorage.removeItem("recordatio.prova"); indexedDB.deleteDatabase("recordatio-file"); location.reload(); }),
};

function chiedi(titolo, testo, ok, azione) { U.foglio = { tipo: "conferma", titolo, testo, ok, azione }; render(); }
function aggiornaInfoMaschere() {
  const info = $("#materiale .info"); if (!info) return;
  const restano = $$("#materiale .masc:not(.via)").length;
  info.textContent = restano ? `${restano} ${restano === 1 ? "parte nascosta" : "parti nascoste"} · tocca per scoprire` : "Tutto scoperto";
}

// ---------- bozza della scheda (nuova o modifica) ----------
function apriBozza(base = {}) {
  const p = prof(), C = cartelle();
  const modoCart = base.cartella && C[base.cartella]?.modo;
  U.bozza = {
    id: base.id || L.nuovoId(), titolo: base.titolo || "", cartella: base.cartella || null, inizio: base.inizio || L.oggi(),
    modo: L.normaModo(base.modo || modoCart || p.modo || L.MODO_BASE), domande: base.domande || "", tag: base.tag || [], allegati: [...(base.allegati || [])],
    esistente: !!base.esistente, originali: (base.allegati || []).map(a => a.id), originale: base.esistente ? base : null,
  };
  U.foglio = { tipo: "scheda" };
  render();
}
async function aggiungiFile(files) {
  const b = U.bozza;
  b.caricando = true; render();
  try {
    for (const f of files) {
      const a = await F.nuovoAllegato(f, b.id);
      b.allegati.push(a);
      if (!b.titolo && a.tipo !== "img") b.titolo = f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ");
      if (a.soloQui) mostra(a.tipo === "video" ? "I video restano solo su questo dispositivo" : "File grande: resta solo su questo dispositivo");
    }
  } catch (e) { mostra("Non riesco ad aggiungere il file: " + e.message); }
  b.caricando = false; render();
}
function salvaBozza() {
  const b = U.bozza, g = L.oggi();
  if (!b.titolo.trim() && !b.allegati.length) return mostra("Aggiungi un titolo o un allegato");
  const titolo = b.titolo.trim() || (b.allegati[0]?.tipo === "img" ? `Foto del ${L.giornoCorto(b.inizio)}` : b.allegati[0]?.nome || "Senza titolo");
  const tag = (Array.isArray(b.tag) ? b.tag : String(b.tag).split(/[\s,#]+/)).map(t => t.trim().toLowerCase()).filter(Boolean);
  const dati = { titolo, cartella: b.cartella || null, domande: b.domande.trim(), tag, modo: b.modo, inizio: b.inizio, allegati: b.allegati.map(a => ({ ...a, schedaId: b.id })) };
  let s;
  if (b.esistente) {
    const o = b.originale;
    s = { ...o, ...dati, id: b.id };
    if (o.modo !== b.modo || o.inizio !== b.inizio) {   // cambiata la modalità o la data di studio: ricalcolo le date, lo storico resta
      const st = o.storico || [];
      s = { ...L.inizializza({ ...s }, ctx(), g), storico: st };
      const nuovaSeq = L.sequenzaDi(s, ctx());
      if (nuovaSeq.smart && st.length) {
        const ultimo = st[st.length - 1];
        s.fsrs = o.fsrs || L.statoSmart(null, Math.max(2, ultimo.voto));
        s.ultimo = ultimo.data;
        const pr = L.piu(ultimo.data, L.intervalloSmart(s.fsrs.s, nuovaSeq));
        s.prossimo = pr < g ? g : pr;
      }
    }
    for (const a of o.allegati || []) if (!b.allegati.some(x => x.id === a.id)) F.elimina(a);
  } else {
    s = L.inizializza({ id: b.id, ...dati, storico: [], creata: new Date().toISOString() }, ctx(), g);
  }
  for (const a of s.allegati) if (!a.caricato && !a.soloQui && !(b.originali || []).includes(a.id)) F.accoda(a);
  salvaScheda(s);
  U.foglio = null; U.bozza = null;
  render(); caricaFile(); aggiornaAvvisi();
  mostra(b.esistente ? "Modifiche salvate" : s.prossimo === g ? "Salvata: la trovi già in Oggi" : `Salvata · primo ripasso ${L.quando(s.prossimo)}`);
}

// ---------- registratore ----------
let registratore = null, pezzi = [], timerReg = null;
async function avviaRegistrazione() {
  const f = U.foglio;
  try {
    const flusso = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tipo = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || "";
    registratore = new MediaRecorder(flusso, tipo ? { mimeType: tipo } : {});
    pezzi = [];
    registratore.ondataavailable = e => e.data.size && pezzi.push(e.data);
    registratore.onstop = () => {
      flusso.getTracks().forEach(t => t.stop());
      if (registratore?.annullata) return;
      const blob = new Blob(pezzi, { type: registratore.mimeType || "audio/mp4" });
      Object.assign(f, { blob, url: URL.createObjectURL(blob), durata: Math.floor((Date.now() - f.inizio) / 1000), inizio: null });
      render();
    };
    registratore.start();
    f.inizio = Date.now(); f.errore = null;
    render();
    timerReg = setInterval(() => { const el = $("#tempoReg"); if (el && f.inizio) { const s = Math.floor((Date.now() - f.inizio) / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; } }, 500);
  } catch (e) { f.errore = "Microfono non disponibile: controlla il permesso nelle impostazioni."; render(); }
}
function fermaRegistrazione(annulla = false) {
  clearInterval(timerReg);
  if (registratore && registratore.state !== "inactive") { registratore.annullata = annulla; registratore.stop(); }
  if (annulla && U.foglio?.tipo === "registra" && U.foglio.ritorno === "scheda") { U.foglio = { tipo: "scheda" }; }
}

// =====================================================================
// VISORE CON ZOOM (foto e PDF) e MASCHERE
// =====================================================================
async function apriVisore(k, { modifica = false } = {}) {
  const a = trova(k);
  if (!a) return;
  if (a.tipo !== "img" && a.tipo !== "pdf") { if (a.tipo === "audio" || a.tipo === "video") return; return AZ.apriFile({ s: k }); }
  const st = schermo()?.tipo === "ripasso" ? schermo() : null;
  const v = document.createElement("div");
  v.className = "visore";
  v.innerHTML = `<div class="su"><button class="iconbtn" data-v="chiudi" aria-label="Chiudi">${ICO.x}</button><span class="nome">${esc(a.nome)}</span>
    ${a.tipo === "img" && !st ? `<button class="iconbtn ${modifica ? "attivo" : ""}" data-v="maschere" aria-label="Maschere">${ICO.maschera}</button>` : `<span style="width:40px"></span>`}</div>
    <div class="zarea"><div class="zcont"></div></div><div class="aiuto">${modifica ? "Trascina per coprire una parte · tocca una maschera per toglierla" : "Pizzica per ingrandire · doppio tocco per lo zoom"}</div>`;
  document.body.append(v);
  bloccaSfondo();
  const area = $(".zarea", v), cont = $(".zcont", v), aiuto = $(".aiuto", v);
  setTimeout(() => { if (!v.dataset.edit) aiuto.style.opacity = "0"; aiuto.style.transition = "opacity .6s"; }, 2600);
  const Z = zoomabile(area, cont);
  let mod = modifica;
  v.dataset.edit = mod ? "1" : "";
  const W = area.clientWidth, H = area.clientHeight;
  if (a.tipo === "img") {
    const u = await F.url(a);
    const img = new Image();
    img.src = u;
    await img.decode().catch(() => { });
    const k2 = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * k2, h = img.naturalHeight * k2;
    cont.innerHTML = `<div class="fig" style="width:${w}px;height:${h}px"><img src="${u}" style="width:${w}px;height:${h}px;max-height:none" alt=""><div class="masche"></div></div>`;
    Z.misura(w, h);
    const disegnaMaschere = () => {
      const m = a.maschere || [], sc = st?.scoperte || {};
      $(".masche", cont).innerHTML = m.map((r, i) => `<button class="masc ${mod ? "edit" : ""} ${!mod && sc[i] ? "via" : ""}" data-m="${i}" style="left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%" aria-label="Maschera ${i + 1}"></button>`).join("");
    };
    disegnaMaschere();
    // maschere: in ripasso si scoprono, in modifica si disegnano trascinando
    let disegno = null;
    cont.addEventListener("pointerdown", e => {
      if (!mod) return;
      const m = e.target.closest(".masc");
      if (m) return;
      e.stopPropagation();
      const r = $(".fig", cont).getBoundingClientRect();
      disegno = { x0: (e.clientX - r.left) / r.width, y0: (e.clientY - r.top) / r.height, r, el: document.createElement("div") };
      disegno.el.className = "masc edit";
      $(".masche", cont).append(disegno.el);
    }, true);
    v.addEventListener("pointermove", e => {
      if (!disegno) return;
      const { r, x0, y0 } = disegno;
      const x1 = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y1 = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      Object.assign(disegno.box = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) });
      Object.assign(disegno.el.style, { left: disegno.box.x * 100 + "%", top: disegno.box.y * 100 + "%", width: disegno.box.w * 100 + "%", height: disegno.box.h * 100 + "%" });
    });
    v.addEventListener("pointerup", () => {
      if (!disegno) return;
      const b = disegno.box; disegno = null;
      if (b && b.w > .02 && b.h > .015) a.maschere = [...(a.maschere || []), { x: +b.x.toFixed(4), y: +b.y.toFixed(4), w: +b.w.toFixed(4), h: +b.h.toFixed(4) }];
      disegnaMaschere(); salvaMaschere(k, a);
    });
    cont.addEventListener("click", e => {
      const m = e.target.closest(".masc"); if (!m) return;
      const i = Number(m.dataset.m);
      if (mod) { a.maschere.splice(i, 1); disegnaMaschere(); salvaMaschere(k, a); }
      else if (st) { st.scoperte[i] = true; m.classList.add("via"); }
    });
    Z.bloccato = () => mod;
    v.addEventListener("click", e => {
      if (e.target.closest("[data-v=maschere]")) {
        mod = !mod; v.dataset.edit = mod ? "1" : "";
        e.target.closest("button").classList.toggle("attivo", mod);
        aiuto.textContent = mod ? "Trascina per coprire una parte · tocca una maschera per toglierla" : "Pizzica per ingrandire · doppio tocco per lo zoom";
        aiuto.style.opacity = "1";
        if (mod) Z.reset();
        disegnaMaschere();
      }
    });
  } else {
    cont.innerHTML = `<div class="mu" style="padding:40px;text-align:center;width:${W}px">Apro il PDF…</div>`;
    try {
      const doc = await F.apriPdf(a);
      cont.innerHTML = "";
      let alt = 0;
      for (let n = 1; n <= doc.numPages; n++) {
        if (!v.isConnected) break;
        const c = await F.disegnaPagina(doc, n, W - 16, Math.min(3, (devicePixelRatio || 2) * 1.25));
        c.style.margin = "8px auto 0";
        cont.append(c);
        alt += parseFloat(c.style.height) + 8;
        cont.style.width = W + "px";
        Z.misura(W, alt + 8, n === 1);
      }
    } catch (e) { cont.innerHTML = `<div class="mu" style="padding:40px;text-align:center;width:${W}px">${esc(e.message)}</div>`; }
  }
  v.addEventListener("click", e => {
    if (e.target.closest("[data-v=chiudi]")) {
      v.remove(); bloccaSfondo();
      if (st) { render(); }
      else if (U.foglio?.tipo === "scheda") render();
    }
  });
}
function salvaMaschere(k, a) {
  const [sid] = k.split("|");
  if (U.bozza?.id === sid) { const i = U.bozza.allegati.findIndex(x => x.id === a.id); if (i >= 0) U.bozza.allegati[i] = { ...a }; return; }
  const s = scheda(sid); if (!s) return;
  s.allegati = s.allegati.map(x => x.id === a.id ? { ...a } : x);
  salvaScheda(s);
}
/** zoom con due dita, trascinamento con un dito, doppio tocco */
function zoomabile(area, cont) {
  let s = 1, x = 0, y = 0, cw = 0, ch = 0;
  const punti = new Map();
  let inizio = null, ultimoTocco = 0;
  const api = { bloccato: () => false };
  const limita = () => {
    const W = area.clientWidth, H = area.clientHeight, w = cw * s, h = ch * s;
    x = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, x));
    y = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, y));
  };
  const applica = (anim = false) => { limita(); cont.style.transition = anim ? "transform .25s ease" : "none"; cont.style.transform = `translate(${x}px,${y}px) scale(${s})`; };
  api.misura = (w, h, centra = true) => { cw = w; ch = h; if (centra) { s = 1; x = 0; y = 0; } applica(); };
  api.reset = () => { s = 1; applica(true); };
  const foto = () => {
    const p = [...punti.values()];
    const m = p.length === 2 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0];
    const d = p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    inizio = { s, x, y, m, d };
  };
  area.addEventListener("pointerdown", e => {
    if (api.bloccato()) return;
    area.setPointerCapture(e.pointerId);
    const r = area.getBoundingClientRect();
    punti.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    foto();
    if (punti.size === 1) {
      const ora = Date.now();
      if (ora - ultimoTocco < 300) {   // doppio tocco: zoom 2,5× dove tocchi, o torna normale
        const p = punti.get(e.pointerId);
        if (s > 1.05) s = 1; else { const n = 2.5; x = p.x - (p.x - x) * n / s; y = p.y - (p.y - y) * n / s; s = n; }
        applica(true); ultimoTocco = 0; return;
      }
      ultimoTocco = ora;
    }
  });
  area.addEventListener("pointermove", e => {
    if (!punti.has(e.pointerId) || api.bloccato()) return;
    const r = area.getBoundingClientRect();
    punti.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    const p = [...punti.values()];
    if (p.length === 2 && inizio.d) {
      const m = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const ns = Math.min(6, Math.max(1, inizio.s * d / inizio.d));
      x = m.x - (inizio.m.x - inizio.x) * ns / inizio.s;
      y = m.y - (inizio.m.y - inizio.y) * ns / inizio.s;
      s = ns;
    } else if (p.length === 1) {
      x = inizio.x + (p[0].x - inizio.m.x);
      y = inizio.y + (p[0].y - inizio.m.y);
    }
    applica();
  });
  const fine = e => { punti.delete(e.pointerId); if (punti.size) foto(); };
  area.addEventListener("pointerup", fine);
  area.addEventListener("pointercancel", fine);
  return api;
}

// =====================================================================
// EVENTI
// =====================================================================
app.addEventListener("click", e => {
  const t = e.target.closest("[data-a]");
  if (!t || t.disabled) return;
  const f = AZ[t.dataset.a];
  if (f) { e.preventDefault(); f(t.dataset, t, e); }
});
app.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.in === "cerca") { U.cerca = t.value; const pos = t.selectionStart; render(); const n = $("[data-in=cerca]"); n.focus(); n.setSelectionRange(pos, pos); return; }
  if (t.dataset.bz && U.bozza && !["cartella", "inizio", "modo"].includes(t.dataset.bz)) U.bozza[t.dataset.bz] = t.value;
  if (t.dataset.cb && U.foglio?.bozza) U.foglio.bozza[t.dataset.cb] = t.dataset.cb === "minRipassi" ? Number(t.value) : (t.value || null);
  if (t.dataset.sq && U.foglio?.bozza) {
    const b = U.foglio.bozza, k = t.dataset.sq;
    if (k === "nome" || k === "desc") b[k] = t.value;
    if (k === "R") { b.R = Number(t.value) / 100; $("#rVal").textContent = t.value + "%"; $("#esSmart").innerHTML = esempiSmart(b); }
  }
});
app.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.file && t.files?.length) { aggiungiFile([...t.files]); t.value = ""; return; }
  if (t.dataset.bz && U.bozza && ["cartella", "inizio", "modo"].includes(t.dataset.bz)) {
    const k = t.dataset.bz;
    U.bozza[k] = k === "inizio" ? (t.value && t.value <= L.oggi() ? t.value : L.oggi()) : (t.value || null);
    if (k === "cartella") { const m = cartelle()[t.value]?.modo; if (m && !U.bozza.esistente) U.bozza.modo = m; }
    render(); return;
  }
  if (t.dataset.imp) {
    const k = t.dataset.imp, v = t.type === "checkbox" ? t.checked : ["tetto", "minEsame"].includes(k) ? Number(t.value) : t.value;
    D.scrivi("profilo", { ...prof(), [k]: v });
    aggiornaAvvisi(); render();
  }
  if (t.dataset.sq === "tetto" && U.foglio?.bozza) { U.foglio.bozza.tetto = Number(t.value); $("#esSmart").innerHTML = esempiSmart(U.foglio.bozza); return; }
  if (t.dataset.sq === "nuovoGiorno" && U.foglio?.bozza) {
    const n = Math.round(Number(t.value));
    if (t.value !== "" && n >= 0 && n <= 3650) { const b = U.foglio.bozza; b.giorni = [...new Set([...(b.giorni || []), n])].sort((x, y) => x - y); render(); setTimeout(() => $("[data-sq=nuovoGiorno]")?.focus(), 30); }
    return;
  }
  if (t.dataset.cb && U.foglio?.bozza && t.tagName === "SELECT") U.foglio.bozza[t.dataset.cb] = t.dataset.cb === "minRipassi" ? Number(t.value) : (t.value || null);
});
addEventListener("keydown", e => {
  if (e.key === "Escape") { if ($(".visore")) $(".visore [data-v=chiudi]").click(); else if (U.foglio) AZ.chiudiFoglio(); else if (U.schermi.length) AZ.chiudiSchermo(); }
  if (schermo()?.tipo === "ripasso" && !U.foglio && /^[1-4]$/.test(e.key)) AZ.voto({ v: e.key });
});

// =====================================================================
// ACCESSO E AVVIO
// =====================================================================
function mostraAccesso(errore = "") {
  app.innerHTML = `<div class="halo"></div><form class="accesso" id="accesso">
    ${neurone(6, 3)}
    <div class="marchio" style="font-size:30px;text-align:center">recordatio<i>.</i></div>
    <p class="mu" style="text-align:center;margin:0 0 6px;font-size:14px;line-height:1.5">Ripassa al momento giusto e ricorda a lungo.<br>Entra con il tuo solito account (lo stesso delle altre app).</p>
    <label class="campo"><span>Email</span><input type="email" id="accEmail" autocomplete="username" required></label>
    <label class="campo"><span>Password</span><input type="password" id="accPw" autocomplete="current-password" required></label>
    <div class="errore">${esc(errore)}</div>
    <button class="btn principale" type="submit">Entra</button>
    <a class="link" href="?prova" style="text-align:center">Provala senza account</a>
  </form>`;
  $("#accesso").addEventListener("submit", async e => {
    e.preventDefault();
    try { await D.accedi($("#accEmail").value.trim(), $("#accPw").value); dopoAccesso(); }
    catch (err) { mostraAccesso(/Invalid login/i.test(err.message) ? "Email o password non corrette." : err.message); }
  });
}
/** una volta sola: il vecchio modo "smart" diventa Smart 2 · Solido ("seq:solido") */
function aggiornaModi() {
  const p = prof();
  if (!p || p.modi >= 2) return;
  for (const s of schede().filter(s => s.modo === "smart")) salvaScheda({ ...s, modo: L.MODO_BASE });
  for (const c of Object.values(cartelle()).filter(c => c.modo === "smart")) { const { id, ...v } = c; D.scrivi("cart:" + id, { ...v, modo: L.MODO_BASE }); }
  D.scrivi("profilo", { ...p, modo: L.normaModo(p.modo === "smart" ? L.MODO_BASE : p.modo || L.MODO_BASE), modi: 2 });
}
function dopoAccesso() {
  if (!D.leggi("profilo")) D.scrivi("profilo", { oraMattina: "08:30", oraSera: "21:00", modo: L.MODO_BASE, minEsame: 3, creato: L.oggi(), modi: 2 });
  aggiornaModi();
  render();
  caricaFile(); aggiornaAvvisi();
  if (P.statoNotifiche() === "attive") P.registraDispositivo().catch(() => { });
}
D.suCambio(() => { if (!U.foglio && !$(".visore") && schermo()?.tipo !== "ripasso") render(); });
addEventListener("online", caricaFile);
let giornoVisto = L.oggi();
document.addEventListener("visibilitychange", () => { if (!document.hidden && L.oggi() !== giornoVisto) { giornoVisto = L.oggi(); if (!U.foglio) render(); aggiornaAvvisi(); } });

async function avvio() {
  if ("serviceWorker" in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) navigator.serviceWorker.register("sw.js").catch(() => { });
  const ok = await D.avvia();
  if (!ok) return mostraAccesso();
  if (D.PROVA && !D.leggi("profilo")) await datiProva();
  dopoAccesso();
}

// ---------- dati di prova (?prova) ----------
async function datiProva() {
  const g = L.oggi();
  const tela = (w, h, disegna) => { const c = document.createElement("canvas"); c.width = w; c.height = h; disegna(c.getContext("2d"), w, h); return new Promise(ok => c.toBlob(ok, "image/png")); };
  const mappa = (titolo, rami) => tela(1200, 800, (x, w, h) => {
    x.fillStyle = "#FFFDF8"; x.fillRect(0, 0, w, h);
    x.strokeStyle = "#3F8FD0"; x.lineWidth = 5; x.font = "600 34px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    const pos = [[230, 170], [970, 170], [230, 630], [970, 630], [600, 110], [600, 700]];
    rami.forEach((r, i) => { const [px, py] = pos[i]; x.beginPath(); x.moveTo(600, 400); x.quadraticCurveTo((600 + px) / 2, py, px, py); x.stroke(); });
    x.fillStyle = "#1F2340"; x.beginPath(); x.roundRect(400, 350, 400, 100, 50); x.fill(); x.fillStyle = "#FFFDF8"; x.font = "600 40px sans-serif"; x.fillText(titolo, 600, 402);
    rami.forEach((r, i) => { const [px, py] = pos[i]; x.fillStyle = "#E3EEF8"; x.beginPath(); x.roundRect(px - 170, py - 50, 340, 100, 22); x.fill(); x.fillStyle = "#1F2340"; x.font = "500 32px sans-serif"; x.fillText(r, px, py + 2); });
  });
  const pdf = righe => {
    const testo = righe.map((r, i) => `BT /F1 ${i ? 15 : 24} Tf 60 ${770 - i * 36} Td (${r}) Tj ET`).join("\n");
    const ogg = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
      `<< /Length ${testo.length} >>\nstream\n${testo}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
    let out = "%PDF-1.4\n"; const off = [];
    ogg.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xr = out.length;
    out += `xref\n0 ${ogg.length + 1}\n0000000000 65535 f \n${off.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${ogg.length + 1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
    return new Blob([out], { type: "application/pdf" });
  };
  D.senzaRegistro(async () => { });
  const cart = { uni: { nome: "Università", colore: "#7CC4FF" }, fis: { nome: "Fisica 2", padre: "uni", colore: "#7CC4FF", modo: "seq:solido", esame: L.piu(g, 40) },
    ana: { nome: "Analisi 1", padre: "uni", colore: "#FF8FAB", modo: "seq:classica", esame: L.piu(g, 71) }, inf: { nome: "Informatica", padre: "uni", colore: "#B9A6FF", modo: "seq:classica" },
    cre: { nome: "Crescita personale", colore: "#FFC58F" }, ah: { nome: "Atomic Habits", padre: "cre", colore: "#FFC58F" }, pod: { nome: "Podcast e audio", colore: "#7FD8BE" } };
  const tutte = [];
  const nuova = async (id, titolo, cartella, modo, studiata, voti, extra = {}) => {
    let s = { id, titolo, cartella, modo, inizio: L.piu(g, -studiata), storico: [], creata: new Date().toISOString(), allegati: [], ...extra };
    const SQ = L.tutteSequenze({ veloce: { nome: "Esame veloce", desc: "creata da te", giorni: [1, 2, 4, 8] } });
    s = L.inizializza(s, { sequenze: SQ, cartelle: Object.fromEntries(Object.entries(cart).map(([k, v]) => [k, { ...v, id: k }])), profilo: {} }, L.piu(g, -studiata));
    for (const v of voti) {
      if (s.prossimo >= g) break;
      s = L.dopoVoto(s, v, { sequenze: SQ, cartelle: {}, profilo: {} }, s.prossimo, 60 + Math.random() * 120);
    }
    tutte.push(s);
    return s;
  };
  const conImm = async (s, titolo, rami, maschere) => {
    const a = await F.nuovoAllegato(new File([await mappa(titolo, rami)], titolo + ".png", { type: "image/png" }), s.id);
    a.maschere = maschere; s.allegati.push(a);
  };
  const s1 = await nuova("gauss", "Legge di Gauss", "fis", "seq:solido", 10, [3, 2, 3], { domande: "Cosa dice la legge, e quando conviene usarla?", tag: ["formule", "mappe"] });
  await conImm(s1, "Legge di Gauss", ["Flusso di E", "Q interna / e0", "Simmetrie", "Esempi"], [{ x: .66, y: .14, w: .3, h: .14 }, { x: .66, y: .72, w: .3, h: .14 }]);
  s1.prossimo = g;
  const s2 = await nuova("limiti", "Limiti notevoli", "ana", "seq:classica", 8, [3, 4]);
  const ap = await F.nuovoAllegato(new File([pdf(["Limiti notevoli", "sin(x)/x -> 1 per x -> 0", "(1 - cos x)/x^2 -> 1/2", "(1 + 1/n)^n -> e", "ln(1+x)/x -> 1", "(e^x - 1)/x -> 1"])], "Limiti notevoli.pdf", { type: "application/pdf" }), s2.id);
  s2.allegati.push(ap); s2.prossimo = g; s2.tag = ["formule"];
  const s3 = await nuova("ah3", "Atomic Habits · Cap. 3", "ah", "seq:leggero", 20, [3, 3, 4, 3]);
  await conImm(s3, "4 leggi", ["Rendilo evidente", "Rendilo attraente", "Rendilo facile", "Rendilo appagante"], [{ x: .05, y: .14, w: .33, h: .14 }, { x: .62, y: .14, w: .33, h: .14 }, { x: .05, y: .72, w: .33, h: .14 }, { x: .62, y: .72, w: .33, h: .14 }]);
  s3.prossimo = g; s3.domande = "Quali sono le 4 leggi del cambiamento?";
  const s4 = await nuova("rolle", "Teorema di Rolle", "ana", "seq:classica", 15, [3, 3, 2]);
  s4.prossimo = g;
  await nuova("ric", "Ricorsione", "inf", "seq:classica", 5, [4]);
  await nuova("leggi7", "Le 48 leggi · Legge 7", "cre", "seq:pav", 30, [3, 4, 4, 3]);
  await nuova("maxwell", "Equazioni di Maxwell", "fis", "seq:intenso", 40, [2, 3, 3, 4, 4]);
  await nuova("derivate", "Derivate fondamentali", "ana", "seq:classica", 35, [3, 4, 4, 4]);
  await nuova("pod1", "Podcast · memoria e sonno", "pod", "seq:piacere", 50, [4, 4, 4, 4]);
  await nuova("grafi", "Grafi e alberi", "inf", "seq:solido", 2, []);
  // un po' di storia passata per la griglia dei progressi
  for (let i = 1; i < 60; i++) if (Math.random() < .75) tutte[i % tutte.length].storico.push({ data: L.piu(g, -i), voto: 3, s: 5 + i / 4, gap: 3, sec: 90 });
  tutte.forEach(s => s.storico.sort((a, b) => a.data.localeCompare(b.data)));
  D.senzaRegistro(() => {
    D.scrivi("profilo", { oraMattina: "08:30", oraSera: "21:00", modo: L.MODO_BASE, minEsame: 3, creato: g, modi: 2 });
    for (const [id, c] of Object.entries(cart)) D.scrivi("cart:" + id, c);
    D.scrivi("seq:veloce", { nome: "Esame veloce", desc: "creata da te", giorni: [1, 2, 4, 8] });
    for (const s of tutte) salvaScheda(s);
  });
  U.aperte.add("uni");
}

avvio();

// tastiera aperta = barra in basso nascosta (su iPhone ballava)
const campoTesto = el => el?.matches?.("input:not([type=checkbox]):not([type=file]):not([type=radio]), textarea, select");
document.addEventListener("focusin", e => { if (campoTesto(e.target)) document.body.classList.add("scrive"); });
document.addEventListener("focusout", () => setTimeout(() => { if (!campoTesto(document.activeElement)) document.body.classList.remove("scrive"); }, 60));
