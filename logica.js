/* logica.js — i CALCOLI di Recordatio (nessuna grafica qui).
   - date "AAAA-MM-GG" nel fuso del telefono
   - le modalità di ripasso: 10 PREDEFINITE (3 livelli Smart con l'algoritmo FSRS + 7 sequenze a giorni fissi)
     più quelle create da te; tutte si scelgono con modo = "seq:<id>" ("smart" delle versioni vecchie = Smart 2)
   - data d'esame, carico bilanciato, vacanza, statistiche, curva dell'oblio, notifiche da programmare */

// ---------- date ----------
const due = n => String(n).padStart(2, "0");
export const dataDi = d => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
export const oggi = () => dataDi(new Date());
export const daData = s => { const [a, m, g] = s.split("-").map(Number); return new Date(a, m - 1, g, 12); };
export const piu = (s, n) => { const d = daData(s); d.setDate(d.getDate() + n); return dataDi(d); };
/** giorni da a → b (b − a) */
export const tra = (a, b) => Math.round((daData(b) - daData(a)) / 86400000);
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
export const nomeMese = m => MESI[m];
export const giornoLungo = s => { const d = daData(s); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };
export const giornoCorto = s => { const d = daData(s); return `${GIORNI[d.getDay()].slice(0, 3)} ${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)}`; };
export const maiuscola = t => t.charAt(0).toUpperCase() + t.slice(1);
export function quando(s, rif = oggi()) {
  const n = tra(rif, s);
  if (n === 0) return "oggi";
  if (n === 1) return "domani";
  if (n === -1) return "ieri";
  if (n > 1) return `tra ${n} giorni`;
  return `${-n} giorni fa`;
}
export const durata = n => n === 1 ? "1 giorno" : n < 60 ? `${n} giorni` : n < 365 ? `${Math.round(n / 30)} mesi` : `${(n / 365).toFixed(1).replace(".0", "").replace(".", ",")} anni`;
export const breve = n => n === 1 ? "domani" : n < 60 ? `${n} g` : n < 365 ? `${Math.round(n / 30)} mesi` : `${(n / 365).toFixed(1).replace(".0", "").replace(".", ",")} anni`;

// ---------- sequenze ----------
export const CLASSICA = { nome: "Classica", desc: "uso generale", giorni: [1, 3, 7, 14, 30, 60] };
/** le modalità che ci sono sempre (modificabili; «Ripristina» torna a questi valori).
    Smart: R = quanto vuoi ricordare quando la scheda torna, tetto = intervallo massimo in giorni. */
export const PREDEFINITE = {
  leggero: { nome: "Smart 1 · Leggero", desc: "cultura, curiosità, per il piacere", smart: true, R: .88, tetto: 365 },
  solido: { nome: "Smart 2 · Solido", desc: "studio normale, da sapere bene", smart: true, R: .92, tetto: 180 },
  intenso: { nome: "Smart 3 · Intenso", desc: "importante o difficile", smart: true, R: .95, tetto: 90 },
  sprint: { nome: "Sprint", desc: "esame tra 1-2 settimane", giorni: [1, 2, 3, 5, 7, 10] },
  medio: { nome: "Esame medio", desc: "esame tra 1-2 mesi", giorni: [1, 3, 7, 14, 21, 30, 45] },
  classica: CLASSICA,
  lungo: { nome: "Lungo termine", desc: "basi da tenere per anni", giorni: [1, 3, 7, 14, 30, 60, 120, 240] },
  piacere: { nome: "Piacere", desc: "ricordare con calma", giorni: [1, 7, 30, 90, 180, 365] },
  rinfresco: { nome: "Rinfresco", desc: "cose che sai già", giorni: [7, 30, 90, 180] },
  pav: { nome: "PAV", desc: "immagini mentali: formule, elenchi", giorni: [0, 1, 2, 4, 7, 14, 30, 60] },
};
export const MODO_BASE = "seq:solido";
/** "smart" (versioni vecchie) → Smart 2; niente → Classica */
export const normaModo = m => m === "smart" ? MODO_BASE : (m || "seq:classica");
/** tutte le modalità: le predefinite (con le tue modifiche sopra) + le tue. salvate = {id: valore di "seq:<id>"} */
export function tutteSequenze(salvate = {}) {
  const out = {};
  for (const [id, v] of Object.entries(PREDEFINITE)) out[id] = { ...v, ...(salvate[id] || {}), predef: true, modificata: !!salvate[id] };
  for (const [id, v] of Object.entries(salvate)) if (!PREDEFINITE[id] && v) out[id] = { ...v, predef: false };
  return out;
}
/** a fine sequenza l'intervallo si moltiplica secondo il voto (2 anni al massimo) */
const MOLT_DOPO = { 2: 1.2, 3: 2, 4: 2.5 }, TETTO_DOPO = 730;
export const VOTI = [
  { v: 1, nome: "Non ricordavo" },
  { v: 2, nome: "Più no che sì" },
  { v: 3, nome: "Più sì che no" },
  { v: 4, nome: "Perfetto" },
];

// ---------- FSRS (versione 4.5): l'algoritmo "Smart" ----------
// pesi predefiniti, tranne due «ammorbiditi» (scelta dell'utente, 2026-11-10): stabilità iniziali 0.4/1.2/3/6 giorni
// (prima «Perfetto» al primo ripasso valeva 15 giorni) e bonus di «Perfetto» 1.6 invece di 2.95
const W = [0.4, 1.2, 3, 6, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 1.6, 0.5034, 0.6567];
const FATTORE = 19 / 81, DECADIMENTO = -0.5;
const limita = (x, a, b) => Math.min(b, Math.max(a, x));
/** probabilità di ricordare dopo t giorni con stabilità s (0..1) */
export const ricordo = (t, s) => Math.pow(1 + FATTORE * Math.max(0, t) / Math.max(0.1, s), DECADIMENTO);
const difficoltaIniziale = g => limita(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);
export function statoSmart(fs, g, t) {
  if (!fs) return { s: W[g - 1], d: difficoltaIniziale(g) };
  const r = ricordo(t, fs.s);
  let s;
  if (g === 1) s = W[11] * Math.pow(fs.d, -W[12]) * (Math.pow(fs.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  else s = fs.s * (Math.exp(W[8]) * (11 - fs.d) * Math.pow(fs.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1) + 1);
  const d = limita(W[7] * difficoltaIniziale(4) + (1 - W[7]) * (fs.d - W[6] * (g - 3)), 1, 10);
  return { s: limita(s, 0.1, 36500), d };
}
/** quanti giorni aspettare perché il ricordo scenda a R (con R = 90% è proprio la stabilità s) */
export const intervalloSmart = (s, seq = {}) => {
  const R = seq.R || .9, fatt = (Math.pow(R, 1 / DECADIMENTO) - 1) / FATTORE;
  return limita(Math.round(s * fatt), 1, seq.tetto || 36500);
};

// ---------- contesto: sequenze, cartelle, carico ----------
/** ctx = { sequenze: {id: {nome, giorni}}, cartelle: {id: cartella}, carico: {data: numero}, profilo } */
export function sequenzaDi(sch, ctx) {
  const id = normaModo(sch.modo).replace("seq:", "");
  return ctx.sequenze?.[id] || PREDEFINITE[id] || ctx.sequenze?.solido || PREDEFINITE.solido;
}
/** la data d'esame che vale per una scheda (la cartella più vicina che ne ha una, ancora nel futuro) */
export function esameDi(sch, ctx, rif = oggi()) {
  let id = sch.cartella, giri = 0;
  while (id && ctx.cartelle[id] && giri++ < 20) {
    const c = ctx.cartelle[id];
    if (c.esame && c.esame > rif) return { data: c.esame, min: c.minRipassi || ctx.profilo?.minEsame || 3, cartella: c.nome };
    id = c.padre;
  }
  return null;
}
function rispettaEsame(sch, prossimo, ctx, rif) {
  const es = esameDi(sch, ctx, rif);
  if (!es) return prossimo;
  const ultimo = piu(es.data, -1);
  if (prossimo <= ultimo || rif >= ultimo) return prossimo;
  const restano = tra(rif, ultimo);
  const passo = Math.max(1, Math.ceil(restano / es.min));
  return piu(rif, Math.min(passo, restano));
}
function bilancia(gap, rif, ctx) {
  if (gap < 4 || !ctx.carico) return gap;
  let meglio = gap;
  for (const g of [gap - 1, gap + 1]) if ((ctx.carico[piu(rif, g)] || 0) < (ctx.carico[piu(rif, meglio)] || 0)) meglio = g;
  return meglio;
}

// ---------- nuova scheda ----------
/** imposta le date di una scheda appena creata (o a cui hai cambiato modalità o data di inizio) */
export function inizializza(sch, ctx, rif = oggi()) {
  const inizio = sch.inizio || rif;
  const n = { ...sch, inizio, passo: 0, recupero: false, fsrs: null, ultimo: null, gapExtra: null };
  const seq = sequenzaDi(sch, ctx);
  if (seq.smart) {
    n.prossimo = piu(inizio, 1) < rif ? rif : piu(inizio, 1);
    n.recupero = piu(inizio, 1) < rif;
  } else {
    n.base = inizio;
    const date = seq.giorni.map(g => piu(inizio, g));
    let k = -1;
    date.forEach((d, i) => { if (d <= rif) k = i; });
    if (k < 0) { n.passo = 0; n.prossimo = date[0]; }
    else { n.passo = k; n.prossimo = rif; n.recupero = date[k] < rif; }   // i ripassi già passati diventano uno solo, oggi
    if (k >= seq.giorni.length) n.passo = seq.giorni.length - 1;
  }
  n.prossimo = rispettaEsame(n, n.prossimo, ctx, rif);
  if (n.prossimo < rif) n.prossimo = rif;
  return n;
}

// ---------- dopo un ripasso ----------
/** restituisce la scheda aggiornata dopo il voto (1-4), senza modificarla */
export function dopoVoto(sch, voto, ctx, rif = oggi(), secondi = 0) {
  const n = { ...sch, storico: [...(sch.storico || [])] };
  const seq = sequenzaDi(sch, ctx);
  let gap, s;
  if (seq.smart) {
    const t = sch.ultimo ? tra(sch.ultimo, rif) : tra(sch.inizio || rif, rif);
    n.fsrs = statoSmart(sch.fsrs, voto, t);
    s = n.fsrs.s;
    gap = bilancia(intervalloSmart(s, seq), rif, ctx);
  } else {
    const g = seq.giorni;
    if (voto === 1) {                                   // dimenticata: domani un ripasso «di riparazione», poi 2 passi indietro
      const j = Math.max(0, Math.min(sch.passo ?? 0, g.length) - 2);
      n.passo = j; n.base = piu(rif, 1 - g[j]); n.gapExtra = null;
      gap = 1;
    } else {
      if (!sch.recupero && sch.prossimo && sch.prossimo < rif && sch.base) n.base = piu(sch.base, tra(sch.prossimo, rif));   // in ritardo: tutto slitta
      const dopo = (sch.passo ?? 0) + 1;
      if (dopo < g.length) { n.passo = dopo; gap = Math.max(1, tra(rif, piu(n.base, g[dopo]))); }
      else {                                            // sequenza finita: l'intervallo cresce secondo il voto
        const ultimoGap = sch.gapExtra || (g.length > 1 ? g[g.length - 1] - g[g.length - 2] : g[0]) || 1;
        n.gapExtra = limita(Math.round(ultimoGap * MOLT_DOPO[voto]), 1, TETTO_DOPO); n.passo = g.length; gap = n.gapExtra;
      }
    }
    s = gap;
  }
  n.recupero = false;
  n.ultimo = rif;
  n.prossimo = rispettaEsame(n, piu(rif, gap), ctx, rif);
  n.storico.push({ data: rif, voto, s: Math.round(s * 10) / 10, gap: tra(rif, n.prossimo), sec: Math.round(secondi) });
  return n;
}
/** previsione dei prossimi ripassi rispondendo sempre «voto» (esame compreso): [{giorno (da rif), data, dopo}]
    dopo = true quando la sequenza fissa è già finita e si va avanti secondo il voto */
export function previsione(sch, ctx, quanti = 8, rif = oggi(), voto = 3) {
  const c = { ...ctx, carico: null };
  let s = sch.prossimo ? sch : inizializza(sch, c, rif);
  const seq = sequenzaDi(s, c), out = [];
  for (let i = 0; i < quanti && s.prossimo; i++) {
    out.push({ giorno: tra(rif, s.prossimo), data: s.prossimo, dopo: !seq.smart && (s.passo ?? 0) >= seq.giorni.length });
    s = dopoVoto(s, voto, c, s.prossimo);
  }
  return out;
}
/** anteprima: per ogni voto, tra quanti giorni torna */
export const anteprimaVoti = (sch, ctx, rif = oggi()) => VOTI.map(v => tra(rif, dopoVoto(sch, v.v, { ...ctx, carico: null }, rif).prossimo));

export function rimanda(sch, giorni = 1, rif = oggi()) {
  const n = { ...sch, prossimo: piu(rif, giorni) };
  if (n.base && !n.recupero) n.base = piu(n.base, tra(sch.prossimo < rif ? rif : sch.prossimo, n.prossimo));
  return n;
}

// ---------- elenchi ----------
export const daFare = (schede, rif = oggi()) => schede.filter(s => !s.archiviata && s.prossimo && s.prossimo <= rif)
  .sort((a, b) => a.prossimo.localeCompare(b.prossimo) || (a.creata || "").localeCompare(b.creata || ""));
export const fattiIl = (schede, giorno) => schede.filter(s => (s.storico || []).some(r => r.data === giorno));
export function carico(schede) {
  const c = {};
  for (const s of schede) if (!s.archiviata && s.prossimo) c[s.prossimo] = (c[s.prossimo] || 0) + 1;
  return c;
}
/** minuti stimati per n ripassi (media dei tuoi tempi, se no 2 minuti l'uno) */
export function minutiStimati(schede, n) {
  const tempi = schede.flatMap(s => (s.storico || []).map(r => r.sec)).filter(x => x > 5 && x < 1800).slice(-60);
  const media = tempi.length >= 5 ? tempi.reduce((a, b) => a + b, 0) / tempi.length : 120;
  return Math.max(1, Math.round(n * media / 60));
}

// ---------- statistiche ----------
export function serie(schede, attivi = {}, rif = oggi()) {
  const giorni = new Set(Object.keys(attivi));
  for (const s of schede) for (const r of s.storico || []) giorni.add(r.data);
  let n = 0, d = giorni.has(rif) ? rif : piu(rif, -1);
  while (giorni.has(d)) { n++; d = piu(d, -1); }
  let record = 0, corrente = 0;
  [...giorni].sort().forEach((g, i, a) => { corrente = i && tra(a[i - 1], g) === 1 ? corrente + 1 : 1; record = Math.max(record, corrente); });
  return { n, record: Math.max(record, n), giorni };
}
/** forza di una scheda oggi (0..1) */
export function forza(sch, rif = oggi()) {
  const st = sch.storico || [];
  if (!st.length) return null;
  const u = st[st.length - 1];
  return ricordo(tra(u.data, rif), u.s || 1);
}
export function forzaMedia(schede, rif = oggi()) {
  const v = schede.filter(s => !s.archiviata).map(s => forza(s, rif)).filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
/** forza media alla fine di ognuna delle ultime n settimane */
export function forzaNelTempo(schede, settimane = 8, rif = oggi()) {
  const out = [];
  for (let i = settimane - 1; i >= 0; i--) {
    const giorno = piu(rif, -7 * i);
    const v = schede.map(s => {
      const st = (s.storico || []).filter(r => r.data <= giorno);
      if (!st.length) return null;
      const u = st[st.length - 1];
      return ricordo(tra(u.data, giorno), u.s || 1);
    }).filter(x => x != null);
    out.push(v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  }
  return out;
}
/** curva dell'oblio di una scheda: punti [giorno relativo, ricordo] dal primo studio fino a dopo il prossimo ripasso */
export function curva(sch, rif = oggi()) {
  const st = sch.storico || [];
  const inizio = sch.inizio || st[0]?.data || rif;
  const fine = sch.prossimo && sch.prossimo > rif ? sch.prossimo : piu(rif, 7);
  const tappe = [{ data: inizio, s: st.length ? Math.max(0.5, (st[0].s || 1) / 3) : 1 }, ...st.map(r => ({ data: r.data, s: r.s || 1 }))];
  const punti = [];
  const giorni = tra(inizio, fine);
  for (let i = 0; i < tappe.length; i++) {
    const a = tra(inizio, tappe[i].data), b = i + 1 < tappe.length ? tra(inizio, tappe[i + 1].data) : giorni;
    for (let k = 0; k <= 16; k++) {
      const x = a + (b - a) * k / 16;
      punti.push([x, ricordo(x - a, tappe[i].s)]);
    }
  }
  return { punti, giorni: Math.max(1, giorni), tappe: tappe.map(t => tra(inizio, t.data)), oggi: tra(inizio, rif), inizio, fine };
}

// ---------- notifiche da programmare ----------
export function avvisi(schede, profilo, rif = oggi()) {
  if (profilo?.notifiche === false) return [];
  const fuori = profilo?.vacanza?.fino && profilo.vacanza.fino >= rif ? profilo.vacanza.fino : null;
  const [hm, mm] = (profilo?.oraMattina || "08:30").split(":").map(Number);
  const [hs, ms] = (profilo?.oraSera || "21:00").split(":").map(Number);
  const c = carico(schede.filter(s => !s.archiviata));
  const out = [];
  for (let i = 0; i < 14; i++) {
    const g = piu(rif, i);
    if (fuori && g <= fuori) continue;
    const n = i === 0 ? daFare(schede, rif).length : (c[g] || 0);
    if (!n) continue;
    const mattina = daData(g); mattina.setHours(hm, mm, 0, 0);
    out.push({ chiave: "m:" + g, invio_alle: mattina, titolo: n === 1 ? "Oggi hai 1 ripasso" : `Oggi hai ${n} ripassi`,
      testo: `Circa ${minutiStimati(schede, n)} minuti per accendere le connessioni di oggi.`, url: "./?b=" + n });
    if (profilo?.sera !== false) {
      const sera = daData(g); sera.setHours(hs, ms, 0, 0);
      out.push({ chiave: "s:" + g, invio_alle: sera, titolo: n === 1 ? "Ti manca 1 ripasso" : `Ti mancano ${n} ripassi`,
        testo: "Bastano pochi minuti: non lasciare spegnere quello che hai studiato.", url: "./?b=" + n });
    }
  }
  return out;
}

// ---------- utilità ----------
export const nuovoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const COLORI = ["#7CC4FF", "#FF8FAB", "#B9A6FF", "#7FD8BE", "#FFC58F", "#F6E27F", "#9AA0BF"];
