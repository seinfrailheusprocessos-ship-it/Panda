(function(){
/* ===== a_core.js ===== */
'use strict';
/* =====================================================================
   Proc.Ios 3 — núcleo
   ===================================================================== */
const BUILD = 'pwa', PWA = BUILD === 'pwa';
const APP_NOME = 'Panda';
const VERSAO_APP = 'V1.SMDIEDC';   /* Secretaria Municipal de Infraestrutura e Defesa Civil de Ilhéus */
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function b64u8(b64){ const s = atob(b64); const u = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
const safeName = (s, ext) => (String(s || 'Documento').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Documento') + ext;
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- datas e valores ---------- */
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function dataBR(iso){ if(!iso) return ''; const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso); }
function dataCurta(ts){ if(!ts) return ''; const d = new Date(ts); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }
function diasEntre(a, b){ if(!a) return null; const x = new Date(a + 'T12:00:00'), y = b ? new Date(b + 'T12:00:00') : new Date(); return Math.round((y - x) / 86400000); }
function somaDias(iso, n){ if(!iso || !n) return ''; const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + (+n)); return d.toISOString().slice(0, 10); }
function numBR(v){ if(v === '' || v == null) return null; if(typeof v === 'number') return v; const s = String(v).replace(/[R$\s]/g, ''); const n = parseFloat(/,\d{1,2}$/.test(s) || /\.\d{3}/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.')); return isNaN(n) ? null : n; }
function fmtBRL(v){ const n = numBR(v); return n == null ? '' : 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }); }

/* ---------- DOM ---------- */
function h(tag, attrs, ...kids){
  const el = document.createElement(tag);
  if(attrs) for(const k in attrs){
    const v = attrs[k];
    if(v == null || v === false) continue;
    if(k === 'class') el.className = v;
    else if(k === 'html') el.innerHTML = v;
    else if(k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if(k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if(k === 'dataset') Object.assign(el.dataset, v);
    else if(v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = c => { if(c == null || c === false) return; if(Array.isArray(c)) c.forEach(add); else el.append(c instanceof Node ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}

/* ---------- guardado no aparelho (IndexedDB) ---------- */
let _db = null;
function idb(){
  if(_db) return _db;
  _db = new Promise((res, rej) => {
    let r;
    try{ r = indexedDB.open('procios3', 1); }catch(e){ rej(e); return; }
    r.onupgradeneeded = () => { const d = r.result; if(!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if(!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath:'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  _db.catch(() => { _db = null; });
  return _db;
}
async function idbDo(store, mode, fn){
  try{
    const d = await idb();
    return await new Promise((res, rej) => {
      const tx = d.transaction(store, mode), st = tx.objectStore(store), rq = fn(st);
      tx.oncomplete = () => res(rq && 'result' in rq ? rq.result : undefined);
      tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
  }catch(e){ console.warn('idb', e); return undefined; }
}
const kvGet = k => idbDo('kv', 'readonly', st => st.get(k));
/* leitura que avisa quando o armazenamento falha (não confunde erro com vazio) */
async function kvGetStrict(k){
  const d = await idb();
  return await new Promise((res, rej) => { const tx = d.transaction('kv', 'readonly'), rq = tx.objectStore('kv').get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); tx.onabort = () => rej(tx.error); });
}
const kvSet = (k, v) => idbDo('kv', 'readwrite', st => st.put(v, k));
const lsGet = (k, d) => { try{ const v = localStorage.getItem('procios3.' + k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } };
const lsSet = (k, v) => { try{ localStorage.setItem('procios3.' + k, JSON.stringify(v)); }catch(e){} };

/* ---------- avisos ---------- */
let toastT;
function toast(m, o = {}){
  const t = $('toast'); t.replaceChildren(h('span', null, m));
  if(o.acao) t.append(h('button', { onclick:() => { t.hidden = true; o.fn(); } }, o.acao));
  t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, o.ms || (o.acao ? 6000 : 2600));
}
function busy(txt){
  $('busyTxt').textContent = txt || 'Preparando…'; $('busy').hidden = false;
  return { txt(t){ $('busyTxt').textContent = t; }, end(){ $('busy').hidden = true; } };
}

/* ---------- ícones ---------- */
const P_ = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra || ''}>${d}</svg>`;
const I = {
  chevL:P_('<path d="M15 5l-7 7 7 7"/>', ' stroke-width="2.2"'), chevR:P_('<path d="M9 5l7 7-7 7"/>', ' stroke-width="2.2"'),
  chevU:P_('<path d="M5 15l7-7 7 7"/>', ' stroke-width="2.2"'), chevD:P_('<path d="M5 9l7 7 7-7"/>', ' stroke-width="2.2"'),
  personPlus:P_('<circle cx="10" cy="8" r="3.6"/><path d="M3.5 20c.6-3.6 3.3-5.6 6.5-5.6 1.4 0 2.7.4 3.8 1.1M18.5 14v6M15.5 17h6"/>', ' stroke-width="1.8"'),
  plusBold:P_('<path d="M12 5v14M5 12h14"/>', ' stroke-width="2.4"'),
  plusCircle:P_('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  selbox:P_('<rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke-dasharray="2.4 2.4"/><path d="M12 8.5v7M10.3 8.5h3.4M10.3 15.5h3.4"/>'),
  highlighter:P_('<path d="M5 20h14"/><path d="M8 16l-1-3 8-8 4 4-8 8z"/>'),
  textsize:P_('<path d="M3 18l4.5-11L12 18M4.6 14h5.8M14 18l3-7.5 3 7.5M15 15.5h4"/>'),
  keyboard:P_('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10"/>'),
  campo:P_('<rect x="3" y="7" width="12" height="10" rx="2" stroke-dasharray="2.2 2"/><path d="M15 12h6M18.5 9.5 21 12l-2.5 2.5"/>', ' stroke-width="1.8"'),
  table:P_('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10"/>'),
  rotR:P_('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  rotL:P_('<path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 4v7h7"/>'),
  print:P_('<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7z"/>'),
  camera:P_('<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13.2" r="3.6"/>'),
  folderPlus:P_('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>'),
  selpg:P_('<rect x="4" y="3.5" width="7" height="9" rx="1.2"/><rect x="13" y="3.5" width="7" height="9" rx="1.2"/><rect x="4" y="14.5" width="7" height="6" rx="1.2"/><path d="M14.5 17.5l1.8 1.8 3.2-3.6"/>'),
  side:P_('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9 4.5v15M5.8 8.5h1M5.8 11.5h1M5.8 14.5h1"/>'),
  sideR:P_('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M15 4.5v15M17.2 8.5h1M17.2 11.5h1M17.2 14.5h1"/>'),
  sig:P_('<path d="M4 19c3-.5 4.5-3 6-6.5S13.5 5 15.5 5 17 7.5 14 11s-5 7-2 7 4.5-2.5 6-2.5c1 0 1.5.8 2 1.5"/>'),
  paper:P_('<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" transform="translate(-.5 0)"/><path d="M13.5 3.5V8h4"/><path d="M9.5 12.5h5M9.5 15.5h5"/>'),
  menu:P_('<path d="M4 7h16M4 12h16M4 17h10"/>'), back:P_('<path d="M15 6l-6 6 6 6"/>'), plus:P_('<path d="M12 5v14M5 12h14"/>'),
  x:P_('<path d="M6 6l12 12M18 6L6 18"/>'), chev:P_('<path d="M9 6l6 6-6 6"/>'), down:P_('<path d="M6 9l6 6 6-6"/>'), up:P_('<path d="M6 15l6-6 6 6"/>'),
  more:P_('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
  trash:P_('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'), rot:P_('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  dl:P_('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'), word:P_('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M7.5 9l1.5 6 2-5 2 5 1.5-6"/>'),
  doc:P_('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  docplus:P_('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>'),
  pdf:P_('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 16.5v-4h1.2a1.2 1.2 0 0 1 0 2.4H8.5M13 12.5v4h.8a1.7 1.7 0 0 0 0-3.4H13z"/>'),
  layers:P_('<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 17l9 5 9-5"/>'),
  folder:P_('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  folderShare:P_('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 16v-5M9.5 13.5 12 11l2.5 2.5"/>'),
  search:P_('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>'),
  zoomIn:P_('<circle cx="10.5" cy="10.5" r="6.3"/><path d="M15.2 15.2l4.6 4.6M7.9 10.5h5.2M10.5 7.9v5.2"/>'),
  zoomOut:P_('<circle cx="10.5" cy="10.5" r="6.3"/><path d="M15.2 15.2l4.6 4.6M7.9 10.5h5.2"/>'),
  gear:P_('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  home:P_('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>'),
  share:P_('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4M12 2v13"/>'),
  note:P_('<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8.5 9h7M8.5 12.5h5"/>'),
  report:P_('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9.5 17v-3M12.5 17v-6M15.5 17v-4"/>'),
  pen:P_('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  copy:P_('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  check:P_('<path d="M5 12.5l4.5 4.5L19 7.5"/>', ' stroke-width="2.3"'),
  clock:P_('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  route:P_('<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>'),
  paste:P_('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4.5V3.8c0-.4.3-.8.8-.8h4.4c.5 0 .8.4.8.8v.7"/><path d="M9 10h6M9 13.5h6M9 17h3.5"/>'),
  eye:P_('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  blank:P_('<rect x="5" y="3" width="14" height="18" rx="2"/>'),
  split:P_('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 12h3M10.5 12h3M16 12h3"/>'),
  dup:P_('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/><path d="M14 11v6M11 14h6"/>'),
  undo:P_('<path d="M9 14l-4-4 4-4"/><path d="M5 10h9a5 5 0 0 1 0 10h-2"/>'),
  stamp:P_('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>'),
  hash:P_('<path d="M5 9h14M5 15h14M10 4l-2 16M16 4l-2 16"/>'),
  clip:P_('<path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>'),
  whats:P_('<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-.9-.4-1.6-1.1-2-2l.8-1-1-2z"/>'),
  info:P_('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>'),
  sparkle:P_('<path d="M12 4l1.8 4.7L18.5 10.5l-4.7 1.8L12 17l-1.8-4.7L5.5 10.5l4.7-1.8z"/><path d="M19 16l.7 1.6 1.6.7-1.6.7L19 20.6l-.7-1.6-1.6-.7 1.6-.7z"/>'),
  calc:P_('<rect x="5" y="3" width="14" height="18" rx="2"/><rect x="8" y="6" width="8" height="3" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>'),
  cal:P_('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4M8 13h3M8 16.5h6"/>'),
  mail:P_('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/>'),
  contract:P_('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8.5 12h7M8.5 15h5"/><path d="M14.5 18.5l1.4 1.4 2.6-2.8"/>'),
  gavel:P_('<path d="M4 20h9M14.5 4.5l5 5M12 7l5 5M16.5 5.5l-8 8-2-2 8-8z"/><path d="M9.5 12.5l2 2-4 4-2-2z"/>'),
  pin:P_('<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z"/><path d="M12 14v7"/>'),
  boxes:P_('<rect x="3" y="4" width="8" height="7" rx="1"/><rect x="13" y="4" width="8" height="7" rx="1"/><rect x="8" y="13" width="8" height="7" rx="1"/>')
};

/* ---------- brasão e carimbos ---------- */
const B64_BRASAO = "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";
const B64_CARIMBO_SEINFRA = "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";
const B64_CARIMBO_LIC = "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";
const B64_PANDA = "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";
const BRAS_SRC = 'data:image/jpeg;base64,' + B64_BRASAO;
const BRAS_IMG = new Image(); BRAS_IMG.src = BRAS_SRC;
const PANDA_SRC = 'data:image/png;base64,' + B64_PANDA;

/* ---------- ajustes ---------- */
const REV_PROMPT = 'Você é revisor de textos oficiais da Prefeitura Municipal de Ilhéus (Secretaria de Infraestrutura e Defesa Civil). Revise o TEXTO abaixo em português do Brasil:\n' +
  '- corrija ortografia, acentuação, crase, concordância, regência e pontuação;\n' +
  '- mantenha o sentido, os termos técnicos de engenharia, números, datas, valores e nomes exatamente como estão;\n' +
  '- mantenha o tom formal e impessoal de nota técnica ou despacho; melhore a clareza só quando a frase estiver confusa;\n' +
  '- não acrescente informações nem opiniões;\n' +
  '- nunca use a palavra "tratativa" ou "tratativas" (prefira reuniões, ajustes ou interação).\n' +
  'Responda primeiro com o texto revisado, sem comentários. Depois, numa linha sozinha, escreva ---MUDANÇAS--- e liste em tópicos curtos o que mudou (ou "Nenhuma mudança necessária").';
const SETTINGS_PADRAO = () => ({
  v:4,
  timbre:'completo',          /* 'brasao' = só o brasão · 'completo' = brasão + Estado da Bahia / Prefeitura (padrão MPF) */
  brasTexto:'todas',          /* brasão dos textos novos: todas | primeira | nenhum */
  carimbo:'nenhum', numerar:false, inicial:1,
  deitada:'esq',              /* página deitada vira para a esquerda na impressão → carimbo no canto inferior direito */
  zoom:88,
  cidade:'Ilhéus',
  setor:'Superintendência de Projetos e Fiscalização',
  signatarios:[
    { id:'s1', nome:'Lucas S. L. P. Santana', cargo:'Assistente Administrativo', mat:'023479', autoridade:false, carimbo:'' },
    { id:'s2', nome:'Hiago C. S. Guimarães Ramos', cargo:'Superintendente de Projetos e Fiscalização', mat:'', autoridade:false, carimbo:'' },
    { id:'s3', nome:'Gabriel de Andrade Cerqueira', cargo:'Secretário de Infraestrutura e Defesa Civil', mat:'', autoridade:true, carimbo:'' }
  ],
  orgao:'Secretaria Municipal de Infraestrutura e Defesa Civil de Ilhéus',
  sigla:'SMDIEDC',
  sigLine:false,
  ia:{ prov:'auto', claudeKey:'', geminiKey:'', claudeModel:'claude-haiku-4-5', geminiModel:'gemini-2.5-flash', tier:'quick', prompt:REV_PROMPT },
  modelos:null,
  lay:null
});
let settings = SETTINGS_PADRAO();
function saveSettings(){ lsSet('settings', settings); kvSet('settings', settings); }
function signatario(id){ return settings.signatarios.find(s => s.id === id) || settings.signatarios[0] || { nome:'', cargo:'', mat:'' }; }
const cargoLinha = s => s ? (s.cargo || '') + (s.mat ? ' – Matrícula nº ' + s.mat : '') : '';

/* ===== b_engine.js ===== */

/* =====================================================================
   Motor de documentos — padrão MPI (Modelos Padronizados de Ilhéus)
   A4 · margens: sup. 2 cm (5 cm com cabeçalho) · inf. 2 cm · esq. 3 cm · dir. 2,5 cm
   Times 12 · entrelinhas 1,15 · 6 pt depois de cada parágrafo
   ===================================================================== */
const PAG = {
  retrato: { W:595.28, H:841.89, T:56.69, B:56.69, L:85.04, R:70.87 },
  paisagem: { W:841.89, H:595.28, T:56.69, B:56.69, L:70.87, R:70.87 }
};
for(const k in PAG){ const g = PAG[k]; g.CW = g.W - g.L - g.R; g.ALT = g.H - g.T - g.B; }
const T_TIMBRE = 141.73;               /* com cabeçalho, o texto começa a 5 cm do topo */
const K_ALT = 1.107, K_ASC = 0.891;    /* métricas do Times */
const RECUO = 35.43, RECUO_CIT = 113.39, ESPACO_ASSIN = 80;
const ESTILOS = {
  tit:   { size:12, f:'b', al:'center', bf:0, af:0, kn:1, kl:1, caixa:1 },
  ident: { size:12, f:'b', al:'center', bf:0, af:40, kn:1, kl:1, caixa:1 },
  dt:    { size:12, al:'right', bf:0, af:18, kn:1, kl:1 },
  bl:    { size:12, al:'left', bf:0, af:0, kl:1 },
  cap:   { size:12, f:'b', al:'left', bf:12, af:6, kn:1, kl:1 },
  sub:   { size:12, f:'b', al:'left', bf:12, af:6, kn:1, kl:1 },
  corpo: { size:12, al:'justify', bf:0, af:6 },
  item:  { size:12, al:'justify', bf:0, af:6, kl:1 },
  alin:  { size:12, al:'justify', bf:0, af:6, kl:1, ind:28.35 },
  cit:   { size:11, al:'justify', bf:0, af:6, ind:RECUO_CIT, lf:1 },
  loc:   { size:12, al:'left', bf:12, af:0, kn:1, kl:1 },
  sig1:  { size:12, f:'b', al:'center', bf:ESPACO_ASSIN, af:0, kn:1, kl:1 },
  sig2:  { size:12, f:'b', al:'center', bf:0, af:0, kl:1 },
  tdoc:  { size:14, f:'b', al:'center', bf:12, af:6, kn:1, kl:1 }
};
const WIN_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const WIN_TROCA = { '≤':'<=', '≥':'>=', '→':'->', '←':'<-', '☐':'( )', '☒':'(X)', '☑':'(X)', '✓':'v', '✔':'v', '\t':' ', ' ':' ', ' ':' ', ' ':' ', ' ':' ', ' ':' ', '​':'', '‐':'-', '‑':'-', '−':'-', 'Ω':'Ohm', 'μ':'u', '′':"'", '″':'"', '∅':'Ø' };
function winAnsi(s){ return String(s == null ? '' : s).replace(/[^\x20-\x7E\xA0-\xFF\n]/g, c => WIN_EXTRA.includes(c) ? c : (WIN_TROCA[c] != null ? WIN_TROCA[c] : '')); }
async function fontes(pdf){
  const F = PDFLib.StandardFonts;
  return { r: await pdf.embedFont(F.TimesRoman), b: await pdf.embedFont(F.TimesRomanBold), i: await pdf.embedFont(F.TimesRomanItalic), bi: await pdf.embedFont(F.TimesRomanBoldItalic),
    h: await pdf.embedFont(F.Helvetica), hb: await pdf.embedFont(F.HelveticaBold) };
}
let _fm = null;
async function fontesMedida(){ if(_fm) return _fm; const d = await PDFLib.PDFDocument.create(); _fm = await fontes(d); return _fm; }
function largura(font, txt, size){
  const c = font.__w || (font.__w = {}); let w = 0;
  for(const ch of txt){ if(c[ch] === undefined){ try{ c[ch] = font.widthOfTextAtSize(ch, 1000); }catch(e){ c[ch] = font.widthOfTextAtSize('?', 1000); } } w += c[ch]; }
  return w * size / 1000;
}

/* ---------- datas e nomes ---------- */
const MESES_EXT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function dataExtenso(iso){ const d = iso ? new Date(iso + 'T12:00:00') : new Date(); const dia = d.getDate(); return (dia === 1 ? '1º' : dia) + ' de ' + MESES_EXT[d.getMonth()] + ' de ' + d.getFullYear(); }
const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'à', 'às', 'ao', 'aos', 'sem', 'sob', 'um', 'uma']);
/* Iniciais maiúsculas, conectivos em minúscula; siglas (tudo maiúsculo com 2+ letras) ficam como estão */
function titleCase(s){
  return String(s || '').split(/(\s+)/).map((w, i) => {
    if(!w.trim()) return w;
    if(/^[A-ZÀ-Ý0-9]{2,}[.\-]?$/.test(w) && /[A-Z]/.test(w) && w.length <= 6 && !/^[A-ZÀ-Ý]{4,}$/.test(w.replace(/\W/g, ''))) return w;
    if(/^\d/.test(w) || /\./.test(w) && w.length <= 3) return w;
    const low = w.toLocaleLowerCase('pt-BR');
    if(i > 0 && CONECTIVOS.has(low)) return low;
    return low.charAt(0).toLocaleUpperCase('pt-BR') + low.slice(1);
  }).join('');
}

/* ---------- HTML → blocos ---------- */
function runsDe(no, base, ctx){
  const out = [];
  (function walk(n, st){
    for(const c of Array.from(n.childNodes)){
      if(c.nodeType === 3){ const t = c.data.replace(/[\r\n\t]+/g, ' '); if(t) out.push({ t, b:st.b, i:st.i, u:st.u, sup:st.sup }); continue; }
      if(c.nodeType !== 1) continue;
      const tg = c.tagName;
      if(tg === 'BR'){ out.push({ br:true }); continue; }
      if(tg === 'UL' || tg === 'OL') continue;
      if(tg === 'SUP' && c.classList && c.classList.contains('nr')){
        const nota = c.getAttribute('data-nota') || '';
        if(ctx){ ctx.notas.push(nota); out.push({ t:String(ctx.notas.length), b:st.b, i:false, sup:true, nota:ctx.notas.length }); }
        continue;
      }
      if(c.classList && c.classList.contains('naoimp')) continue;
      const w = (c.getAttribute && c.getAttribute('style')) || '';
      const s2 = { b: st.b || tg === 'B' || tg === 'STRONG' || /font-weight\s*:\s*(bold|[6-9]00)/i.test(w), i: st.i || tg === 'I' || tg === 'EM', u: st.u || tg === 'U', sup: st.sup || tg === 'SUP' };
      walk(c, s2);
    }
  })(no, base || { b:false, i:false, u:false, sup:false });
  while(out.length && out[0].t != null && !out[0].t.trim()) out.shift();
  while(out.length && out[0].br) out.shift();
  if(out.length && out[0].t) out[0].t = out[0].t.replace(/^\s+/, '');
  while(out.length && (out[out.length - 1].br || (out[out.length - 1].t != null && !out[out.length - 1].t.trim()))) out.pop();
  if(out.length && out[out.length - 1].t) out[out.length - 1].t = out[out.length - 1].t.replace(/\s+$/, '');
  return out;
}
/* parágrafo numerado (1.1, 2., a), I -) e vocativo não levam recuo de primeira linha */
function semRecuo(txt){
  const t = String(txt || '').trim();
  return /^(\d+(\.\d+)*[.)º°]?|[a-z]\)|[IVXLC]+\s*[.)–-]|[-–•▪])\s/.test(t) || /^(senhor|senhora|senhores|excelent|prezad|ilustr|magn[íi]fic|vossa)[^.]{0,70},$/i.test(t);
}
const alinea = n => { let s = ''; n++; while(n > 0){ const m = (n - 1) % 26; s = String.fromCharCode(97 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
function htmlParaBlocos(src, ctx){
  let d = src;
  if(typeof src === 'string' || src == null){ d = document.createElement('div'); d.innerHTML = src || ''; }
  ctx = ctx || { notas:[] };
  const out = [];
  const R = (el, base) => runsDe(el, base, ctx);
  function lista(el, nivel){
    let k = 0;
    for(const li of Array.from(el.children)){
      if(li.tagName !== 'LI') continue;
      const pref = el.tagName === 'OL' ? (k + 1) + '. ' : alinea(k) + ') ';
      const runs = R(li);
      if(runs.length) out.push({ s:'item', runs:[{ t:pref }].concat(runs), ind:28.35 * nivel, el:li });
      k++;
      for(const sub of Array.from(li.children)) if(sub.tagName === 'UL' || sub.tagName === 'OL') lista(sub, nivel + 1);
    }
  }
  function tabela(el){
    const rows = [];
    el.querySelectorAll('tr').forEach(tr => {
      if(tr.closest('table') !== el) return;
      const cels = Array.from(tr.children).filter(c => /^T[DH]$/.test(c.tagName));
      if(!cels.length) return;
      const hdr = cels.every(c => c.tagName === 'TH');
      rows.push({ hdr, cels: cels.map(c => ({ runs: R(c, { b: c.tagName === 'TH', i:false, u:false }), al: (c.classList && c.classList.contains('n')) || /right/.test((c.style && c.style.textAlign) || '') ? 'right' : /center/.test((c.style && c.style.textAlign) || '') ? 'center' : 'left' })) });
    });
    if(rows.length) out.push({ s:'tab', rows, size:10, el });
  }
  function citacao(el){
    const ps = Array.from(el.children).filter(c => c.tagName === 'P');
    if(!ps.length){ const r = R(el); if(r.length) out.push({ s:'cit', runs:r, el }); return; }
    ps.forEach(p => { const r = R(p); if(r.length) out.push({ s:'cit', runs:r, el:p }); });
  }
  function blocos(no){
    for(const c of Array.from(no.childNodes)){
      if(c.nodeType === 3){ if(c.data.trim()) out.push({ s:'corpo', runs:[{ t:c.data.trim() }], ind:semRecuo(c.data) ? 0 : RECUO, el:null }); continue; }
      if(c.nodeType !== 1) continue;
      const t = c.tagName, cl = c.classList;
      if(cl && cl.contains('naoimp')) continue;
      if(t === 'H1'){ const r = R(c, { b:true, i:false, u:false }); if(r.length) out.push({ s:'tit', runs:r, el:c }); continue; }
      if(/^H[2-6]$/.test(t)){ const r = R(c, { b:true, i:false, u:false }); if(r.length) out.push({ s: t === 'H2' ? 'cap' : 'sub', runs:r, el:c }); continue; }
      if(t === 'P'){
        const r = R(c);
        if(cl.contains('dt')){ out.push({ s:'dt', runs:r, el:c }); continue; }
        if(!r.length) continue;
        const al = (c.style && c.style.textAlign) || null;
        const s = cl.contains('id') ? 'ident' : cl.contains('bl') ? 'bl' : cl.contains('alin') ? 'alin' : 'corpo';
        const b = { s, runs:r, al: s === 'corpo' || s === 'alin' ? al : null, el:c };
        if(s === 'corpo') b.ind = al && al !== 'justify' ? 0 : semRecuo(r.map(x => x.t || '').join('')) ? 0 : RECUO;
        out.push(b); continue;
      }
      if(t === 'UL' || t === 'OL'){ lista(c, 1); continue; }
      if(t === 'TABLE'){ tabela(c); continue; }
      if(t === 'HR'){ if(cl.contains('quebra') || cl.contains('qp')) out.push({ s:'quebra', el:c }); continue; }
      if(t === 'BLOCKQUOTE'){ citacao(c); continue; }
      if(t === 'DIV' || t === 'SECTION'){ blocos(c); continue; }
      const r = R({ childNodes:[c] }); if(r.length) out.push({ s:'corpo', runs:r, ind:RECUO, el:c });
    }
  }
  blocos(d);
  return out;
}
/* regras de espaço entre as primeiras linhas (título, identificação, bloco de cabeçalho) */
function ajustarSequencia(bl){
  const caixa = b => Object.assign({}, b, { runs: b.runs.map(r => r.t != null && !r.sup ? Object.assign({}, r, { t: r.t.toLocaleUpperCase('pt-BR') }) : r) });
  const out = bl.map(b => (ESTILOS[b.s] || {}).caixa ? caixa(b) : Object.assign({}, b));
  for(let i = 0; i < out.length; i++){
    const b = out[i], nx = out[i + 1];
    if(b.s === 'tit') b.af = nx && nx.s === 'ident' ? 0 : nx && nx.s === 'dt' ? 22 : 40;
    if(b.s === 'ident' && nx && nx.s === 'dt') b.af = 22;
    if(b.s === 'bl' && nx && nx.s !== 'bl') nx.bf = Math.max(nx.bf || ESTILOS[nx.s] && ESTILOS[nx.s].bf || 0, 12);
  }
  return out;
}
function blocosSimples(src){ return htmlParaBlocos(src).map(b => b.s === 'tit' ? Object.assign({}, b, { s:'tdoc' }) : b.s === 'corpo' ? Object.assign({}, b, { ind:0 }) : b); }

/* fecho automático: local e data + assinatura (nome e cargo em negrito, centralizados) */
function fechoAtivo(d){ return !!d && d.kind === 'texto' && !(d.sig && d.sig.sem); }
function blocosFecho(d, els){
  const s = d.sig || {}, pes = s.pessoa ? pessoaPorId(s.pessoa) : null, out = [];
  els = els || {};
  if(!docTemDataNoTopo(d)){
    const runs = s.modo === 'fisica' ? [{ t:'Ilhéus, ' + dataExtenso(s.data) + '.' }] : [{ t:'Ilhéus, ' }, { t:'data da assinatura eletrônica', i:true }, { t:'.' }];
    out.push({ s:'loc', runs, el:els.loc || null });
  }
  out.push({ s:'sig1', runs:[{ t: pes ? titleCase(pes.nome) : '[Signatário]' }], el:els.n1 || null });
  if(pes && pes.cargo) out.push({ s:'sig2', runs:[{ t:pes.cargo }], el:els.n2 || null });
  return out;
}
function docTemDataNoTopo(d){ return /class="dt"/.test(d.html || '') || d.tipo === 'of'; }
function runsDataTopo(d){ const s = d.sig || {}; return s.modo === 'fisica' ? [{ t:'Ilhéus, ' + dataExtenso(s.data) + '.' }] : [{ t:'Ilhéus, ' }, { t:'data da assinatura eletrônica', i:true }, { t:'.' }]; }
function blocosDoc(src, d, ctx, els){
  let bl = htmlParaBlocos(src, ctx);
  if(d) bl = bl.map(b => b.s === 'dt' ? Object.assign({}, b, { runs:runsDataTopo(d) }) : b);
  bl = bl.filter(b => b.s !== 'dt' || b.runs.length);
  bl = ajustarSequencia(bl);
  if(fechoAtivo(d)) bl = bl.concat(blocosFecho(d, els));
  return bl;
}

/* ---------- quebra de linhas ---------- */
function fonteDe(F, run, estilo){ const b = run.b || estilo.f === 'b' || estilo.f === 'bi', i = run.i || estilo.f === 'i' || estilo.f === 'bi'; return b && i ? F.bi : b ? F.b : i ? F.i : F.r; }
function palavras(runs, F, size, estilo){
  const out = []; let atual = null;
  const fecha = () => { if(atual && atual.parts.length) out.push(atual); atual = null; };
  for(const r of runs){
    if(r.br){ fecha(); out.push({ br:true }); continue; }
    const font = fonteDe(F, r, estilo), sz = r.sup ? size * 0.62 : size;
    for(const p of winAnsi(r.t).split(/( +)/)){
      if(!p) continue;
      if(/^ +$/.test(p)){ fecha(); continue; }
      atual = atual || { parts:[], w:0 };
      const w = largura(font, p, sz);
      atual.parts.push({ t:p, font, u:!!r.u, w, sz: r.sup ? sz : null, dy: r.sup ? size * 0.34 : 0, nota: r.nota || null }); atual.w += w;
    }
  }
  fecha();
  return out;
}
function quebrar(pals, larg, F, size){
  const esp = largura(F.r, ' ', size);
  const linhas = []; let lin = { ws:[], w:0 };
  const fecha = forcada => { linhas.push({ ws:lin.ws, w:lin.w, fim:forcada, sp:esp }); lin = { ws:[], w:0 }; };
  for(const p of pals){
    if(p.br){ fecha(true); continue; }
    let pw = p;
    while(pw.w > larg && pw.parts.length){
      if(lin.ws.length) fecha(false);
      const cab = { parts:[], w:0 }, rest = { parts:[], w:0 };
      let cheio = false;
      for(const part of pw.parts){
        if(cheio){ rest.parts.push(part); rest.w += part.w; continue; }
        let t = '';
        const psz = part.sz || size;
        for(const ch of part.t){ const w2 = largura(part.font, t + ch, psz); if(cab.w + w2 > larg && (cab.w > 0 || t)){ cheio = true; break; } t += ch; }
        if(t){ const w = largura(part.font, t, psz); cab.parts.push(Object.assign({}, part, { t, w })); cab.w += w; }
        if(t.length < part.t.length){ const r = part.t.slice(t.length); const w = largura(part.font, r, psz); rest.parts.push(Object.assign({}, part, { t:r, w })); rest.w += w; cheio = true; }
      }
      if(!cab.parts.length) break;
      lin.ws.push(cab); lin.w = cab.w; fecha(false);
      pw = rest;
    }
    if(!pw.parts.length) continue;
    if(lin.ws.length && lin.w + esp + pw.w > larg + 0.01) fecha(false);
    lin.w += (lin.ws.length ? esp : 0) + pw.w; lin.ws.push(pw);
  }
  if(lin.ws.length || !linhas.length) fecha(true);
  linhas.forEach(l => { l.notas = []; l.ws.forEach(w => w.parts.forEach(p => { if(p.nota) l.notas.push(p.nota); })); });
  return linhas;
}
function posLinha(l, x, larg, size, al, y, ind1){
  const n = l.ws.length; let gap = l.sp, x0 = x + (ind1 || 0), lw = larg - (ind1 || 0);
  if(al === 'justify' && !l.fim && n > 1) gap = (lw - (l.w - l.sp * (n - 1))) / (n - 1);
  else if(al === 'center') x0 = x + (larg - l.w) / 2;
  else if(al === 'right') x0 = x + larg - l.w;
  let cx = x0; const ws = [];
  for(const w of l.ws){ ws.push({ x:cx, parts:w.parts }); cx += w.w + gap; }
  return { k:'ln', y, size, ws, notas:l.notas };
}
/* recuo só na 1ª linha: quebra a 1ª linha com a largura menor */
function quebrarComRecuo(pals, larg, F, size, ind1){
  if(!ind1) return quebrar(pals, larg, F, size);
  const l1 = quebrar(pals, larg - ind1, F, size);
  if(l1.length <= 1) return l1;
  const usadas = l1[0].ws.length;
  let conta = 0, i = 0;
  for(; i < pals.length && conta < usadas; i++) if(!pals[i].br) conta++;
  const resto = quebrar(pals.slice(i), larg, F, size);
  return [l1[0]].concat(resto);
}
function medir(b, F, G){
  if(b.s === 'quebra') return { tipo:'quebra' };
  if(b.s === 'tab') return medirTabela(b, F, G);
  const e = Object.assign({}, ESTILOS[b.s] || ESTILOS.corpo);
  if(b.bf != null) e.bf = b.bf;
  if(b.af != null) e.af = b.af;
  const size = e.size, lh = size * K_ALT * (e.lf || 1.15);
  const blocoInd = b.s === 'corpo' ? 0 : (b.ind != null ? b.ind : (e.ind || 0));
  const ind1 = b.s === 'corpo' ? (b.ind || 0) : 0;
  const larg = G.CW - blocoInd;
  const ls = quebrarComRecuo(palavras(b.runs, F, size, e), larg, F, size, ind1);
  return { tipo:'p', size, lh, x:G.L + blocoInd, w:larg, ind1, ls, bf:e.bf, af:e.af, kn:!!(e.kn || b.kn), kl:!!(e.kl || b.kl), h:ls.length * lh, al:b.al || e.al };
}
function medirTabela(b, F, G){
  const size = b.size || 10, pad = 3.5, lh = size * K_ALT * 1.12;
  const nc = Math.max(...b.rows.map(r => r.cels.length));
  const nat = Array(nc).fill(0), minw = Array(nc).fill(0);
  for(const r of b.rows) r.cels.forEach((c, i) => {
    const pals = palavras(c.runs, F, size, { f: r.hdr ? 'b' : null });
    let tot = 0, maior = 0;
    for(const p of pals) if(!p.br){ tot += p.w + largura(F.r, ' ', size); maior = Math.max(maior, p.w); }
    nat[i] = Math.max(nat[i], Math.min(tot, 260)); minw[i] = Math.max(minw[i], Math.min(maior, 90));
  });
  let ws = nat.map((n, i) => Math.max(n, minw[i], 24) + 2 * pad);
  const soma = ws.reduce((a, x) => a + x, 0);
  ws = ws.map(w => w * G.CW / soma);
  const rows = b.rows.map(r => {
    let x = G.L, hmax = 0; const cels = [];
    for(let i = 0; i < nc; i++){
      const c = r.cels[i] || { runs:[] };
      const ls = quebrar(palavras(c.runs, F, size, { f: r.hdr ? 'b' : null }), ws[i] - 2 * pad, F, size);
      const th = ls.length * lh; hmax = Math.max(hmax, th);
      cels.push({ x, w:ws[i], ls, th, al:c.al || 'left' }); x += ws[i];
    }
    return { hdr:r.hdr, cels, h:hmax + 2 * pad, fill: r.hdr ? 'F1F3F5' : null };
  });
  const hdrH = rows.filter(r => r.hdr).reduce((a, r) => a + r.h, 0);
  return { tipo:'tab', size, lh, pad, rows, hdrH, bf:6, af:6, kn:false, kl:false };
}
/* notas de rodapé: Times 10, a largura toda */
function medirNotas(textos, F, G){
  return textos.map((t, i) => {
    const size = 10, lh = size * K_ALT;
    const ls = quebrar(palavras([{ t:String(i + 1), sup:true }, { t:' ' + t }], F, size, {}), G.CW, F, size);
    return { ls, lh, size, h:ls.length * lh + 2 };
  });
}
function paginar(medidos, G, opt){
  const paginas = []; let pg = null, y = 0, topo = true, n = 0, ultAf = 0;
  const notas = opt.notas || [];
  const antes = m => opt.colapsar ? Math.max(0, m.bf - ultAf) : m.bf;
  const nova = () => {
    pg = { itens:[], notas:[], notasH:0 }; paginas.push(pg); topo = true; ultAf = 0;
    if(opt.timbre === 'todas' || (opt.timbre === 'primeira' && n === 0)) pg.timbre = true;
    y = pg.timbre ? T_TIMBRE : G.T; n++;
  };
  const limite = () => G.H - G.B - (pg.notasH ? pg.notasH + 9 : 0);
  const resta = () => limite() - y;
  const alt = () => G.H - G.B - (pg && pg.timbre ? T_TIMBRE : G.T);
  function precisa(i){
    let tot = 0;
    for(let j = i; j < medidos.length && j - i < 14; j++){
      const m = medidos[j];
      if(m.tipo === 'quebra') break;
      tot += (j === i && topo) ? 0 : (j === i ? antes(m) : (opt.colapsar ? Math.max(0, m.bf - medidos[j - 1].af) : m.bf));
      if(m.tipo === 'tab'){ const r1 = m.rows.find(r => !r.hdr); tot += m.hdrH + (r1 ? r1.h : 0); break; }
      if(m.kn && j + 1 < medidos.length){ tot += m.h + m.af; continue; }
      tot += m.kl ? m.h : m.lh * Math.min(m.ls.length, 2);
      break;
    }
    return tot;
  }
  const baseY = m => y + (m.lh - m.size * K_ALT) / 2 + m.size * K_ASC;
  function extraNotas(l){
    const novas = (l.notas || []).filter(k => !pg.notas.includes(k));
    if(!novas.length) return { novas, h:0 };
    return { novas, h: novas.reduce((a, k) => a + (opt.notasM[k - 1] ? opt.notasM[k - 1].h : 0), 0) + (pg.notasH ? 0 : 9) };
  }
  function paragrafo(m){
    if(!topo) y += antes(m);
    const L = m.ls.length; let p = 0;
    while(p < L){
      const falta = L - p, cabe = Math.floor((resta() + 0.01) / m.lh);
      let k;
      if(cabe >= falta) k = falta;
      else {
        k = cabe;
        if(m.kl && falta * m.lh <= alt() && !topo) k = 0;
        if(p === 0 && k === 1 && L > 1) k = 0;
        if(falta - k === 1 && k > 1) k -= 1;
        if(k <= 0 && topo) k = Math.max(1, cabe);
      }
      let j = 0;
      for(; j < k; j++){
        const l = m.ls[p + j], ex = extraNotas(l);
        if(ex.h && y + m.lh + ex.h > G.H - G.B - (pg.notasH ? pg.notasH + 9 : 0) && !(topo && j === 0)) break;
        if(ex.novas.length){ ex.novas.forEach(nk => { pg.notas.push(nk); pg.notasH += opt.notasM[nk - 1] ? opt.notasM[nk - 1].h : 0; }); }
        const it = posLinha(l, m.x, m.w, m.size, m.al, baseY(m), p + j === 0 ? m.ind1 : 0); it.bi = m.bi; it.top = y; it.bot = y + m.lh; pg.itens.push(it); y += m.lh;
        topo = false;
      }
      p += j;
      if(p < L) nova();
    }
    y += m.af; ultAf = m.af;
  }
  function linhaTab(r, m, ri){
    const x0 = r.cels[0].x, x1 = r.cels[r.cels.length - 1].x + r.cels[r.cels.length - 1].w;
    if(r.fill) pg.itens.push({ k:'rect', x:x0, y, w:x1 - x0, h:r.h, fill:r.fill, bi:m.bi, ri, top:y, bot:y + r.h });
    if(r.hdr || topoTab){ pg.itens.push({ k:'hl', x0, x1, y, c:'9AA1AA', lw:0.8, bi:m.bi, ri }); topoTab = false; }
    pg.itens.push({ k:'hl', x0, x1, y:y + r.h, c: r.hdr ? '9AA1AA' : 'D5D9DE', lw: r.hdr ? 0.8 : 0.5, bi:m.bi, ri, top:y, bot:y + r.h });
    for(const c of r.cels){
      let yy = y + m.pad;
      for(const l of c.ls){ const it = posLinha(l, c.x + m.pad, c.w - 2 * m.pad, m.size, c.al, yy + (m.lh - m.size * K_ALT) / 2 + m.size * K_ASC); it.bi = m.bi; it.ri = ri; pg.itens.push(it); yy += m.lh; }
    }
    y += r.h;
  }
  let topoTab = false;
  function tabela(m){
    if(!topo) y += antes(m);
    const cab = m.rows.filter(r => r.hdr);
    topoTab = true;
    m.rows.forEach((r, ri) => {
      if(!r.hdr && r.h > resta() && !topo){ nova(); topoTab = true; cab.forEach(c => linhaTab(c, m, -1)); }
      linhaTab(r, m, ri); topo = false;
    });
    y += m.af; ultAf = m.af;
  }
  nova();
  medidos.forEach((m, i) => {
    if(m.tipo === 'quebra'){ if(!topo) nova(); else pg.forcada = true; return; }
    const need = precisa(i);
    if(!topo && need > resta() && need <= alt()) nova();
    if(m.tipo === 'tab') tabela(m); else paragrafo(m);
  });
  return paginas;
}

/* ---------- desenho ---------- */
const cor = hex => { const a = parseInt(hex, 16); return PDFLib.rgb((a >> 16 & 255) / 255, (a >> 8 & 255) / 255, (a & 255) / 255); };
const TIMBRE_LINHAS = ['ESTADO DA BAHIA', 'PREFEITURA MUNICIPAL DE ILHÉUS'];
/* cabeçalho: brasão, duas linhas em negrito do mesmo tamanho e um traço com a largura do nome da prefeitura */
const TB = { top:28, bh:56, gap:5, size:10.5, lh:13.1, trGap:3, trW:1 };
TB.bw = TB.bh * 43 / 46.7;
const timbreLinhas = () => settings.timbre === 'brasao' ? [] : TIMBRE_LINHAS;
function desenharTimbre(page, R, G){
  const H = page.getHeight(), cx = G.L + G.CW / 2, ls = timbreLinhas();
  page.drawImage(R.IMG.brasao, { x:cx - TB.bw / 2, y:H - TB.top - TB.bh, width:TB.bw, height:TB.bh });
  let yTop = TB.top + TB.bh + TB.gap;
  ls.forEach(t => { const w = largura(R.F.b, t, TB.size); page.drawText(winAnsi(t), { x:cx - w / 2, y:H - (yTop + (TB.lh - TB.size * K_ALT) / 2 + TB.size * K_ASC), size:TB.size, font:R.F.b }); yTop += TB.lh; });
  if(ls.length){ const wr = largura(R.F.b, ls[ls.length - 1], TB.size), yr = H - (yTop + TB.trGap); page.drawLine({ start:{ x:cx - wr / 2, y:yr }, end:{ x:cx + wr / 2, y:yr }, thickness:TB.trW, color:PDFLib.rgb(0, 0, 0) }); }
}
/* tarja no pé da folha: margem a margem, Helvetica 7,2, texto corrido justificado */
function medirTarja(runs, R, G){
  const F = { r:R.F.h, b:R.F.hb, i:R.F.h, bi:R.F.hb }, size = 7.2, pad = 5.5;
  const ls = quebrar(palavras(runs, F, size, {}), G.CW - 2 * pad, F, size);
  const lh = size * 1.3;
  return { ls, lh, size, pad, h:ls.length * lh + 6 };
}
function desenharTarja(page, T, G){
  const H = page.getHeight(), x = G.L, w = G.CW, yb = 12;
  page.drawRectangle({ x, y:yb, width:w, height:T.h, color:cor('FAFBFC'), borderColor:cor('CCD1D7'), borderWidth:0.5 });
  let yy = H - (yb + T.h) + 3;
  for(const l of T.ls){
    const it = posLinha(l, x + T.pad, w - 2 * T.pad, T.size, 'justify', yy + T.size * 0.93, 0);
    for(const ww of it.ws){ let cx = ww.x; for(const p of ww.parts){ page.drawText(p.t, { x:cx, y:H - it.y, size:T.size, font:p.font, color:cor('333333') }); cx += p.w; } }
    yy += T.lh;
  }
}
function desenharPagina(page, pg, R, G, extra){
  const H = G.H;
  if(pg.timbre) desenharTimbre(page, R, G);
  const fontReal = f => R.F[f === R.MF.b ? 'b' : f === R.MF.i ? 'i' : f === R.MF.bi ? 'bi' : f === R.MF.h ? 'h' : f === R.MF.hb ? 'hb' : 'r'];
  const linha = (it) => {
    for(const w of it.ws){
      let x = w.x;
      for(const p of w.parts){
        page.drawText(p.t, { x, y:H - it.y + (p.dy || 0), size:p.sz || it.size, font:fontReal(p.font) });
        if(p.u) page.drawLine({ start:{ x, y:H - it.y - 1.6 }, end:{ x:x + p.w, y:H - it.y - 1.6 }, thickness:0.6, color:PDFLib.rgb(0, 0, 0) });
        x += p.w;
      }
    }
  };
  for(const it of pg.itens){
    if(it.k === 'rect'){ page.drawRectangle({ x:it.x, y:H - it.y - it.h, width:it.w, height:it.h, color: it.fill ? cor(it.fill) : undefined, borderColor: it.stroke ? cor(it.stroke) : undefined, borderWidth: it.stroke ? it.lw : 0 }); continue; }
    if(it.k === 'hl'){ page.drawLine({ start:{ x:it.x0, y:H - it.y }, end:{ x:it.x1, y:H - it.y }, thickness:it.lw, color:cor(it.c) }); continue; }
    linha(it);
  }
  /* notas de rodapé desta folha */
  if(pg.notas && pg.notas.length && extra && extra.notasM){
    let y = G.H - G.B - pg.notasH;
    page.drawLine({ start:{ x:G.L, y:H - y + 4 }, end:{ x:G.L + G.CW * 0.34, y:H - y + 4 }, thickness:0.5, color:PDFLib.rgb(0, 0, 0) });
    for(const k of pg.notas){
      const nm = extra.notasM[k - 1]; if(!nm) continue;
      nm.ls.forEach((l, j) => {
        const it = posLinha(l, G.L, G.CW, nm.size, 'justify', y + 1 + j * nm.lh + nm.size * K_ASC, 0);
        linha(it);
      });
      y += nm.h;
    }
  }
  if(extra && extra.tarja) desenharTarja(page, extra.tarja, G);
  if(extra && extra.carimboImg){
    const im = extra.carimboImg, bw = 64, bh = 40, k = Math.min(bw / im.width, bh / im.height), w = im.width * k, h = im.height * k;
    page.drawImage(im, { x:G.W - 3 - w, y:8 + (bh - h) / 2, width:w, height:h });
  }
}
async function recursos(pdf, need = {}){
  const R = { F: await fontes(pdf), MF: await fontesMedida(), IMG:{} };
  if(need.brasao) R.IMG.brasao = await pdf.embedJpg(b64u8(B64_BRASAO));
  if(need.carimbo === 'seinfra') R.IMG.carimbo = await pdf.embedPng(b64u8(B64_CARIMBO_SEINFRA));
  if(need.carimbo === 'licitacao') R.IMG.lic = await pdf.embedPng(b64u8(B64_CARIMBO_LIC));
  return R;
}
function geo(page){
  const a = page.getCropBox ? page.getCropBox() : page.getMediaBox();
  const W = a.width, H = a.height, R = (((page.getRotation().angle || 0) % 360) + 360) % 360;
  return {
    R, VW: R === 90 || R === 270 ? H : W, VH: R === 90 || R === 270 ? W : H,
    u(x, y){ let p; if(R === 90) p = { x:y, y:x }; else if(R === 180) p = { x:W - x, y }; else if(R === 270) p = { x:W - y, y:H - x }; else p = { x, y:H - y }; return { x:p.x + a.x, y:p.y + a.y }; }
  };
}
/* brasão pequeno sobre páginas de PDF (quando você marca "brasão" numa página escaneada) */
function timbreEmPagina(page, R){
  const g = geo(page), rot = PDFLib.degrees(g.R), bw = 43, bh = 46.7, top = 14.17, cx = g.VW / 2;
  const p = g.u(cx - bw / 2, top + bh);
  page.drawImage(R.IMG.brasao, { x:p.x, y:p.y, width:bw, height:bh, rotate:rot });
}
/* Carimbo e número sempre no canto superior direito da folha EM PÉ.
   Página deitada (planilha): a página continua deitada; só o carimbo gira. */
function quadroEmPe(g, modo){
  if(!(g.VW > g.VH * 1.02)) return { PW:g.VW, PH:g.VH, map:(x, y) => g.u(x, y), rot:g.R };
  if(modo === 'dir') return { PW:g.VH, PH:g.VW, map:(px, py) => g.u(py, g.VH - px), rot:g.R + 90 };
  return { PW:g.VH, PH:g.VW, map:(px, py) => g.u(g.VW - py, px), rot:g.R - 90 };
}
function carimbar(pdf, R, opt){
  const tipo = opt.carimbo || 'nenhum';
  if(tipo === 'nenhum' && !opt.numerar) return;
  const ini = parseInt(opt.inicial, 10) || 1;
  const C = tipo === 'licitacao' ? { img:R.IMG.lic, w:66.3, h:66.5, cx:38.15, by:56.1 } : { img:R.IMG.carimbo, w:66.3, h:67.7, cx:0.504 * 66.3, by:14.1 + 0.504 * 67.7 + 5.3 };
  const nums = opt.numeros || null;
  pdf.getPages().forEach((page, i) => {
    const n = String(nums && nums[i] != null ? nums[i] : ini + i), Q = quadroEmPe(geo(page), opt.deitada || settings.deitada), rot = PDFLib.degrees(Q.rot);
    if(tipo !== 'nenhum'){
      const x = Q.PW - 19.4 - C.w, p = Q.map(x, 14.1 + C.h);
      page.drawImage(C.img, { x:p.x, y:p.y, width:C.w, height:C.h, rotate:rot });
      if(opt.numerar){ const w = largura(R.F.h, n, 15), q = Q.map(x + C.cx - w / 2, C.by); page.drawText(n, { x:q.x, y:q.y, size:15, font:R.F.h, rotate:rot }); }
    } else {
      const t = 'Fls. ' + n, w = largura(R.F.hb, t, 10), q = Q.map(Q.PW - 19.4 - w, 30);
      page.drawText(t, { x:q.x, y:q.y, size:10, font:R.F.hb, rotate:rot });
    }
  });
}
const libsPdf = () => !!window.PDFLib;
function needLibs(pdfjs){
  if(!window.PDFLib || (pdfjs && !window.pdfjsLib)){ toast('As ferramentas de PDF ainda estão carregando. Verifique a internet e tente de novo.'); return false; }
  return true;
}
const modoTimbre = bras => bras === 'nenhum' ? 'nenhuma' : bras === 'primeira' ? 'primeira' : 'todas';

/* Diagramação sem gerar arquivo: nº de páginas e onde cada página começa (para a mesa).
   src: o corpo do texto (elemento ou HTML); d: o documento; els: elementos do fecho na tela */
async function diagramarTexto(src, d, els){
  const MF = await fontesMedida(), G = PAG.retrato;
  const ctx = { notas:[] };
  const bl = d && d.raw ? blocosSimples(src) : blocosDoc(src, d, ctx, els);
  const medidos = bl.map((b, i) => { const m = medir(b, MF, G); m.bi = i; return m; });
  if(!medidos.length) return { n:1, quebras:[], notas:[] };
  const paginas = paginar(medidos, G, { timbre:modoTimbre(d && d.bras), colapsar:true, notas:ctx.notas, notasM:medirNotas(ctx.notas, MF, G) });
  const quebras = [];
  const visto = {};
  paginas.forEach((pg, k) => {
    const primeiro = pg.itens.find(it => (it.k === 'ln' || it.k === 'rect' || it.k === 'hl') && it.ri !== -1);
    if(k > 0){
      const b = primeiro ? bl[primeiro.bi] : null;
      const linhasAntes = primeiro ? (visto[primeiro.bi] || 0) : 0;
      const tab = b && b.s === 'tab';
      quebras.push({ el: b && b.el, linhas: primeiro && primeiro.k === 'ln' && !tab ? linhasAntes : 0, ri: tab ? primeiro.ri : null, lh: primeiro && medidos[primeiro.bi] && medidos[primeiro.bi].lh, vazia:!primeiro });
    }
    pg.itens.forEach(it => { if(it.k === 'ln') visto[it.bi] = (visto[it.bi] || 0) + 1; });
  });
  return { n:paginas.length, quebras, notas:ctx.notas };
}
async function imgDeDataURL(pdf, url){
  if(!url) return null;
  try{ const m = /^data:image\/(png|jpe?g);base64,(.*)$/.exec(url); if(!m) return null; const u8 = b64u8(m[2]); return m[1] === 'png' ? await pdf.embedPng(u8) : await pdf.embedJpg(u8); }catch(e){ return null; }
}
const PDFGen = {
  /* texto → PDF. o = { doc, proc, bras, raw, title } */
  async texto(src, o = {}){
    const pdf = await PDFLib.PDFDocument.create();
    const d = o.doc || null, bras = o.bras || (d && d.bras) || 'todas';
    const temBras = bras !== 'nenhum';
    const R = await recursos(pdf, { brasao:temBras });
    const G = PAG.retrato, ctx = { notas:[] };
    const bl = o.raw ? blocosSimples(src) : blocosDoc(src, d, ctx);
    const medidos = bl.map((b, i) => { const m = medir(b, R.MF, G); m.bi = i; return m; });
    if(!medidos.length) throw new Error('vazio');
    const notasM = medirNotas(ctx.notas, R.MF, G);
    const paginas = paginar(medidos, G, { timbre:modoTimbre(bras), colapsar:true, notas:ctx.notas, notasM });
    const extra = { notasM };
    if(!o.raw && d){
      const runs = tarjaRuns(d, o.proc || null);
      if(runs && runs.length) extra.tarja = medirTarja(runs, R, G);
    }
    for(const pg of paginas){ const page = pdf.addPage([G.W, G.H]); desenharPagina(page, pg, R, G, extra); }
    if(o.title) pdf.setTitle(o.title);
    pdf.setCreator('Panda'); pdf.setProducer('Panda');
    return { bytes: await pdf.save(), pages: paginas };
  },
  async countPages(bytes){ const p = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption:true, updateMetadata:false }); return p.getPageCount(); },
  /* copia as páginas de um arquivo (com giro, brasão, retiradas, brancas) para `out` */
  async appendFile(out, f, R, only){
    const pl = (only || f.pl).filter(e => !e.d);
    const src = pl.some(e => e.s >= 0) ? await PDFLib.PDFDocument.load(f.bytes, { ignoreEncryption:true, updateMetadata:false }) : null;
    const idx = pl.filter(e => e.s >= 0).map(e => e.s);
    const copied = idx.length ? await out.copyPages(src, idx) : [];
    let k = 0;
    for(const e of pl){
      let page;
      if(e.s < 0) page = out.addPage([PAG.retrato.W, PAG.retrato.H]);
      else { page = copied[k++]; out.addPage(page); }
      if(e.r) page.setRotation(PDFLib.degrees((((page.getRotation().angle || 0) + e.r) % 360 + 360) % 360));
      if(e.b) timbreEmPagina(page, R);
    }
    return pl.length;
  },
  async fileBytes(f, only){
    const out = await PDFLib.PDFDocument.create();
    const pl = (only || f.pl).filter(e => !e.d);
    if(!pl.length) throw new Error('sem páginas');
    const R = await recursos(out, { brasao: pl.some(e => e.b) });
    await PDFGen.appendFile(out, f, R, pl);
    out.setTitle(f.name || ''); out.setCreator('Panda'); out.setProducer('Panda');
    return out.save();
  },
  /* itens: {kind:'file', f} | {kind:'texto', html, bras, doc, proc} */
  async merge(items, opt, avisar){
    avisar = avisar || (() => {});
    const out = await PDFLib.PDFDocument.create();
    const temBras = items.some(it => it.kind === 'file' && it.f.pl.some(e => e.b && !e.d));
    const R = await recursos(out, { brasao:temBras, carimbo:opt.carimbo });
    const falhas = [];
    for(let i = 0; i < items.length; i++){
      const it = items[i];
      avisar('Juntando ' + (i + 1) + ' de ' + items.length + '…');
      await sleep(0);
      try {
        if(it.kind === 'texto'){
          const t = await PDFGen.texto(it.html, { bras:it.bras, doc:it.doc, proc:it.proc, raw:it.raw });
          const src = await PDFLib.PDFDocument.load(t.bytes);
          (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
        } else await PDFGen.appendFile(out, it.f, R);
      } catch(e){ console.warn(e); falhas.push(it.name || (it.f && it.f.name) || 'arquivo'); }
    }
    if(!out.getPageCount()) throw new Error('Nenhuma página para juntar.');
    carimbar(out, R, opt || {});
    out.setTitle(opt.titulo || ''); out.setCreator('Panda'); out.setProducer('Panda');
    return { bytes: await out.save(), paginas: out.getPageCount(), falhas };
  },
  async separate(items, opt, avisar){
    const zip = new JSZip();
    let n = parseInt(opt.inicial, 10) || 1;
    for(let i = 0; i < items.length; i++){
      const it = items[i];
      const r = await PDFGen.merge([it], Object.assign({}, opt, { inicial:n }), () => avisar && avisar('Preparando ' + (i + 1) + ' de ' + items.length + '…'));
      n += r.paginas;
      zip.file(String(i + 1).padStart(2, '0') + ' ' + safeName(it.name || (it.f && it.f.name), '.pdf'), r.bytes);
    }
    return zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{ level:6 } });
  },
  async imageToPdf(bytes, name){
    const pdf = await PDFLib.PDFDocument.create();
    let img;
    if(/\.png$/i.test(name)) img = await pdf.embedPng(bytes);
    else if(/\.jpe?g$/i.test(name)) img = await pdf.embedJpg(bytes);
    else {
      const bmp = await createImageBitmap(new Blob([bytes]));
      const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height; cv.getContext('2d').drawImage(bmp, 0, 0);
      const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.88));
      img = await pdf.embedJpg(new Uint8Array(await b.arrayBuffer()));
    }
    const G = img.width > img.height ? PAG.paisagem : PAG.retrato;
    const page = pdf.addPage([G.W, G.H]);
    const m = 20, k = Math.min((G.W - 2 * m) / img.width, (G.H - 2 * m) / img.height);
    page.drawImage(img, { x:(G.W - img.width * k) / 2, y:(G.H - img.height * k) / 2, width:img.width * k, height:img.height * k });
    return new Uint8Array(await pdf.save());
  }
};

/* =====================================================================
   Texto colado → HTML (limpeza de HTML e Markdown do Claude)
   ===================================================================== */
function limparHTML(html){
  const d = new DOMParser().parseFromString(html, 'text/html');
  const raiz = document.createElement('div');
  const BLOCO = /^(P|DIV|H[1-6]|UL|OL|LI|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|BLOCKQUOTE|PRE|SECTION|ARTICLE|HEADER|FOOTER|MAIN)$/;
  function estilo(el){
    const st = (el.getAttribute('style') || '').toLowerCase();
    return { b:/font-weight\s*:\s*(bold|[6-9]00)/.test(st), naoB:/font-weight\s*:\s*(normal|[1-4]00)/.test(st), i:/font-style\s*:\s*italic/.test(st), u:/text-decoration[^;]*underline/.test(st) };
  }
  function inline(no, destino){
    for(const c of Array.from(no.childNodes)){
      if(c.nodeType === 3){ destino.append(document.createTextNode(c.data.replace(/[\t\r\n]+/g, ' '))); continue; }
      if(c.nodeType !== 1) continue;
      const t = c.tagName;
      if(/^(SCRIPT|STYLE|META|TITLE|LINK|IMG|SVG|BUTTON|INPUT)$/.test(t)) continue;
      if(t === 'BR'){ destino.append(document.createElement('br')); continue; }
      const st = estilo(c);
      let alvo = destino, wrap = null;
      if((t === 'B' || t === 'STRONG') && !st.naoB) wrap = 'strong';
      else if(t === 'I' || t === 'EM') wrap = 'em';
      else if(t === 'U') wrap = 'u';
      else if(t === 'SPAN' || t === 'FONT'){ if(st.b) wrap = 'strong'; else if(st.i) wrap = 'em'; else if(st.u) wrap = 'u'; }
      if(wrap){ const w = document.createElement(wrap); destino.append(w); alvo = w; }
      if(BLOCO.test(t)){ if(destino.lastChild && destino.lastChild.nodeName !== 'BR') destino.append(document.createElement('br')); }
      inline(c, alvo);
    }
  }
  function blocos(no, destino){
    let p = null;
    const fechaP = () => { if(p && p.textContent.trim()) destino.append(p); p = null; };
    for(const c of Array.from(no.childNodes)){
      if(c.nodeType === 3){ if(!c.data.trim()){ if(p) p.append(' '); continue; } p = p || document.createElement('p'); p.append(document.createTextNode(c.data.replace(/[\t\r\n]+/g, ' '))); continue; }
      if(c.nodeType !== 1) continue;
      const t = c.tagName;
      if(/^(SCRIPT|STYLE|META|TITLE|LINK|HEAD|IMG|SVG|BUTTON|INPUT|NAV)$/.test(t)) continue;
      if(t === 'HR'){ fechaP(); continue; }
      if(/^H[1-6]$/.test(t)){ fechaP(); const x = document.createElement(t === 'H1' ? 'h2' : t.toLowerCase()); inline(c, x); if(x.textContent.trim()) destino.append(x); continue; }
      if(t === 'P' || t === 'PRE'){ fechaP(); const x = document.createElement('p'); inline(c, x); if(x.textContent.trim()) destino.append(x); continue; }
      if(t === 'UL' || t === 'OL'){ fechaP(); destino.append(lista(c)); continue; }
      if(t === 'TABLE'){ fechaP(); destino.append(tabela(c)); continue; }
      if(/^(DIV|BLOCKQUOTE|SECTION|ARTICLE|HEADER|FOOTER|MAIN|BODY|CENTER)$/.test(t) || (t === 'B' && estilo(c).naoB)){
        if(Array.from(c.children).some(k => BLOCO.test(k.tagName))){ fechaP(); blocos(c, destino); }
        else { fechaP(); const x = document.createElement('p'); inline(c, x); if(x.textContent.trim()) destino.append(x); }
        continue;
      }
      p = p || document.createElement('p'); inline({ childNodes:[c] }, p);
    }
    fechaP();
  }
  function lista(el){
    const x = document.createElement(el.tagName.toLowerCase());
    for(const li of Array.from(el.children)){
      if(li.tagName !== 'LI') continue;
      const y = document.createElement('li');
      for(const c of Array.from(li.childNodes)){
        if(c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) y.append(lista(c));
        else if(c.nodeType === 1 && c.tagName === 'P'){ if(y.childNodes.length) y.append(document.createElement('br')); inline(c, y); }
        else inline({ childNodes:[c] }, y);
      }
      x.append(y);
    }
    return x;
  }
  function tabela(el){
    const t = document.createElement('table'), tb = document.createElement('tbody'); t.append(tb);
    el.querySelectorAll('tr').forEach(tr => {
      if(tr.closest('table') !== el) return;
      const r = document.createElement('tr');
      Array.from(tr.children).forEach(c => { if(!/^T[DH]$/.test(c.tagName)) return; const x = document.createElement(c.tagName.toLowerCase()); inline(c, x); r.append(x); });
      if(r.children.length) tb.append(r);
    });
    return t;
  }
  blocos(d.body, raiz);
  raiz.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,td,th').forEach(b => {
    while(b.firstChild && (b.firstChild.nodeName === 'BR' || (b.firstChild.nodeType === 3 && !b.firstChild.data.trim()))) b.firstChild.remove();
    while(b.lastChild && (b.lastChild.nodeName === 'BR' || (b.lastChild.nodeType === 3 && !b.lastChild.data.trim()))) b.lastChild.remove();
  });
  raiz.querySelectorAll(':scope > p').forEach(p => {
    const txt = p.textContent.trim();
    const soNeg = p.childNodes.length === 1 && p.firstChild.nodeName === 'STRONG';
    if(soNeg && txt.split(/\s+/).length <= 12 && !/[;,]$/.test(txt)){ const h2 = document.createElement('h2'); h2.textContent = txt; p.replaceWith(h2); }
    else if(/^[a-z]\)\s/.test(txt)) p.className = 'alin';
  });
  return raiz.innerHTML;
}
function mdInline(s){
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(.+?)__(?=[^\w]|$)/g, '$1<strong>$2</strong>')
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '$1');
}
function mdParaHTML(md){
  const L = String(md).replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n');
  const out = [];
  const proxima = i => { for(let j = i + 1; j < L.length; j++) if(L[j].trim()) return L[j].trim(); return ''; };
  let i = 0;
  while(i < L.length){
    const t = L[i].trim();
    if(!t){ i++; continue; }
    let m;
    if((m = t.match(/^(#{1,6})\s+(.*)$/))){ const n = Math.max(2, m[1].length); out.push('<h' + n + '>' + mdInline(m[2].replace(/\s*#+\s*$/, '').replace(/\*\*/g, '')) + '</h' + n + '>'); i++; continue; }
    if(/^(-{3,}|\*{3,}|_{3,})$/.test(t)){ i++; continue; }
    if(t.startsWith('|') && i + 1 < L.length && /^\|?\s*:?-{2,}/.test(L[i + 1].trim())){
      const linhas = [];
      const cels = s => s.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      linhas.push(cels(t)); i += 2;
      while(i < L.length && L[i].trim().startsWith('|')){ linhas.push(cels(L[i])); i++; }
      out.push('<table><tbody>' + linhas.map((r, k) => '<tr>' + r.map(c => k === 0 ? '<th>' + mdInline(c.replace(/\*\*/g, '')) + '</th>' : '<td>' + mdInline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    if(/^[-*+•]\s+/.test(t)){
      const itens = [];
      while(i < L.length && /^\s*[-*+•]\s+/.test(L[i])){ itens.push(L[i].trim().replace(/^[-*+•]\s+/, '')); i++; }
      out.push('<ul>' + itens.map(x => '<li>' + mdInline(x) + '</li>').join('') + '</ul>');
      continue;
    }
    if(/^>\s?/.test(t)){ out.push('<p>' + mdInline(t.replace(/^>\s?/, '')) + '</p>'); i++; continue; }
    if((m = t.match(/^(\*\*)?(\d+)\.\s+(.+?)(\*\*)?$/))){
      const txt = m[3].replace(/\*\*/g, '').trim();
      const neg = !!(m[1] && m[4]);
      const seg = proxima(i).replace(/^\*\*/, '');
      const temSub = new RegExp('^' + m[2] + '\\.\\d').test(seg);
      const caixa = txt === txt.toLocaleUpperCase('pt-BR') && /[A-ZÀ-Ú]/.test(txt);
      if((neg || temSub || caixa) && txt.split(/\s+/).length <= 14 && !/[;,.]$/.test(txt)){ out.push('<h2>' + mdInline(m[2] + '. ' + txt) + '</h2>'); i++; continue; }
    }
    if((m = t.match(/^\*\*([^*]+)\*\*:?$/)) && m[1].split(/\s+/).length <= 12 && out.length > 1){ out.push('<h2>' + mdInline(m[1].trim() + (t.endsWith(':') ? ':' : '')) + '</h2>'); i++; continue; }
    if(/^[a-z]\)\s+/.test(t)){ out.push('<p class="alin">' + mdInline(t) + '</p>'); i++; continue; }
    out.push('<p>' + mdInline(t.replace(/^\*\*(.+)\*\*$/, '$1')) + '</p>'); i++;
  }
  return out.join('');
}
const looksMarkdown = t => /(^|\n)\s*(#{1,6}\s|[-*+]\s|\|.*\|)|\*\*[^*]+\*\*/.test(t);
function htmlDeColagem(cd){
  const html = cd.getData('text/html'), txt = cd.getData('text/plain');
  if(txt && (!html || looksMarkdown(txt))) return mdParaHTML(txt);
  if(html) return limparHTML(html);
  return mdParaHTML(txt || '');
}

/* =====================================================================
   Word (.docx) no mesmo padrão MPI: cabeçalho, título, bloco, capítulos,
   citação, notas de rodapé, fecho e tarja no rodapé
   ===================================================================== */
async function buildDocx(src, d, proc){
  const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ctx = { notas:[] };
  const bl = blocosDoc(src, d, ctx);
  const tw = pt => Math.round(pt * 20);
  const run = (r, size, eb, ei, fonte) => {
    if(r.br) return '<w:r><w:br/></w:r>';
    if(r.nota) return `<w:r><w:rPr><w:vertAlign w:val="superscript"/><w:sz w:val="${Math.round(size * 2)}"/></w:rPr><w:footnoteReference w:id="${r.nota}"/></w:r>`;
    const b = r.b || eb, i = r.i || ei;
    const f = fonte ? `<w:rFonts w:ascii="${fonte}" w:hAnsi="${fonte}" w:cs="${fonte}"/>` : '';
    return `<w:r><w:rPr>${f}${b ? '<w:b/>' : ''}${i ? '<w:i/>' : ''}${r.u ? '<w:u w:val="single"/>' : ''}${r.sup ? '<w:vertAlign w:val="superscript"/>' : ''}<w:sz w:val="${Math.round(size * 2)}"/><w:szCs w:val="${Math.round(size * 2)}"/></w:rPr><w:t xml:space="preserve">${x(r.t)}</w:t></w:r>`;
  };
  const jc = { justify:'both', center:'center', left:'left', right:'right' };
  let prevAf = 0, body = '';
  for(const b of bl){
    if(b.s === 'quebra'){ body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; prevAf = 0; continue; }
    if(b.s === 'tab'){
      const nc = Math.max(...b.rows.map(r => r.cels.length));
      const brd = '<w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="9AA1AA"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D5D9DE"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="D5D9DE"/><w:left w:val="nil"/><w:right w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
      const TW = tw(PAG.retrato.CW);
      const nat = Array(nc).fill(4);
      b.rows.forEach(r => r.cels.forEach((c, i) => { const n = c.runs.map(q => q.t || '').join('').length; nat[i] = Math.max(nat[i], Math.min(n, 40)); }));
      const soma = nat.reduce((a, v) => a + v, 0), cw = nat.map(v => Math.round(v / soma * TW));
      body += `<w:tbl><w:tblPr><w:tblW w:w="${TW}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${brd}<w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cw.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
      for(const r of b.rows){
        body += '<w:tr>' + (r.hdr ? '<w:trPr><w:tblHeader/></w:trPr>' : '');
        for(let i = 0; i < nc; i++){
          const c = r.cels[i] || { runs:[] };
          body += `<w:tc><w:tcPr><w:tcW w:w="${cw[i]}" w:type="dxa"/>${r.hdr ? '<w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="9AA1AA"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="F1F3F5"/>' : ''}</w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40" w:line="248" w:lineRule="auto"/>${c.al === 'right' ? '<w:jc w:val="right"/>' : c.al === 'center' ? '<w:jc w:val="center"/>' : ''}</w:pPr>${c.runs.map(q => run(q, 10, r.hdr, false)).join('')}</w:p></w:tc>`;
        }
        body += '</w:tr>';
      }
      body += '</w:tbl>'; prevAf = 0; continue;
    }
    const e = Object.assign({}, ESTILOS[b.s] || ESTILOS.corpo);
    if(b.bf != null) e.bf = b.bf;
    if(b.af != null) e.af = b.af;
    const before = Math.max(0, e.bf - prevAf);
    const blocoInd = b.s === 'corpo' ? 0 : (b.ind != null ? b.ind : (e.ind || 0)), ind1 = b.s === 'corpo' ? (b.ind || 0) : 0;
    const al = jc[b.al || e.al] || 'both';
    const line = Math.round(240 * (e.lf || 1.15));
    const indXml = blocoInd || ind1 ? `<w:ind w:left="${tw(blocoInd)}"${ind1 ? ` w:firstLine="${tw(ind1)}"` : ''}/>` : '';
    body += `<w:p><w:pPr>${e.kn || b.kn ? '<w:keepNext/>' : ''}${e.kl || b.kl ? '<w:keepLines/>' : ''}<w:spacing w:before="${tw(before)}" w:after="${tw(e.af)}" w:line="${line}" w:lineRule="auto"/>${indXml}<w:jc w:val="${al}"/></w:pPr>${b.runs.map(r => run(r, e.size, e.f === 'b' || e.f === 'bi', e.f === 'i' || e.f === 'bi')).join('')}</w:p>`;
    prevAf = e.af;
  }
  const bras = (d && d.bras) || 'todas', temBras = bras !== 'nenhum';
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const G = PAG.retrato, MF = await fontesMedida();
  const pHdr = (inner, after, extra) => `<w:p><w:pPr><w:spacing w:before="0" w:after="${after || 0}" w:line="${tw(TB.lh)}" w:lineRule="exact"/>${extra || ''}<w:jc w:val="center"/></w:pPr>${inner}</w:p>`;
  const cx = Math.round(TB.bw * 12700), cy = Math.round(TB.bh * 12700);
  const drawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Brasao"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="brasao.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  const hdrLine = t => `<w:r><w:rPr><w:b/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  const ls = timbreLinhas();
  let hdrBody = `<w:p><w:pPr><w:spacing w:before="0" w:after="${tw(TB.gap)}" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>${drawing}</w:p>`;
  ls.forEach((t, i) => {
    let extra = '';
    if(i === ls.length - 1){ const wr = largura(MF.b, t, TB.size), sobra = Math.max(0, (G.CW - wr) / 2 - 2); extra = `<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="000000"/></w:pBdr><w:ind w:left="${tw(sobra)}" w:right="${tw(sobra)}"/>`; }
    hdrBody += pHdr(hdrLine(t), 0, extra);
  });
  const header1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${hdrBody}</w:hdr>`;
  const header2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p></w:hdr>`;
  /* rodapé: a tarja em uma célula clara, margem a margem */
  const tr = d ? tarjaRuns(d, proc || null) : null;
  let footer = '';
  if(tr && tr.length){
    const cell = `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="220" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>${tr.map(r => run(r, 7.2, false, false, 'Arial')).join('')}</w:p>`;
    footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:tbl><w:tblPr><w:tblW w:w="${tw(G.CW)}" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CCD1D7"/><w:left w:val="single" w:sz="4" w:color="CCD1D7"/><w:bottom w:val="single" w:sz="4" w:color="CCD1D7"/><w:right w:val="single" w:sz="4" w:color="CCD1D7"/></w:tblBorders><w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${tw(G.CW)}"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="${tw(G.CW)}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="FAFBFC"/></w:tcPr>${cell}</w:tc></w:tr></w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p></w:ftr>`;
  }
  /* notas de rodapé */
  const temNotas = ctx.notas.length > 0;
  const notesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes ${NS}><w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>${ctx.notas.map((t, i) => `<w:footnote w:id="${i + 1}"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:vertAlign w:val="superscript"/><w:sz w:val="20"/></w:rPr><w:footnoteRef/></w:r><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve"> ${x(t)}</w:t></w:r></w:p></w:footnote>`).join('')}</w:footnotes>`;
  let refs = '';
  if(bras === 'todas') refs = '<w:headerReference w:type="default" r:id="rIdH1"/>';
  if(bras === 'primeira') refs = '<w:headerReference w:type="default" r:id="rIdH2"/><w:headerReference w:type="first" r:id="rIdH1"/>';
  if(footer) refs += '<w:footerReference w:type="default" r:id="rIdF1"/>' + (bras === 'primeira' ? '<w:footerReference w:type="first" r:id="rIdF1"/>' : '');
  const topo = temBras ? T_TIMBRE : G.T;
  const sect = `<w:sectPr>${refs}${temNotas ? '<w:footnotePr><w:numFmt w:val="decimal"/></w:footnotePr>' : ''}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${tw(topo)}" w:right="${tw(G.R)}" w:bottom="${tw(G.B)}" w:left="${tw(G.L)}" w:header="${tw(TB.top)}" w:footer="${tw(12)}" w:gutter="0"/>${bras === 'primeira' ? '<w:titlePg/>' : ''}</w:sectPr>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR" w:eastAsia="pt-BR" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
  const zip = new JSZip();
  const ov = [];
  if(temBras) ov.push('<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>');
  if(footer) ov.push('<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>');
  if(temNotas) ov.push('<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>');
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>${ov.join('')}</Types>`);
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSt" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${temBras ? '<Relationship Id="rIdH1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdH2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>' : ''}${footer ? '<Relationship Id="rIdF1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : ''}${temNotas ? '<Relationship Id="rIdFn" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>' : ''}</Relationships>`);
  zip.file('word/document.xml', doc);
  zip.file('word/styles.xml', styles);
  if(footer) zip.file('word/footer1.xml', footer);
  if(temNotas) zip.file('word/footnotes.xml', notesXml);
  if(temBras){
    zip.file('word/header1.xml', header1); zip.file('word/header2.xml', header2);
    zip.file('word/_rels/header1.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/brasao.jpg"/></Relationships>');
    zip.file('word/media/brasao.jpg', b64u8(B64_BRASAO));
  }
  return zip.generateAsync({ type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/* ===== c_data.js ===== */
/* =====================================================================
   Dados: processos (objetos), documentos, arquivos, ficha, REVIT e modelos
   ===================================================================== */
const CATS = [['licitacoes', 'Licitações'], ['aditivos', 'Aditivos'], ['diversos', 'Processos Diversos']];
const catName = id => (CATS.find(c => c[0] === id) || [, 'Processos Diversos'])[1];
const STATUS = ['Em elaboração', 'Tramitando', 'Aguardando resposta', 'Parado', 'Concluído'];
const MODALIDADES = ['Concorrência Eletrônica', 'Concorrência Eletrônica – SRP', 'Pregão Eletrônico', 'Pregão Eletrônico – SRP', 'Dispensa de Licitação', 'Inexigibilidade', 'Adesão a Ata', 'Outra'];
const SETORES = ['Superintendência de Projetos e Fiscalização', 'Gabinete da SEINFRA', 'Procuradoria-Geral do Município', 'Controladoria-Geral do Município', 'Secretaria da Fazenda', 'Contabilidade', 'Setor de Licitações', 'Setor de Contratos', 'Gerência de Fiscalização', 'Gerência de Orçamento e Controle', 'PROGER', 'Empresa contratada'];
const TIPOS_OBJ = ['Licitação', 'Aditivo', 'Processo administrativo'];
const MOD_COD = ['CP – Concorrência Pública', 'PE – Pregão Eletrônico', 'PP – Pregão Presencial', 'DL – Dispensa de Licitação', 'IN – Inexigibilidade'];
const ESPECIES = ['PRZ – Prazo', 'VAL – Valor', 'QTD – Quantitativo', 'REQ – Reequilíbrio'];
const SIM_NAO = ['Não', 'Sim'];

/* campos da ficha central: [chave, rótulo, tipo, grupo] */
const FICHA = [
  ['num', 'Nº do processo', 'text', 'Identificação'],
  ['objeto', 'Objeto', 'area', 'Identificação'],
  ['modalidade', 'Modalidade', 'list:MODALIDADES', 'Identificação'],
  ['licNum', 'Nº da concorrência / pregão', 'text', 'Identificação'],
  ['setor', 'Setor responsável', 'list:SETORES', 'Identificação'],
  ['revitInicio', 'Início do estudo (REVIT)', 'date', 'REVIT'],
  ['tipoObj', 'Tipo', 'list:TIPOS_OBJ', 'REVIT'],
  ['modCod', 'Modalidade (sigla)', 'list:MOD_COD', 'REVIT'],
  ['srp', 'Registro de preços', 'list:SIM_NAO', 'REVIT'],
  ['especie', 'Espécie do aditivo', 'list:ESPECIES', 'REVIT'],
  ['sigla', 'Sigla do objeto', 'text', 'REVIT'],
  ['contratada', 'Contratada', 'text', 'Contrato'],
  ['cnpj', 'CNPJ', 'text', 'Contrato'],
  ['contrato', 'Nº do contrato', 'text', 'Contrato'],
  ['fiscal', 'Fiscal do contrato', 'text', 'Contrato'],
  ['gestor', 'Gestor do contrato', 'text', 'Contrato'],
  ['dotacao', 'Dotação orçamentária', 'text', 'Contrato'],
  ['valorInicial', 'Valor inicial', 'money', 'Valores'],
  ['valorAtual', 'Valor atualizado', 'money', 'Valores'],
  ['medido', 'Valor medido / pago', 'money', 'Valores'],
  ['saldo', 'Saldo', 'money', 'Valores'],
  ['assinatura', 'Assinatura do contrato', 'date', 'Datas e prazos'],
  ['inicio', 'Início (ordem de serviço)', 'date', 'Datas e prazos'],
  ['prazo', 'Prazo de execução (dias)', 'number', 'Datas e prazos'],
  ['termino', 'Término previsto', 'date', 'Datas e prazos'],
  ['vigencia', 'Vigência do contrato', 'date', 'Datas e prazos'],
  ['obs', 'Observações', 'area', 'Outros']
];
const FICHA_KEYS = FICHA.map(f => f[0]);
/* marcadores dos modelos → campo da ficha */
const MARCADORES = {
  processo:'num', objeto:'objeto', modalidade:'modalidade', setor:'setor', contratada:'contratada', cnpj:'cnpj', contrato:'contrato',
  fiscal:'fiscal', gestor:'gestor', dotacao:'dotacao', valor_inicial:'valorInicial', valor_atual:'valorAtual', medido:'medido', saldo:'saldo',
  assinatura:'assinatura', inicio:'inicio', prazo:'prazo', termino:'termino', vigencia:'vigencia', concorrencia:'licNum'
};
const MARC_ROTULO = { processo:'nº do processo', objeto:'objeto', modalidade:'modalidade', setor:'setor', contratada:'contratada', cnpj:'CNPJ', contrato:'nº do contrato',
  fiscal:'fiscal', gestor:'gestor', dotacao:'dotação', valor_inicial:'valor inicial', valor_atual:'valor atualizado', medido:'valor medido', saldo:'saldo',
  assinatura:'data de assinatura', inicio:'data de início', prazo:'prazo', termino:'término', vigencia:'vigência', data:'data', cidade:'cidade', ano:'ano',
  concorrencia:'nº da concorrência', revit:'nº do REVIT', revit_inicio:'início do REVIT', revit_codigo:'código do REVIT', numint:'numeração interna' };

/* número por extenso (inteiros até 999.999) */
function extenso(n){
  n = Math.floor(Math.abs(+n)); if(!n) return 'zero';
  const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = x => { if(x === 100) return 'cem'; const c = Math.floor(x / 100), r = x % 100, p = []; if(c) p.push(C[c]); if(r){ if(r < 20) p.push(U[r]); else { const d = Math.floor(r / 10), u = r % 10; p.push(D[d] + (u ? ' e ' + U[u] : '')); } } return p.join(' e '); };
  if(n < 1000) return ate999(n);
  const mil = Math.floor(n / 1000), r = n % 1000;
  return (mil === 1 ? 'mil' : ate999(mil) + ' mil') + (r ? (r < 100 || r % 100 === 0 ? ' e ' : ' ') + ate999(r) : '');
}
function fichaBruta(p, k){
  const f = (p && p.ficha) || {};
  if(k === 'saldo' && !f.saldo){ const a = numBR(f.valorAtual || f.valorInicial), m = numBR(f.medido); if(a != null && m != null) return a - m; }
  if(k === 'valorAtual' && !f.valorAtual) return f.valorInicial || '';
  if(k === 'termino' && !f.termino && f.inicio && f.prazo) return somaDias(f.inicio, f.prazo);
  return f[k] == null ? '' : f[k];
}
function fichaValor(p, k){
  const def = FICHA.find(x => x[0] === k), v = fichaBruta(p, k);
  if(v === '' || v == null) return '';
  if(!def) return String(v);
  if(def[2] === 'money') return fmtBRL(v);
  if(def[2] === 'date') return dataBR(v);
  if(k === 'prazo'){ const n = parseInt(v, 10); return isNaN(n) ? String(v) : n + ' (' + extenso(n) + ') dias'; }
  return String(v);
}

/* ---------- REVIT: relatório de estudo de viabilidade técnica ----------
   Número: dia.mês.ano(2 dígitos).sequência do dia — com a data REAL de início do estudo */
const PALAVRA_SIGLA = { reforma:'REF', construcao:'CON', pavimentacao:'PAV', drenagem:'DRE', manutencao:'MAN', ampliacao:'AMP', recuperacao:'REC', requalificacao:'RQL', implantacao:'IMP',
  fornecimento:'FOR', aquisicao:'AQU', servico:'SER', servicos:'SER', locacao:'LOC', projeto:'PRJ', projetos:'PRJ', fiscalizacao:'FIS', urbanizacao:'URB', contencao:'CTN', restauracao:'RES', adequacao:'ADE', revitalizacao:'REV', limpeza:'LIM', elaboracao:'ELA' };
const GENERICAS = new Set(['contratacao', 'empresa', 'especializada', 'execucao', 'obra', 'obras', 'para', 'municipal', 'municipio', 'ilheus', 'engenharia']);
function siglaDoObjeto(obj){
  const pal = norm(obj || '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  let cab = '', i = 0;
  for(; i < pal.length; i++){ if(PALAVRA_SIGLA[pal[i]]){ cab = PALAVRA_SIGLA[pal[i]]; i++; break; } }
  if(!cab){ const p0 = pal.find(w => !CONECTIVOS.has(w) && !GENERICAS.has(w)); if(!p0) return ''; cab = p0.slice(0, 3).toUpperCase(); i = pal.indexOf(p0) + 1; }
  const ini = pal.slice(i).filter(w => !CONECTIVOS.has(w) && !GENERICAS.has(w) && !/^\d+$/.test(w)).slice(0, 3).map(w => w[0].toUpperCase()).join('');
  return ini ? cab + '-' + ini : cab;
}
const revitData = p => (p.ficha && p.ficha.revitInicio) || '';
function revitNumero(p){
  const iso = revitData(p); if(!iso) return '';
  const [y, m, d] = iso.split('-');
  return d + '.' + m + '.' + y.slice(2) + '.' + (p.ficha.revitSeq || 1);
}
function revitCodigo(p){
  const f = p.ficha || {}, t = f.tipoObj === 'Aditivo' ? 'A' : f.tipoObj === 'Licitação' ? 'L' : f.tipoObj ? 'P' : '';
  const partes = [];
  if(t) partes.push(t);
  if(t === 'A' && f.especie) partes.push(f.especie.slice(0, 3));
  else if(f.modCod) partes.push(f.modCod.slice(0, 2));
  if(f.srp === 'Sim') partes.push('SRP');
  const cod = partes.join('-'), sig = f.sigla || siglaDoObjeto(f.objeto);
  return [cod, sig].filter(Boolean).join(' · ');
}
const revitTexto = p => revitNumero(p) ? 'REVIT N. ' + revitNumero(p) + (revitCodigo(p) ? ' · ' + revitCodigo(p) : '') : '';
/* sequência do dia: menor número ainda não usado por outro objeto com o mesmo início */
function revitSeqLivre(iso, exceto){
  const usados = new Set(DB.procs.filter(q => q !== exceto && q.ficha && q.ficha.revitInicio === iso).map(q => +q.ficha.revitSeq || 1));
  let n = 1; while(usados.has(n)) n++; return n;
}
const NOME_MOD = { CP:'Concorrência Pública', PE:'Pregão Eletrônico', PP:'Pregão Presencial', DL:'Dispensa de Licitação', IN:'Inexigibilidade' };

const chaveExtra = k => norm(k).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const MARC_ESPECIAIS = ['data', 'cidade', 'ano', 'assinante', 'cargo_assinante', 'numint'];
function marcadorValor(p, k, o){
  if(k === 'data') return dataExtenso();
  if(k === 'cidade') return settings.cidade || '';
  if(k === 'ano') return String(new Date().getFullYear());
  if(k === 'numint') return (o && o.numint) || '';
  if(k === 'revit') return p ? revitNumero(p) : '';
  if(k === 'revit_inicio') return p && revitData(p) ? dataBR(revitData(p)) : '';
  if(k === 'revit_codigo') return p ? revitCodigo(p) : '';
  const campo = MARCADORES[k]; if(campo) return fichaValor(p, campo);
  const ex = ((p && p.ficha && p.ficha.extras) || []).find(e => chaveExtra(e.k) === k);
  return ex ? ex.v || '' : '';
}

/* ---------- signatários ---------- */
const pessoaPorId = id => (settings.signatarios || []).find(s => s.id === id) || null;
const autoridade = () => (settings.signatarios || []).find(s => s.autoridade) || null;
const pessoaLinha = s => s ? titleCase(s.nome) + (s.cargo ? ' — ' + s.cargo : '') : '';

/* ---------- modelos de documento (padrão MPI) ----------
   Uma linha = um parágrafo.
   "# " título · "= " identificação (caixa alta, abaixo do título) · "| " linha do bloco de cabeçalho
   "|+ " linha do bloco com espaço antes · "@data" local e data no alto (ofício) · "## " capítulo
   "> " citação · "---" nova página · [texto] campo para preencher · {{marcador}} dado da ficha
   Linhas com {{numint}} só aparecem no documento avulso; linhas com {{processo}} só no documento de processo.
   O fecho (local, data e assinatura) e a tarja entram sozinhos. */
const MODELOS_V = 4;
const MODELOS_PADRAO = () => [
  { id:'ci', grupo:'Comunicações', tipo:'ci', nome:'Comunicação interna', sig:'s2',
    texto:'# COMUNICAÇÃO INTERNA\n= SEINFRA N. {{numint}}\n| **De:** Secretaria Municipal de Infraestrutura e Defesa Civil\n| **Para:** [destinatário]\n| **Assunto:** [assunto]\n| **Referência:** Processo Administrativo nº {{processo}}\n[Texto da comunicação.]\nAtenciosamente,' },
  { id:'of', grupo:'Comunicações', tipo:'of', nome:'Ofício', sig:'autoridade',
    texto:'# OFÍCIO\n= SEINFRA N. {{numint}}\n@data\n| A Sua Senhoria o(a) Senhor(a)\n| [NOME DO DESTINATÁRIO]\n| [Cargo]\n| [Órgão] – [Cidade-UF]\n|+ **Assunto:** [assunto]\n| **Referência:** Processo Administrativo nº {{processo}}\nSenhor(a) [cargo],\n[Texto do ofício.]\nAtenciosamente,' },
  { id:'nt', grupo:'Comunicações', tipo:'nt', nome:'Nota técnica', sig:'s2',
    texto:'# NOTA TÉCNICA Nº [000]/{{ano}}\n= SEINFRA N. {{numint}}\n| **Assunto:** [assunto]\n| **Interessada:** {{contratada}}\n| **Referência:** Processo Administrativo nº {{processo}}\n## 1. Objetivo\n1.1 [Objetivo desta nota técnica.]\n## 2. Histórico\n2.1 O Contrato nº {{contrato}}, firmado com a empresa {{contratada}}, tem valor de {{valor_atual}} e prazo de execução de {{prazo}}.\n2.2 [Histórico do pedido.]\n## 3. Análise\n3.1 [Análise técnica.]\n## 4. Conclusão\n4.1 [Conclusão.]' },
  { id:'lct01', grupo:'Despachos', tipo:'desp', nome:'LCT.01 · Despacho — responsáveis pelo DFD e pelo ETP', sig:'autoridade',
    texto:'# DESPACHO\n| **Interessado:** Superintendência de Projetos e Fiscalização\n| **Assunto:** Responsáveis técnicos pelo DFD e pelo ETP\n| **Referência:** Processo Administrativo nº {{processo}}\nConsiderando o Documento de Formalização da Demanda (DFD) juntado às fls. [__], que registra a necessidade de {{objeto}}, aprovo a demanda apresentada.\nConfirmo o servidor [nome do servidor], [cargo], matrícula nº [000000], como responsável pela elaboração do DFD, e designo o servidor [nome do servidor], [cargo], [registro profissional], como responsável técnico pela elaboração do Estudo Técnico Preliminar (ETP), nos termos do art. 18 da Lei nº 14.133, de 1º de abril de 2021.\nEncaminhe-se à Superintendência de Projetos e Fiscalização para as providências cabíveis.' },
  { id:'desp-rec', grupo:'Despachos', tipo:'desp', nome:'Despacho de recebimento', sig:'s1',
    texto:'# DESPACHO\n| **Referência:** Processo Administrativo nº {{processo}}\nRecebido nesta data. De ordem do Superintendente de Projetos e Fiscalização, [providência].' },
  { id:'desp-rem', grupo:'Despachos', tipo:'desp', nome:'Despacho de remessa', sig:'s1',
    texto:'# DESPACHO\n| **Referência:** Processo Administrativo nº {{processo}}\nDe ordem do Superintendente de Projetos e Fiscalização, encaminhe-se o presente processo à [setor de destino], para [finalidade].' },
  { id:'desp-jun', grupo:'Despachos', tipo:'desp', nome:'Despacho de juntada', sig:'s1',
    texto:'# DESPACHO\n| **Referência:** Processo Administrativo nº {{processo}}\nJunte-se aos autos [documento], referente a {{objeto}}. Após, encaminhe-se à [setor] para prosseguimento.' },
  { id:'dfd', grupo:'Planejamento da contratação', tipo:'dfd', nome:'DFD', sig:'autoridade',
    texto:'# DOCUMENTO DE FORMALIZAÇÃO DA DEMANDA (DFD)\n| **Objeto:** {{objeto}}\n| **Referência:** Processo Administrativo nº {{processo}}\n## 1. Identificação da Área Requisitante\n1.1 Órgão: Secretaria de Infraestrutura e Defesa Civil – SEINFRA.\n1.2 Setor requisitante: {{setor}}.\n1.3 Responsável pela demanda: [nome do servidor], matrícula nº [000000].\n## 2. Objeto\n2.1 Contratação de empresa especializada para {{objeto}}.\n## 3. Justificativa da Necessidade\n3.1 [Justificativa da necessidade da contratação.]\n## 4. Quantidade e Previsão\n4.1 [Quantidades estimadas e data pretendida.]\n## 5. Valor Estimado\n5.1 Valor estimado: {{valor_inicial}}.\n## 6. Plano de Contratações Anual\n6.1 [Vinculação ao PCA.]\n## 7. Dotação Orçamentária\n7.1 {{dotacao}}\n## 8. Estudo de Viabilidade Técnica\n8.1 O presente DFD marca a conclusão do Relatório de Estudo de Viabilidade Técnica (REVIT N. {{revit}}), iniciado em {{revit_inicio}}.' },
  { id:'etp', grupo:'Planejamento da contratação', tipo:'etp', nome:'ETP', sig:'s2',
    texto:'# ESTUDO TÉCNICO PRELIMINAR (ETP)\n| **Objeto:** {{objeto}}\n| **Responsável técnico:** [nome], [cargo], [registro profissional]\n| **Referência:** Processo Administrativo nº {{processo}}\n## 1. Descrição da Necessidade\n1.1 [Necessidade a ser atendida.]\n## 2. Previsão no Plano de Contratações Anual\n2.1 [Previsão no PCA.]\n## 3. Requisitos da Contratação\n3.1 [Requisitos.]\n## 4. Estimativa das Quantidades\n4.1 [Quantidades e memória de cálculo.]\n## 5. Levantamento de Mercado\n5.1 [Alternativas analisadas.]\n## 6. Estimativa do Valor\n6.1 Valor estimado: {{valor_inicial}}.\n## 7. Descrição da Solução como um Todo\n7.1 [Solução.]\n## 8. Justificativa para o Parcelamento ou Não\n8.1 [Parcelamento.]\n## 9. Resultados Pretendidos\n9.1 [Resultados.]\n## 10. Providências Prévias\n10.1 [Providências.]\n## 11. Contratações Correlatas e Interdependentes\n11.1 [Contratações correlatas.]\n## 12. Impactos Ambientais\n12.1 [Impactos e medidas mitigadoras.]\n## 13. Viabilidade da Contratação\n13.1 [Posicionamento conclusivo.]' },
  { id:'pb', grupo:'Planejamento da contratação', tipo:'pb', nome:'Projeto básico', sig:'s2',
    texto:'# PROJETO BÁSICO\n| **Objeto:** {{objeto}}\n| **Regime de execução:** [regime]\n| **Referência:** Processo Administrativo nº {{processo}}\n## 1. Objeto\n1.1 Contratação de empresa especializada em engenharia para {{objeto}}, no âmbito do REVIT N. {{revit}}, iniciado em {{revit_inicio}}.\n## 2. Justificativa\n2.1 [Justificativa.]\n## 3. Descrição dos Serviços\n3.1 [Descrição conforme memorial descritivo e planilha.]\n## 4. Prazo de Execução\n4.1 O prazo de execução é de {{prazo}}, contados da ordem de serviço.\n## 5. Valor Estimado\n5.1 O valor estimado é de {{valor_inicial}}.\n## 6. Qualificação Técnica\n6.1 [Exigências de qualificação técnica.]\n## 7. Medição e Pagamento\n7.1 [Critérios de medição e pagamento.]\n## 8. Fiscalização\n8.1 [Fiscalização.]\n## 9. Obrigações das Partes\n9.1 [Obrigações.]' },
  { id:'tr', grupo:'Planejamento da contratação', tipo:'tr', nome:'Termo de referência', sig:'s2',
    texto:'# TERMO DE REFERÊNCIA\n| **Objeto:** {{objeto}}\n| **Referência:** Processo Administrativo nº {{processo}}\n## 1. Definição do Objeto\n1.1 {{objeto}}.\n## 2. Fundamentação da Contratação\n2.1 [Fundamentação.]\n## 3. Descrição da Solução\n3.1 [Solução.]\n## 4. Requisitos da Contratação\n4.1 [Requisitos.]\n## 5. Modelo de Execução\n5.1 [Execução.]\n## 6. Modelo de Gestão do Contrato\n6.1 [Gestão e fiscalização.]\n## 7. Critérios de Medição e Pagamento\n7.1 [Medição e pagamento.]\n## 8. Seleção do Fornecedor\n8.1 Modalidade: {{modalidade}}.\n## 9. Estimativa do Valor\n9.1 Valor estimado: {{valor_inicial}}.\n## 10. Adequação Orçamentária\n10.1 {{dotacao}}' },
  { id:'livre', grupo:'Outros', tipo:'livre', nome:'Texto livre (MPI organiza)', sig:'s2', texto:'# [TÍTULO]\n[Texto.]' },
  { id:'anexo', grupo:'Outros', tipo:'anexo', nome:'Anexo em texto (sem assinatura)', sig:null, texto:'# [TÍTULO DO ANEXO]\n[Texto.]' }
];
const modelos = () => settings.modelos && settings.modelosV === MODELOS_V ? settings.modelos : MODELOS_PADRAO();
const GRUPOS_MODELO = ['Comunicações', 'Despachos', 'Planejamento da contratação', 'Outros'];
const TIPO_NOME = { ci:'Comunicação interna', of:'Ofício', nt:'Nota técnica', desp:'Despacho', dfd:'DFD', etp:'ETP', pb:'Projeto básico', tr:'Termo de referência', livre:'Texto', anexo:'Anexo' };
const tipoDoc = d => d.tipo || ((modelos().find(m => m.id === d.modelo) || {}).tipo) || (d.modelo && /^desp/.test(d.modelo) ? 'desp' : 'livre');

function tplParaHTML(texto, p, o){
  o = o || {};
  const avulso = !!o.avulso;
  const linhas = String(texto || '').replace(/\r/g, '').split('\n').filter(l => avulso ? !/\{\{\s*processo\s*\}\}/.test(l) : !/\{\{\s*numint\s*\}\}/.test(l));
  const inl = s => esc(s)
    .replace(/\[([^\]\n]{1,80})\]/g, (m, t) => `<span class="campo">[${t}]</span>`)
    .replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (m, k) => { const v = marcadorValor(p, k, o); return v ? `<span class="fc" data-f="${k}">${esc(v)}</span>` : `<span class="fc vazio" data-f="${k}">[${esc(MARC_ROTULO[k] || k.replace(/_/g, ' '))}]</span>`; })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const out = [];
  for(const l of linhas){
    const t = l.trim();
    if(!t) continue;
    if(t === '---') out.push('<hr class="qp">');
    else if(t === '@data') out.push('<p class="dt"></p>');
    else if(t.startsWith('## ')) out.push('<h2>' + inl(t.slice(3)) + '</h2>');
    else if(t.startsWith('# ')) out.push('<h1>' + inl(t.slice(2)) + '</h1>');
    else if(t.startsWith('= ')) out.push('<p class="id">' + inl(t.slice(2)) + '</p>');
    else if(t.startsWith('|+ ')) out.push('<p class="bl sep">' + inl(t.slice(3)) + '</p>');
    else if(t.startsWith('| ')) out.push('<p class="bl">' + inl(t.slice(2)) + '</p>');
    else if(t.startsWith('> ')) out.push('<blockquote><p>' + inl(t.slice(2)) + '</p></blockquote>');
    else out.push('<p>' + inl(t) + '</p>');
  }
  return out.join('') || '<p><br></p>';
}
/* ficha mudou → atualiza os campos {{…}} dos textos que ainda têm o valor antigo */
function replicarFicha(p, antes, docs){
  const velho = { ficha:antes || {} };
  let mudou = 0;
  for(const d of (docs || p.docs)){
    if(d.kind !== 'texto' || !d.html || d.html.indexOf('data-f=') < 0) continue;
    const box = document.createElement('div'); box.innerHTML = d.html;
    let alt = false;
    box.querySelectorAll('span.fc[data-f]').forEach(sp => {
      const k = sp.dataset.f; if(MARC_ESPECIAIS.includes(k)) return;
      const antigo = marcadorValor(velho, k), novo = marcadorValor(p, k), atual = sp.textContent;
      if(atual !== antigo && !sp.classList.contains('vazio')) return;
      if(!novo && sp.classList.contains('vazio')) return;
      if(atual === novo) return;
      if(novo){ sp.textContent = novo; sp.classList.remove('vazio'); }
      else { sp.textContent = '[' + (MARC_ROTULO[k] || k) + ']'; sp.classList.add('vazio'); }
      alt = true;
    });
    if(alt){ d.html = box.innerHTML; d.pags = null; mudou++; }
  }
  return mudou;
}

/* ---------- tarja (pé de todas as folhas) ---------- */
function tarjaRuns(d, p){
  const s = d.sig || {}, pes = s.pessoa ? pessoaPorId(s.pessoa) : null;
  if(!pes || s.sem) return null;
  const runs = [{ t:'Signatário: ' }, { t:titleCase(pes.nome), b:true }];
  if(pes.cargo) runs.push({ t:' (' + pes.cargo + ')' });
  runs.push({ t:', ' + dataExtenso(s.data || hojeISO()) });
  const q = procDaTarja(d, p);
  if(q && q.ficha && q.ficha.num){
    const tipo = tipoDoc(d);
    runs.push({ t:' · ' + (tipo === 'desp' ? 'Expedido nos autos do ' : tipo === 'dfd' ? 'Documento integrante do ' : 'Documento vinculado ao ') }, { t:'Processo Administrativo nº ' + q.ficha.num, b:true });
  }
  if(s.revit && q && revitTexto(q)) runs.push({ t:' · ' + revitTexto(q) + (tipoDoc(d) === 'dfd' && revitData(q) ? ', iniciado em ' + dataBR(revitData(q)) : '') });
  runs.push({ t:'.' });
  return runs;
}
/* processo citado na tarja: o escolhido na hora, o do próprio documento, ou nenhum */
function procDaTarja(d, p){
  const s = d.sig || {};
  if(s.vinculo === false || s.vinculo === 'nenhum') return null;
  if(typeof s.vinculo === 'string'){ const q = procPorId(s.vinculo); if(q) return q; }
  return p && !p.avulsa && !p.avdoc ? p : null;
}
function novoSig(pessoa, extra){ return Object.assign({ pessoa: pessoa || null, data:null, modo:'eletronica', vinculo:true, revit:false, sem:false }, extra || {}); }
function sigDoModelo(m){
  const id = m && m.sig === 'autoridade' ? (autoridade() || {}).id : m && m.sig;
  return novoSig(id && pessoaPorId(id) ? id : null, { sem: !!(m && m.tipo === 'anexo') });
}

/* ---------- estado ---------- */
let DB = null;   /* { v, procs:[], ui:{}, numint:{} } */
const novoProc = (extra) => Object.assign({ id:uid(), created:Date.now(), updated:Date.now(), cat:'diversos', status:'Em elaboração', fls0:1,
  ficha:{ extras:[] }, docs:[], tram:[], notas:[] }, extra || {});
function procAvulsa(){
  let p = DB.procs.find(x => x.avulsa);
  if(!p){ p = novoProc({ id:'avulsa', avulsa:true, ficha:{ num:'', objeto:'', extras:[] } }); DB.procs.push(p); }
  if(p.ficha.objeto === 'Mesa avulsa') p.ficha.objeto = '';
  return p;
}
const procPorId = id => DB.procs.find(p => p.id === id) || null;
const procsReais = () => DB.procs.filter(p => !p.avulsa && !p.avdoc);
const avulsosDoc = tipo => DB.procs.filter(p => p.avdoc && (!tipo || p.tipoAv === tipo));
const tituloProc = p => p.avulsa ? 'PDFs soltos' : p.avdoc ? (TIPO_NOME[p.tipoAv] || 'Documento') + (p.numint ? ' · ' + p.numint : '') : (p.ficha.num ? 'Processo ' + p.ficha.num : 'Processo sem número');
const objetoProc = p => p.avulsa ? 'PDFs e textos sem processo' : p.avdoc ? (p.ficha.objeto || 'Sem rótulo') : (p.ficha.objeto || 'Objeto não informado');
const touch = p => { if(p) p.updated = Date.now(); };
let _svT = null, DB_ERRO = false;
function saveDB(now){
  clearTimeout(_svT);
  if(DB_ERRO || !DB) return;
  const run = () => kvSet('db', DB);
  if(now) return run();
  _svT = setTimeout(run, 350);
}
function guardarAgora(){ try{ if(typeof salvarTudo === 'function') salvarTudo(); }catch(e){} if(DB && !DB_ERRO) kvSet('db', DB); }
window.addEventListener('pagehide', guardarAgora);
document.addEventListener('visibilitychange', () => { if(document.hidden) guardarAgora(); });

/* ---------- fixados e últimos ---------- */
function uiLista(k){ DB.ui = DB.ui || {}; if(!Array.isArray(DB.ui[k])) DB.ui[k] = []; DB.ui[k] = DB.ui[k].filter(id => procPorId(id)); return DB.ui[k]; }
const fixados = () => uiLista('fix').map(procPorId).filter(Boolean);
const estaFixado = p => uiLista('fix').includes(p.id);
function fixar(p, sim){ const L = uiLista('fix'); const i = L.indexOf(p.id); if(sim && i < 0) L.unshift(p.id); if(!sim && i >= 0) L.splice(i, 1); saveDB(); }
function moverFixado(p, dir){ const L = uiLista('fix'), i = L.indexOf(p.id), j = i + dir; if(i < 0 || j < 0 || j >= L.length) return; L.splice(i, 1); L.splice(j, 0, p.id); saveDB(); }
function marcarUltimo(p){ if(!p || p.avulsa) return; const L = uiLista('ult'); const i = L.indexOf(p.id); if(i >= 0) L.splice(i, 1); L.unshift(p.id); if(L.length > 5) L.length = 5; }
const ultimos = () => uiLista('ult').map(procPorId).filter(p => p && !estaFixado(p));

/* ---------- numeração interna dos avulsos: SEINFRA N. 001.26.09.2026 ---------- */
function numsDoDia(iso){ DB.numint = DB.numint || {}; return DB.numint[iso] || []; }
function seqLivre(iso){ const u = new Set(numsDoDia(iso).map(x => x.seq)); let n = 1; while(u.has(n)) n++; return n; }
function numintTexto(seq, iso){ const [y, m, d] = iso.split('-'); return String(seq).padStart(3, '0') + '.' + d + '.' + m + '.' + y; }
function reservarNum(seq, iso, tipo, rot){ DB.numint = DB.numint || {}; const L = DB.numint[iso] = DB.numint[iso] || []; if(!L.some(x => x.seq === seq)) L.push({ seq, tipo, rot:rot || '', hora:Date.now() }); }
function liberarNum(numint){
  const m = /^(\d{3})\.(\d{2})\.(\d{2})\.(\d{4})$/.exec(numint || ''); if(!m) return;
  const iso = m[4] + '-' + m[3] + '-' + m[2]; if(!DB.numint || !DB.numint[iso]) return;
  DB.numint[iso] = DB.numint[iso].filter(x => x.seq !== +m[1]);
}

/* ---------- anexos: acompanham o documento principal ---------- */
function ordenarAnexos(p){
  const principais = p.docs.filter(d => !d.pai || !p.docs.some(x => x.id === d.pai));
  const out = [];
  for(const d of principais){ out.push(d); p.docs.filter(x => x.pai === d.id).forEach(a => out.push(a)); }
  p.docs.splice(0, p.docs.length, ...out);
}
const anexosDe = (p, d) => p.docs.filter(x => x.pai === d.id);
function numeracaoLinha(p){
  const out = {}; let n = 0;
  for(const d of p.docs){
    if(!d.linha) continue;
    if(d.pai && out[d.pai]){ const pai = out[d.pai]; pai.k = (pai.k || 0) + 1; out[d.id] = { n:pai.n + '.' + pai.k }; }
    else { n++; out[d.id] = { n:String(n) }; }
  }
  return out;
}

function seedDB(){
  const p = novoProc({ cat:'aditivos', status:'Tramitando',
    ficha:{ num:'0000.2026', objeto:'Pavimentação e drenagem do bairro Exemplo – aditivo de prazo (exemplo)', modalidade:'Concorrência Eletrônica', setor:'Superintendência de Projetos e Fiscalização',
      contratada:'Construtora Exemplo Ltda.', cnpj:'00.000.000/0001-00', contrato:'000/2026', fiscal:'', valorInicial:'1850000', valorAtual:'', medido:'1147000',
      assinatura:'2026-02-10', inicio:'2026-03-02', prazo:'180', vigencia:'2027-02-10', tipoObj:'Aditivo', especie:'PRZ – Prazo', revitInicio:hojeISO(), revitSeq:1, extras:[] } });
  const nt = tplParaHTML('# NOTA TÉCNICA Nº 000/2026\n| **Assunto:** Pedido de prorrogação de prazo – Contrato nº {{contrato}}\n| **Interessada:** {{contratada}}\n| **Referência:** Processo Administrativo nº {{processo}}\n## 1. Objetivo\n1.1 Esta nota analisa o pedido de prorrogação de prazo apresentado pela contratada {{contratada}}, referente ao Contrato nº {{contrato}}.\n## 2. Histórico\n2.1 O contrato foi assinado com prazo de execução de {{prazo}}, contados da ordem de serviço.\n2.2 Durante a execução, a fiscalização registrou em diário de obra 23 dias de chuva com paralisação total dos serviços de terraplenagem.\n## 3. Análise\n3.1 As paralisações por chuva estão comprovadas pelos registros do diário de obra e caracterizam fato alheio à vontade das partes.\n3.2 O saldo contratual de {{saldo}} permanece compatível com o novo prazo proposto.\n## 4. Conclusão\n4.1 Do ponto de vista técnico, o pedido de prorrogação de 90 (noventa) dias é procedente.', p);
  p.docs.push({ id:uid(), kind:'texto', nome:'Nota técnica 000/2026', modelo:'nt', tipo:'nt', sig:novoSig('s2'), html:nt, bras:'todas', linha:true, repo:false, criado:Date.now(), mpi:true });
  const rem = MODELOS_PADRAO().find(m => m.id === 'desp-rem');
  p.docs.push({ id:uid(), kind:'texto', nome:'Despacho de remessa', modelo:'desp-rem', tipo:'desp', sig:novoSig('s1'), html:tplParaHTML(rem.texto, p), bras:'todas', linha:true, repo:false, criado:Date.now(), mpi:true });
  p.tram.push({ id:uid(), setor:'Superintendência de Projetos e Fiscalização', chegada:somaDias(hojeISO(), -6), saida:somaDias(hojeISO(), -1), acao:'Analisar pedido de aditivo de prazo' });
  p.tram.push({ id:uid(), setor:'Procuradoria-Geral do Município', chegada:somaDias(hojeISO(), -1), saida:'', acao:'Parecer jurídico sobre o aditivo' });
  p.notas.push({ id:uid(), tipo:'pend', t:'Juntar cronograma físico-financeiro revisado', resp:'Contratada', prazo:somaDias(hojeISO(), 5), ok:false, criado:Date.now() });
  p.notas.push({ id:uid(), tipo:'def', t:'Aditivo só de prazo, sem alteração de valor', resp:'', ok:false, criado:Date.now() });
  return { v:4, procs:[p], ui:{ tab:'procs', fix:[p.id], ult:[] }, numint:{} };
}

/* ---------- migração: documentos do padrão antigo (Proc.Ios) para o padrão MPI ---------- */
function migrarDoc(d){
  if(d.kind !== 'texto') return;
  if(typeof d.sig === 'string' || !d.sig) d.sig = novoSig(typeof d.sig === 'string' && pessoaPorId(d.sig) ? d.sig : null);
  if(!d.tipo) d.tipo = tipoDoc(d);
  if(d.mpi) return;
  d.mpi = true;
  if(!d.html) return;
  const box = document.createElement('div'); box.innerHTML = d.html;
  const els = Array.from(box.children).filter(e => e.textContent.trim());
  if(!els.length) return;
  /* fecho antigo: [cidade, data] + nome + cargo → sai do texto (agora é automático) */
  const nomes = (settings.signatarios || []).map(s => norm(s.nome));
  const ult = els.slice(-3);
  const ehNome = e => e.querySelector('[data-f="assinante"]') || nomes.includes(norm(e.textContent.trim()));
  const ehCargo = e => e.querySelector('[data-f="cargo_assinante"]') || (settings.signatarios || []).some(s => s.cargo && norm(e.textContent).startsWith(norm(s.cargo)));
  const ehLocal = e => e.querySelector('[data-f="cidade"]') || /^ilh[eé]us\b.*\d{4}\.?$/i.test(e.textContent.trim());
  if(ult.length >= 2 && ehNome(ult[ult.length - 2]) && ehCargo(ult[ult.length - 1])){
    const nomeTxt = norm(ult[ult.length - 2].textContent.trim()); const achou = (settings.signatarios || []).find(s => norm(s.nome) === nomeTxt);
    if(achou && !d.sig.pessoa) d.sig.pessoa = achou.id;
    ult[ult.length - 1].remove(); ult[ult.length - 2].remove();
    if(ult.length === 3 && ehLocal(ult[0])) ult[0].remove();
  }
  const resto = Array.from(box.children).filter(e => e.textContent.trim());
  /* 1ª linha → título; 2ª linha curta em caixa alta → identificação */
  if(!box.querySelector('h1') && resto[0] && resto[0].tagName === 'P' && !resto[0].className){
    const h = document.createElement('h1'); h.innerHTML = resto[0].innerHTML; resto[0].replaceWith(h);
    const r1 = resto[1];
    if(r1 && r1.tagName === 'P' && !r1.className && r1.textContent.trim().length < 140 && r1.textContent === r1.textContent.toLocaleUpperCase('pt-BR')) r1.classList.add('id');
  }
  d.html = box.innerHTML; d.pags = null;
}
function migrarDB(){
  if(!DB) return;
  DB.ui = DB.ui || {}; DB.numint = DB.numint || {};
  if(!Array.isArray(DB.ui.fix)) DB.ui.fix = [];
  if(!Array.isArray(DB.ui.ult)) DB.ui.ult = [];
  for(const p of DB.procs){
    for(const d of p.docs) migrarDoc(d);
    if(!p.avulsa && !p.avdoc && p.ficha && !p.ficha.revitInicio && (DB.v || 3) < 4){ /* sem data inventada: fica em branco até você informar */ }
  }
  DB.v = 4;
}

/* ---------- arquivos (PDF) no aparelho ----------
   doc pdf = { id, kind:'pdf', nome, fileId, pages, pl:[{s,r,b,d}], sz:[[w,h,rot]] }
   s: página do original (-1 = em branco) · r: giro extra · b: brasão · d: retirada */
const BYTES = new Map();
async function bytesDe(fileId){
  if(BYTES.has(fileId)){ const v = BYTES.get(fileId); BYTES.delete(fileId); BYTES.set(fileId, v); return v; }
  const rec = await idbDo('files', 'readonly', st => st.get(fileId));
  if(!rec) return null;
  const b = rec.bytes instanceof Uint8Array ? rec.bytes : new Uint8Array(rec.bytes);
  BYTES.set(fileId, b);
  while(BYTES.size > 8){ const k = BYTES.keys().next().value; BYTES.delete(k); }
  return b;
}
async function guardarBytes(bytes, name, id){
  id = id || uid();
  const r = await idbDo('files', 'readwrite', st => st.put({ id, name, bytes }));
  if(r === undefined) throw new Error('Sem espaço ou sem permissão para guardar arquivos neste aparelho.');
  BYTES.set(id, bytes);
  return id;
}
const fileEmUso = (fileId, exceto) => DB.procs.some(q => q.docs.some(x => x !== exceto && x.kind === 'pdf' && x.fileId === fileId));
const apagarBytes = id => { BYTES.delete(id); dropPdf(id); return idbDo('files', 'readwrite', st => st.delete(id)); };
async function medirPdf(bytes){
  const pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption:true, updateMetadata:false });
  return pdf.getPages().map(pg => { let s; try{ s = pg.getCropBox(); }catch(e){ s = pg.getSize(); } if(!s || !s.width) s = pg.getSize(); return [Math.round(s.width * 10) / 10, Math.round(s.height * 10) / 10, ((pg.getRotation().angle || 0) % 360 + 360) % 360]; });
}
async function novoDocPdf(p, name, bytes, onde){
  const sz = await medirPdf(bytes);
  const fileId = await guardarBytes(bytes, name);
  const d = { id:uid(), kind:'pdf', nome:String(name || 'Arquivo').replace(/\.(pdf|jpe?g|png|webp|heic|gif|bmp)$/i, ''), fileId, pages:sz.length,
    pl:sz.map((_, i) => ({ s:i, r:0, b:false, d:false })), sz, linha: onde !== 'repo', repo: onde === 'repo' || onde === 'ambos', criado:Date.now() };
  p.docs.push(d); touch(p);
  return d;
}
const vivas = d => d.kind === 'pdf' ? d.pl.filter(e => !e.d) : [];
function tamanhoPagina(d, e){
  if(e.s < 0) return [PAG.retrato.W, PAG.retrato.H];
  const z = (d.sz && d.sz[e.s]) || [PAG.retrato.W, PAG.retrato.H, 0];
  const rot = ((z[2] || 0) + (e.r || 0)) % 360;
  return rot === 90 || rot === 270 ? [z[1], z[0]] : [z[0], z[1]];
}
/* nº de páginas de cada documento (textos: diagramação real do PDF) */
function paginasDoc(d){ return d.kind === 'pdf' ? vivas(d).length : (d.pags || 1); }
function folhas(p){
  const out = {}; let n = parseInt(p.fls0, 10) || 1;
  for(const d of p.docs){ if(!d.linha) continue; const k = paginasDoc(d); out[d.id] = { ini:n, fim:n + k - 1, k }; n += k; }
  /* k = 0: documento sem páginas (todas retiradas) */
  out._total = n - (parseInt(p.fls0, 10) || 1);
  return out;
}
/* local e situação atual (tramitação) */
function ondeEsta(p){ const t = p.tram[p.tram.length - 1]; return t ? t.setor : ''; }
function tramAtual(p){ return p.tram[p.tram.length - 1] || null; }
const pendAbertas = p => p.notas.filter(n => n.tipo === 'pend' && !n.ok);

/* ---------- importação do Proc.Ios 2 (mesmo endereço) ---------- */
async function importarV2(){
  let st = null;
  if(DB && DB.importouV2) return 0;
  try{ st = JSON.parse(localStorage.getItem('procios.state') || 'null'); }catch(e){}
  if(!st || !Array.isArray(st.procs) || !st.procs.length) return 0;
  let arquivos = [];
  try{
    arquivos = await new Promise(res => {
      const r = indexedDB.open('procios', 1);
      r.onupgradeneeded = () => { r.transaction.abort(); res([]); };
      r.onsuccess = () => { try{ const q = r.result.transaction('files', 'readonly').objectStore('files').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }catch(e){ res([]); } };
      r.onerror = () => res([]);
    });
  }catch(e){ arquivos = []; }
  const porId = {}; arquivos.forEach(f => porId[f.id] = f);
  const n = await converterV2(st, async id => porId[id] ? { name:porId[id].name, bytes:porId[id].bytes, pl:porId[id].pl } : null);
  if(n) DB.importouV2 = true;
  return n;
}
/* converte processos do Proc.Ios 2 (do aparelho ou de um backup) */
async function converterV2(st, arquivo){
  let n = 0;
  for(const q of st.procs){
    const i = q.info || {};
    const p = novoProc({ cat:q.cat || 'diversos', ficha:{ num:i.num || '', objeto:i.objeto || i.title || '', modalidade:i.modalidade || '', contratada:i.contratada || '', contrato:i.contrato || '',
      fiscal:i.fiscal || '', valorInicial:i.inicial ? String(i.inicial) : '', medido:i.medido ? String(i.medido) : '', assinatura:i.assinatura || '', inicio:i.os || '', prazo:i.prazo ? String(i.prazo) : '', vigencia:i.vigencia || '', extras:[] } });
    for(const d of (q.docs || [])){
      if(d.html && d.html.replace(/<[^>]+>/g, '').trim()) p.docs.push({ id:uid(), kind:'texto', nome:titleOf(d.html), html:d.html, bras:d.bras || 'todas', linha:true, repo:false, criado:Date.now() }); migrarDoc(p.docs[p.docs.length - 1]);
      for(const fid of (d.files || [])){
        const f = await arquivo(fid); if(!f || !f.bytes) continue;
        try{
          const bytes = f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes);
          const nd = await novoDocPdf(p, f.name, bytes, 'linha');
          if(Array.isArray(f.pl) && f.pl.length) nd.pl = f.pl;
        }catch(e){}
      }
    }
    DB.procs.push(p); n++;
  }
  return n;
}
function titleOf(html){
  const d = document.createElement('div'); d.innerHTML = html || '';
  const el = Array.from(d.children).find(x => x.textContent.trim());
  const t = el ? el.textContent.split('\n')[0].trim() : '';
  if(!t) return 'Documento sem título';
  const c = t.toLocaleLowerCase('pt-BR');
  return (c.charAt(0).toLocaleUpperCase('pt-BR') + c.slice(1)).slice(0, 70);
}

/* recalcula o nº de páginas dos textos (relatório, ajustes, documento movido) */
async function recontar(p, forcar){
  if(!window.PDFLib) return false;
  let mudou = false;
  for(const d of p.docs){
    if(d.kind !== 'texto' || (!forcar && d.pags)) continue;
    try{ const r = await diagramarTexto(d.html || '', d); if(d.pags !== r.n){ d.pags = r.n; mudou = true; } }catch(e){}
  }
  if(mudou) saveDB();
  return mudou;
}

/* ===== d_ui.js ===== */
/* =====================================================================
   Folhas (sheets), menus, perguntas, arquivo pronto, prévia
   ===================================================================== */
const SHEETS = [];
function sheet(o){
  const bg = h('div', { class:'sh-bg' });
  const fechar = h('button', { class:'ib', 'aria-label':'Fechar', html:I.x });
  const corpo = h('div', { class:'shb' }, o.corpo || null);
  const el = h('div', { class:'sh' + (o.cheio ? ' cheio' : '') + (o.alerta ? ' alerta' : ''), role:o.alerta ? 'alertdialog' : 'dialog', 'aria-modal':'true', 'aria-label':o.titulo || '' },
    h('div', { class:'shh' }, h('h3', null, o.titulo || ''), o.cabExtra || null, fechar), corpo);
  const s = { el, corpo, fechado:false,
    fechar(v){ if(s.fechado) return; s.fechado = true; bg.remove(); el.remove(); const i = SHEETS.indexOf(s); if(i >= 0) SHEETS.splice(i, 1); if(o.aoFechar) o.aoFechar(v); },
    rodape(btns){
      const old = el.querySelector('.shf'); if(old) old.remove();
      if(!btns || !btns.length) return;
      el.append(h('div', { class:'shf' }, btns.filter(Boolean).map(b => h('button', { class:'btn ' + (b.v || ''), disabled:b.disabled, onclick:async () => { if(b.fn){ const r = await b.fn(s); if(r === false || b.fica) return; } s.fechar(); } }, b.ic ? h('span', { html:I[b.ic] }) : null, b.t))));
    }
  };
  fechar.onclick = () => s.fechar();
  if(!o.fixo) bg.onclick = () => s.fechar();
  s.rodape(o.botoes);
  $('sheets').append(bg, el); SHEETS.push(s);
  /* como no iPhone: puxar a folha para baixo pelo topo fecha */
  if(!o.alerta && !o.fixo && window.innerWidth < 720){
    const hd = el.querySelector('.shh'); let y0 = null, dy = 0;
    hd.addEventListener('pointerdown', e => { if(e.target.closest('button,input,select,textarea')) return; y0 = e.clientY; dy = 0; el.style.transition = 'none'; try{ hd.setPointerCapture(e.pointerId); }catch(err){} });
    hd.addEventListener('pointermove', e => { if(y0 == null) return; dy = Math.max(0, e.clientY - y0); el.style.transform = dy ? 'translateY(' + dy + 'px)' : ''; });
    const fim = () => { if(y0 == null) return; y0 = null; el.style.transition = 'transform .2s ease'; if(dy > 90){ el.style.transform = 'translateY(100%)'; setTimeout(() => s.fechar(), 180); } else el.style.transform = ''; };
    hd.addEventListener('pointerup', fim); hd.addEventListener('pointercancel', fim);
  }
  if(o.foco !== false) setTimeout(() => { const f = el.querySelector('[autofocus]'); if(f) f.focus(); }, 80);
  return s;
}
/* menu suspenso no estilo iOS, preso a um botão (o "+") */
function popMenu(ancora, itens, o = {}){
  const r = ancora.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
  const bg = h('div', { class:'pm-bg' }), box = h('div', { class:'pm', role:'menu' });
  const reg = { fechar(){ if(reg.f) return; reg.f = true; bg.remove(); box.remove(); const i = SHEETS.indexOf(reg); if(i >= 0) SHEETS.splice(i, 1); if(o.aoFechar) o.aoFechar(); } };
  itens.forEach(it => {
    if(!it) return;
    if(it === '-'){ if(box.lastChild && !box.lastChild.classList.contains('pm-sep')) box.append(h('div', { class:'pm-sep' })); return; }
    box.append(h('button', { class:'pm-i' + (it.danger ? ' danger' : '') + (it.on ? ' on' : ''), role:'menuitem', disabled:it.off, onclick:() => { reg.fechar(); it.fn(); } },
      h('span', null, it.t, it.sub ? h('small', null, it.sub) : null), it.ic ? h('i', { html:I[it.ic] || '' }) : null));
  });
  bg.onclick = () => reg.fechar();
  [bg, box].forEach(x => x.addEventListener('pointerdown', ev => ev.preventDefault()));   // não tira o cursor do texto
  document.body.append(bg, box); SHEETS.push(reg);
  const bw = box.offsetWidth, bh = box.offsetHeight;
  let x = r.left + r.width / 2 > W / 2 ? r.right - bw : r.left; x = Math.max(8, Math.min(W - bw - 8, x));
  let y = r.top + r.height / 2 < H / 2 ? r.bottom + 6 : r.top - bh - 8; y = Math.max(8, Math.min(H - bh - 8, y));
  box.style.left = x + 'px'; box.style.top = y + 'px';
  return reg;
}
const fecharFolhaTopo = () => { const s = SHEETS[SHEETS.length - 1]; if(s){ s.fechar(); return true; } return false; };
function menu(titulo, itens, ancora){
  if(ancora && ancora.isConnected) return popMenu(ancora, itens);
  const s = sheet({ titulo, corpo:itens.filter(Boolean).map(it => {
    if(it === '-') return h('div', { class:'msep' });
    return h('button', { class:'mitem' + (it.danger ? ' danger' : ''), onclick:() => { s.fechar(); it.fn(); } },
      it.ic ? h('span', { html:I[it.ic] || '' }) : null, h('span', { class:'grow' }, it.t, it.sub ? h('small', null, it.sub) : null));
  }) });
  return s;
}
function confirmar(titulo, msg, rotulo, perigo){
  return new Promise(res => {
    let ok = false;
    sheet({ titulo, alerta:true, corpo:h('p', { style:{ margin:'0' } }, msg || ''), aoFechar:() => res(ok),
      botoes:[{ t:'Cancelar', v:'ghost' }, { t:rotulo || 'Confirmar', v:perigo ? 'danger' : 'pri', fn:() => { ok = true; } }] });
  });
}
function perguntar(titulo, rotulo, valor, ok, o = {}){
  return new Promise(res => {
    let out = null;
    const inp = o.area ? h('textarea', { class:'txa', autofocus:true }) : h('input', { class:'inp', type:o.tipo || 'text', autofocus:true, list:o.lista || null });
    inp.value = valor || '';
    const s = sheet({ titulo, alerta:true, corpo:[h('label', { class:'fld' }, h('span', null, rotulo), inp), o.dica ? h('p', { class:'muted', style:{ margin:0, fontSize:'13px' } }, o.dica) : null], aoFechar:() => res(out),
      botoes:[{ t:'Cancelar', v:'ghost' }, { t:ok || 'OK', v:'pri', fn:() => { out = inp.value.trim(); } }] });
    if(!o.area) inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ out = inp.value.trim(); s.fechar(); } });
    setTimeout(() => { inp.focus(); if(inp.select) inp.select(); }, 90);
  });
}
function escolher(titulo, opcoes, atual){
  return new Promise(res => {
    let v = null;
    const s = sheet({ titulo, aoFechar:() => res(v), corpo:opcoes.map(o => h('button', { class:'mitem', onclick:() => { v = o[0]; s.fechar(); } },
      h('span', { class:'grow' }, o[1], o[2] ? h('small', null, o[2]) : null), o[0] === atual ? h('span', { html:I.check, style:{ color:'var(--accent)' } }) : null)) });
  });
}

/* ---------- arquivo pronto: compartilhar ou baixar ---------- */
const MIME = { pdf:'application/pdf', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip:'application/zip', txt:'text/plain', json:'application/json' };
async function offer(data, name, o = {}){
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
  const blob = data instanceof Blob ? data : new Blob([data], { type:MIME[ext] || 'application/octet-stream' });
  if(!PWA && window.claude && window.claude.use){
    const dl = await window.claude.use('downloads');
    if(!dl){ toast('Salvar arquivos não está disponível nesta visualização. Instale o app no celular para compartilhar.'); return; }
    try{ await dl.save({ filename:name, data:blob }); toast('Arquivo salvo.'); }
    catch(e){ if(e && e.code !== 'declined' && e.code !== 'cancelled') toast('O arquivo não foi salvo. Tente de novo.'); }
    return;
  }
  const file = new File([blob], name, { type:MIME[ext] || blob.type || 'application/octet-stream' });
  let pode = false;
  try{ pode = !!(navigator.canShare && navigator.canShare({ files:[file] })); }catch(e){}
  const baixar = () => { const a = h('a', { href:URL.createObjectURL(file), download:name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); toast('Arquivo baixado.'); };
  sheet({ titulo:'Arquivo pronto', corpo:[
    h('div', { class:'opt' }, h('span', { html:ext === 'docx' ? I.word : ext === 'zip' ? I.folder : I.pdf }), h('b', { class:'grow', style:{ overflowWrap:'anywhere' } }, name)),
    pode ? h('p', { class:'muted', style:{ margin:0, fontSize:'13px' } }, 'Compartilhar abre o menu do Android: WhatsApp, Gmail, Drive…') : null
  ], botoes:[
    pode ? { t:'Compartilhar', v:'acc', ic:'share', fn:async () => { try{ await navigator.share({ files:[file], title:name, text:o.texto || undefined }); }catch(e){ if(!e || e.name !== 'AbortError') toast('Não foi possível compartilhar. Use Baixar.'); } } } : null,
    { t:'Baixar', v:pode ? 'ghost' : 'pri', ic:'dl', fn:baixar }
  ] });
}
async function copiarTexto(t, ok){
  try{ await navigator.clipboard.writeText(t); toast(ok || 'Copiado.'); return true; }
  catch(e){
    const ta = h('textarea', { style:{ position:'fixed', opacity:'0' } }); ta.value = t; document.body.append(ta); ta.select();
    let r = false; try{ r = document.execCommand('copy'); }catch(err){}
    ta.remove();
    if(r){ toast(ok || 'Copiado.'); return true; }
    sheet({ titulo:'Copie o texto', corpo:h('textarea', { class:'txa', style:{ minHeight:'240px' }, readonly:true }, t) });
    return false;
  }
}

/* ---------- pdf.js ---------- */
const PDFJS = new Map();
function getPdf(key, bytes){
  const c = PDFJS.get(key);
  if(c && c.bytes === bytes) return c.p;
  if(c) c.p.then(d => d.destroy()).catch(() => {});
  const p = pdfjsLib.getDocument(Object.assign({ data:bytes.slice(), isEvalSupported:false }, window.PDFJS_OPTS || {})).promise;
  PDFJS.set(key, { bytes, p });
  if(PDFJS.size > 10){ for(const k of PDFJS.keys()){ if(k !== key){ PDFJS.get(k).p.then(d => d.destroy()).catch(() => {}); PDFJS.delete(k); break; } } }
  return p;
}
function dropPdf(key){ const c = PDFJS.get(key); if(c){ c.p.then(d => d.destroy()).catch(() => {}); PDFJS.delete(key); } }
function drawBrasOverlay(ctx, sc, VW){
  /* igual ao PDF gerado: só o brasão, centralizado no alto da página */
  const bw = 43, bh = 46.7, top = 14.17, cx = VW / 2;
  try{ ctx.drawImage(BRAS_IMG, (cx - bw / 2) * sc, top * sc, bw * sc, bh * sc); }catch(e){}
}
async function desenharPaginaPdf(cv, pdfDoc, e, cssW){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if(cv._task){ try{ cv._task.cancel(); }catch(err){} cv._task = null; }
  if(e.s < 0){
    const W = PAG.retrato.W, H = PAG.retrato.H, k = cssW * dpr / W;
    cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    if(e.b) drawBrasOverlay(ctx, k, W);
    return;
  }
  const pg = await pdfDoc.getPage(e.s + 1);
  const rot = ((pg.rotate + (e.r || 0)) % 360 + 360) % 360;
  const v1 = pg.getViewport({ scale:1, rotation:rot });
  const k = cssW * dpr / v1.width;
  const vp = pg.getViewport({ scale:k, rotation:rot });
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.floor(vp.width)); off.height = Math.max(1, Math.floor(vp.height));
  const octx = off.getContext('2d'); octx.fillStyle = '#fff'; octx.fillRect(0, 0, off.width, off.height);
  const task = pg.render({ canvasContext:octx, viewport:vp, canvas:off });
  cv._task = task;
  try{ await task.promise; }catch(err){ if(cv._task === task) cv._task = null; throw err; }
  if(cv._task === task) cv._task = null;
  if(e.b) drawBrasOverlay(octx, k, v1.width);
  cv.width = off.width; cv.height = off.height;
  cv.getContext('2d').drawImage(off, 0, 0);
}
const temPdfjs = () => !!window.pdfjsLib;
function precisaLibs(){
  if(!window.PDFLib || !window.JSZip){ toast('As ferramentas de PDF ainda estão carregando. Verifique a internet e tente de novo.'); return false; }
  return true;
}

/* ---------- prévia de um PDF gerado ---------- */
let PREV = null;
async function previa(bytes, nome){
  const eu = PREV = { bytes, nome };
  $('pvTit').textContent = nome.replace(/\.pdf$/i, '');
  const box = $('prevPages'); box.replaceChildren(h('div', { class:'muted', style:{ padding:'30px' } }, 'Abrindo…'));
  $('vPrev').hidden = false;
  if(!temPdfjs()){ box.replaceChildren(h('div', { class:'empty' }, 'A prévia precisa do leitor de PDF, que ainda está carregando.')); return; }
  try{
    const doc = await getPdf('prev', bytes);
    if(PREV !== eu) return;
    box.replaceChildren();
    for(let i = 1; i <= doc.numPages; i++){
      if(PREV !== eu) return;
      const cv = h('canvas'); box.append(cv);
      const pg = await doc.getPage(i), v = pg.getViewport({ scale:1 });
      const w = Math.min(window.innerWidth * 0.92, 760), k = w * Math.min(devicePixelRatio || 1, 2) / v.width, vp = pg.getViewport({ scale:k });
      cv.width = vp.width; cv.height = vp.height;
      await pg.render({ canvasContext:cv.getContext('2d'), viewport:vp }).promise;
    }
  }catch(e){ if(PREV === eu) box.replaceChildren(h('div', { class:'empty' }, 'Não foi possível mostrar a prévia.')); }
}
$('pvBack').onclick = () => { $('vPrev').hidden = true; dropPdf('prev'); PREV = null; };
$('pvSend').onclick = () => { if(PREV) offer(PREV.bytes, PREV.nome); };

/* ---------- entrada de arquivos (PDF, fotos, ZIP do WhatsApp) ---------- */
const RX_PDF = /\.pdf$/i, RX_IMG = /\.(jpe?g|png|webp|gif|bmp|heic)$/i;
async function expandirEntradas(list){
  const out = [];
  for(const file of list){
    const nm = file.name || 'arquivo';
    if(file.bytes && !(file instanceof Blob)){ if(file.tipo !== 'outro') out.push({ name:nm, bytes:file.bytes }); continue; }   /* já lido (triagem) */
    if(/\.zip$/i.test(nm) || /zip/.test(file.type || '')){
      try{
        const z = await JSZip.loadAsync(file);
        const ents = Object.values(z.files).filter(en => !en.dir && !/(^|\/)(__MACOSX|\.)/.test(en.name) && (RX_PDF.test(en.name) || RX_IMG.test(en.name)))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric:true }));
        if(!ents.length){ toast('Nenhum PDF ou foto dentro de ' + nm + '.'); continue; }
        const esc_ = ents.length > 1 ? await escolherDoZip(nm, ents) : ents;
        for(const en of esc_) out.push({ name:en.name.split('/').pop(), bytes:await en.async('uint8array') });
      }catch(e){ toast('Não foi possível abrir ' + nm + '.'); }
    } else if(RX_PDF.test(nm) || file.type === 'application/pdf' || RX_IMG.test(nm) || /^image\//.test(file.type || '')){
      let name = nm;
      if(!RX_PDF.test(name) && !RX_IMG.test(name)) name += file.type === 'application/pdf' ? '.pdf' : '.jpg';
      out.push({ name, bytes:new Uint8Array(await file.arrayBuffer()) });
    } else toast(nm + ': envie PDF, foto ou ZIP.');
  }
  return out;
}
function escolherDoZip(nome, ents){
  return new Promise(res => {
    let out = [];
    const boxes = ents.map(en => h('input', { type:'checkbox', checked:true }));
    const lista = ents.map((en, i) => h('label', { class:'zitem' }, boxes[i], h('span', { class:'grow' }, en.name.split('/').pop())));
    sheet({ titulo:'Arquivos do ZIP', corpo:[h('p', { class:'muted', style:{ margin:0 } }, nome + ' · ' + plural(ents.length, 'arquivo', 'arquivos')),
      h('div', { class:'row' }, h('button', { class:'btn sm soft', onclick:() => boxes.forEach(b => b.checked = true) }, 'Marcar todos'), h('button', { class:'btn sm soft', onclick:() => boxes.forEach(b => b.checked = false) }, 'Desmarcar')),
      h('div', null, lista)], aoFechar:() => res(out),
      botoes:[{ t:'Cancelar', v:'ghost' }, { t:'Incluir marcados', v:'pri', fn:() => { out = ents.filter((_, i) => boxes[i].checked); } }] });
  });
}
let _fileCb = null;
function escolherArquivos(cb){ _fileCb = cb; $('fileIn').click(); }
$('fileIn').onchange = e => { const l = [...e.target.files]; e.target.value = ''; if(l.length && _fileCb) _fileCb(l); };
/* inclui arquivos num processo; onde = 'linha' | 'repo' | 'ambos' ; depois = id do doc após o qual inserir */
async function incluirArquivos(p, list, onde, depois){
  if(!precisaLibs()) return [];
  const ents = await expandirEntradas(list);
  if(!ents.length) return [];
  const b = busy('Preparando arquivos…'), novos = [];
  try{
    for(const it of ents){
      b.txt('Lendo ' + it.name + '…');
      try{
        const bytes = RX_IMG.test(it.name) ? await PDFGen.imageToPdf(it.bytes, it.name) : it.bytes;
        const d = await novoDocPdf(p, it.name, bytes, onde);
        novos.push(d);
      }catch(err){ toast('Não foi possível abrir ' + it.name + (/encrypt/i.test(String(err && err.message)) ? ' (PDF protegido).' : '.')); }
    }
  } finally { b.end(); }
  if(novos.length && depois){
    const i = p.docs.findIndex(d => d.id === depois);
    if(i >= 0){ p.docs = p.docs.filter(d => !novos.includes(d)); p.docs.splice(i + 1, 0, ...novos); }
  }
  if(novos.length){ touch(p); saveDB(true); }
  return novos;
}


/* ---------- triagem: ZIP e vários arquivos ----------
   Cada arquivo ganha Linha / Repositório / Ignorar. Word, Excel, DWG e outros ficam em Ignorar. */
const RX_OUTRO = /\.[a-z0-9]{2,5}$/i;
async function expandirTudo(list){
  const out = [];
  for(const file of list){
    const nm = file.name || 'arquivo';
    if(/\.zip$/i.test(nm) || /zip/.test(file.type || '')){
      try{
        const z = await JSZip.loadAsync(file);
        const ents = Object.values(z.files).filter(en => !en.dir && !/(^|\/)(__MACOSX|\.)/.test(en.name)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric:true }));
        for(const en of ents){
          const name = en.name.split('/').pop();
          if(RX_PDF.test(name) || RX_IMG.test(name)) out.push({ name, bytes:await en.async('uint8array'), tipo: RX_PDF.test(name) ? 'pdf' : 'img', zip:nm });
          else out.push({ name, bytes:null, tipo:'outro', zip:nm });
        }
      }catch(e){ toast('Não foi possível abrir ' + nm + '.'); }
    } else if(RX_PDF.test(nm) || file.type === 'application/pdf'){
      out.push({ name: RX_PDF.test(nm) ? nm : nm + '.pdf', bytes:new Uint8Array(await file.arrayBuffer()), tipo:'pdf' });
    } else if(RX_IMG.test(nm) || /^image\//.test(file.type || '')){
      out.push({ name: RX_IMG.test(nm) ? nm : nm + '.jpg', bytes:new Uint8Array(await file.arrayBuffer()), tipo:'img' });
    } else out.push({ name:nm, bytes:null, tipo:'outro' });
  }
  return out;
}
async function infoPdf(bytes){
  try{ const sz = await medirPdf(bytes); const deit = sz.filter(z => { const r = (z[2] || 0) % 180; return r ? z[1] > z[0] : z[0] > z[1]; }).length; return { n:sz.length, deitadas:deit }; }
  catch(e){ return { n:0, deitadas:0, erro:true }; }
}
async function triagemSheet(ents, destinoFixo){
  const b0 = busy('Lendo arquivos…');
  for(const e of ents){ e.dest = e.tipo === 'outro' ? 'ignorar' : 'linha'; e.giro = 0; if(e.tipo === 'pdf') e.info = await infoPdf(e.bytes); else if(e.tipo === 'img') e.info = { n:1, deitadas:0 }; }
  b0.end();
  let destino = destinoFixo || (VIEW === 'mesa' && M.p && !M.p.avdoc ? M.p.id : 'avulsa');
  const lista = h('div', { style:{ display:'flex', flexDirection:'column', gap:'8px' } });
  const pe = h('div', { class:'shf' });
  const bubs = (e) => h('div', { class:'pbub', style:{ margin:'6px 0 0' } }, [['linha', 'Linha'], ['repo', 'Repositório'], ['ignorar', 'Ignorar']].map(([k, t]) => {
    const bt = h('button', { style: e.dest === k ? { background:'var(--accent-soft)', borderColor:'var(--accent)', color:'var(--accent)' } : null, disabled: e.tipo === 'outro' && k !== 'ignorar', onclick:() => { e.dest = k; pinta(); } }, t); return bt; }));
  function pinta(){
    lista.replaceChildren();
    ents.forEach(e => {
      const sub = e.tipo === 'outro' ? 'não é PDF (fica de fora)' : (e.info && e.info.n ? plural(e.info.n, 'página', 'páginas') : '') + (e.info && e.info.deitadas ? ' · ' + (e.info.deitadas === e.info.n ? 'deitada' : e.info.deitadas + ' deitadas') : '');
      const card = h('div', { class:'rvItem' }, h('div', null, h('b', { style:{ fontSize:'14px', overflowWrap:'anywhere' } }, e.name), h('div', { class:'muted', style:{ fontSize:'12.5px' } }, sub)), bubs(e));
      if(e.info && e.info.deitadas && e.dest !== 'ignorar') card.append(h('button', { class:'btn sm ghost', style:{ alignSelf:'flex-start', color:'var(--accent)' }, onclick:() => { e.giro = (e.giro + 90) % 360; pinta(); } }, h('span', { html:I.rotR }), e.giro ? 'Girado ' + e.giro + '° (toque para girar mais)' : 'Página deitada: girar o arquivo todo?'));
      lista.append(card);
    });
    const n = ents.filter(e => e.dest !== 'ignorar').length;
    const ps = [['avulsa', 'PDFs soltos']].concat(fixados().filter(p => !p.avdoc).map(p => [p.id, p.ficha.objeto || tituloProc(p)])).concat(procsReais().filter(p => !estaFixado(p)).sort((a, b) => b.updated - a.updated).slice(0, 4).map(p => [p.id, p.ficha.objeto || tituloProc(p)])).concat([['novo', '+ Novo processo']]);
    if(destino !== 'avulsa' && destino !== 'novo' && !ps.some(x => x[0] === destino)){ const pp = procPorId(destino); if(pp) ps.splice(1, 0, [pp.id, pp.ficha.objeto || tituloProc(pp)]); }
    pe.replaceChildren(h('div', { style:{ width:'100%', display:'flex', flexDirection:'column', gap:'8px' } },
      h('div', { class:'lbl' }, 'Destino'),
      h('div', { class:'pbub', style:{ margin:0 } }, ps.map(([id, t]) => h('button', { style: destino === id ? { background:'var(--accent-soft)', borderColor:'var(--accent)', color:'var(--accent)' } : null, onclick:() => { destino = id; pinta(); } }, t.length > 34 ? t.slice(0, 33) + '…' : t))),
      h('button', { class:'btn acc', disabled:!n, onclick:() => incluir() }, n ? 'Incluir ' + plural(n, 'arquivo', 'arquivos') : 'Nada para incluir')));
  }
  const s = sheet({ titulo:'Arquivos recebidos', cheio:true, corpo:[h('p', { class:'muted', style:{ margin:0, fontSize:'13px' } }, 'Escolha para onde vai cada arquivo. Planilha deitada pode ser girada aqui ou depois, na mesa.'), lista] });
  s.el.append(pe);
  pinta();
  async function incluir(){
    let p = destino === 'avulsa' ? procAvulsa() : destino === 'novo' ? null : procPorId(destino);
    if(!p){ p = novoProc({ ficha:{ objeto:'', extras:[] } }); DB.procs.push(p); }
    s.fechar();
    const b = busy('Incluindo arquivos…'), novos = [];
    try{
      for(const e of ents){
        if(e.dest === 'ignorar' || !e.bytes) continue;
        b.txt('Lendo ' + e.name + '…');
        try{
          const bytes = e.tipo === 'img' ? await PDFGen.imageToPdf(e.bytes, e.name) : e.bytes;
          const d = await novoDocPdf(p, e.name, bytes, e.dest);
          if(e.giro) d.pl.forEach(x => x.r = e.giro);
          novos.push(d);
        }catch(err){ toast('Não foi possível abrir ' + e.name + (/encrypt/i.test(String(err && err.message)) ? ' (PDF protegido).' : '.')); }
      }
    } finally { b.end(); }
    touch(p); marcarUltimo(p); saveDB(true);
    abrirMesa(p, { pdf: p.avulsa, doc:novos[0] && novos[0].id });
    if(destino === 'novo') setTimeout(() => fichaSheet(p), 300);
    toast(plural(novos.length, 'arquivo incluído', 'arquivos incluídos') + '.');
  }
}

/* =====================================================================
   Inteligência artificial (revisão de texto)
   No link do Claude: usa a sua conta do Claude. No app instalado: chave de API
   do Claude ou do Gemini (Ajustes). Sem chave: copia e abre o app escolhido.
   ===================================================================== */
async function iaDisponivel(){
  if(!PWA && window.claude && window.claude.use){ try{ const s = await window.claude.use('sample'); if(s) return { tipo:'claude-app', s }; }catch(e){} }
  const ia = settings.ia || {};
  if((ia.prov === 'claude' || ia.prov === 'auto') && ia.claudeKey) return { tipo:'claude-api' };
  if((ia.prov === 'gemini' || ia.prov === 'auto') && ia.geminiKey) return { tipo:'gemini-api' };
  return null;
}
/* turns: [{role:'user'|'assistant', content}] ; forte = usar o modelo mais forte */
async function iaPedir(turns, o = {}){
  const via = await iaDisponivel();
  if(!via) throw { code:'sem_ia' };
  const ia = settings.ia;
  if(via.tipo === 'claude-app'){
    const op = { modelTier:o.forte ? 'default' : (ia.tier || 'quick') };
    if(o.signal) op.signal = o.signal;
    if(o.cache === false) op.cache = false;
    if(o.onText) op.onText = x => o.onText(x.text);
    const r = await via.s(turns, op);
    return r.text;
  }
  if(via.tipo === 'claude-api'){
    const model = o.forte && /haiku/.test(ia.claudeModel) ? 'claude-sonnet-5' : (ia.claudeModel || 'claude-haiku-4-5');
    const r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', signal:o.signal,
      headers:{ 'content-type':'application/json', 'x-api-key':ia.claudeKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
      body:JSON.stringify({ model, max_tokens:4096, messages:turns }) });
    const j = await r.json().catch(() => ({}));
    if(!r.ok) throw { code:'api', message:(j.error && j.error.message) || ('Erro ' + r.status) };
    const t = (j.content || []).map(c => c.text || '').join('');
    if(o.onText) o.onText(t);
    return t;
  }
  const model = ia.geminiModel || 'gemini-2.5-flash';
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(ia.geminiKey), {
    method:'POST', signal:o.signal, headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ contents:turns.map(t => ({ role:t.role === 'assistant' ? 'model' : 'user', parts:[{ text:t.content }] })) }) });
  const j = await r.json().catch(() => ({}));
  if(!r.ok) throw { code:'api', message:(j.error && j.error.message) || ('Erro ' + r.status) };
  const t = (((j.candidates || [])[0] || {}).content || { parts:[] }).parts.map(p => p.text || '').join('');
  if(o.onText) o.onText(t);
  return t;
}
function iaErro(e){
  const c = e && e.code;
  return ({ not_granted:'Você não permitiu o uso do Claude nesta página.', rate_limited:'Muitos pedidos seguidos. Espere um pouco e tente de novo.', cancelled:'Parado.',
    prompt_too_large:'Trecho grande demais. Selecione menos texto.', refused:'O Claude não quis responder a esse trecho.', session_expired:'Sua sessão expirou. Recarregue a página.',
    sem_ia:'Sem inteligência artificial configurada. Use “Levar ao Claude” ou “Levar ao Gemini”, ou coloque uma chave em Ajustes.' })[c]
    || (c === 'api' ? 'A IA respondeu com erro: ' + (e.message || '') : (e && e.name === 'AbortError') ? 'Parado.' : 'Não deu para responder agora. Tente de novo em instantes.');
}

/* ===== e_home.js ===== */
/* =====================================================================
   Tela inicial (Panda): processos fixados, últimos, bolinhas, acesso rápido
   ===================================================================== */
let VIEW = 'home';
function mostrar(v){
  VIEW = v;
  $('vHome').hidden = v !== 'home'; $('vMesa').hidden = v !== 'mesa'; $('vRel').hidden = v !== 'rel';
  if(DB){ DB.ui.view = v; saveDB(); }
}
const STATUS_COR = { 'Em elaboração':'acc', 'Tramitando':'', 'Aguardando resposta':'warn', 'Parado':'danger', 'Concluído':'ok' };
const chipStatus = s => h('span', { class:'chip ' + (STATUS_COR[s] || '') }, s || 'Em elaboração');
function haQuanto(iso){ const n = diasEntre(iso); if(n == null) return ''; return n <= 0 ? 'desde hoje' : n === 1 ? 'há 1 dia' : 'há ' + n + ' dias'; }
function quando(ts){
  if(!ts) return '';
  const d = new Date(ts), hoje = new Date(), ontem = new Date(Date.now() - 864e5);
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if(d.toDateString() === hoje.toDateString()) return 'hoje, ' + hm;
  if(d.toDateString() === ontem.toDateString()) return 'ontem';
  return dataBR(new Date(ts - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10));
}
/* toque longo: mostra o nome ou abre o menu */
function toqueLongo(el, fn){
  let t = null, longo = false, x0 = 0, y0 = 0;
  el.addEventListener('pointerdown', e => { longo = false; x0 = e.clientX; y0 = e.clientY; t = setTimeout(() => { longo = true; if(navigator.vibrate) try{ navigator.vibrate(12); }catch(err){} fn(); }, 480); });
  el.addEventListener('pointermove', e => { if(Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 10) clearTimeout(t); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => el.addEventListener(e, () => clearTimeout(t)));
  el.addEventListener('click', ev => { if(longo){ ev.preventDefault(); ev.stopImmediatePropagation(); longo = false; } }, true);
  el.addEventListener('contextmenu', ev => { ev.preventDefault(); });
}

/* tela inicial no estilo iOS: busca, Fixados, Recentes e um único + */
const HOME = { busca:'', editar:false };
function renderHome(){
  const b = $('homeBody'); b.replaceChildren();
  const tab = DB.ui.tab || 'procs';
  document.body.dataset.tab = tab;
  $('pandaImg').src = PANDA_SRC; $('verBadge').textContent = VERSAO_APP;
  $('homeTabs').replaceChildren(
    h('button', { class:tab === 'procs' ? 'on' : '', role:'tab', onclick:() => setTab('procs') }, 'Processos'),
    h('button', { class:tab === 'rels' ? 'on' : '', role:'tab', onclick:() => setTab('rels') }, 'Relatórios'));
  if(tab === 'procs') homeProcessos(b); else homeRelatorios(b);
  if(PWA && window.__instalar) b.append(h('div', { class:'row', style:{ justifyContent:'center', marginTop:'22px' } },
    h('button', { class:'btn sm', onclick:async () => { const e = window.__instalar; window.__instalar = null; e.prompt(); renderHome(); } }, 'Instalar no celular')));
  if(!$('hPanel').classList.contains('open')) $('hPanel').replaceChildren();
}
function setTab(t){ DB.ui.tab = t; saveDB(); renderHome(); }
function subProc(p){
  if(p.avdoc) return (TIPO_NOME[p.tipoAv] || 'Documento') + (p.numint ? ' · SEINFRA N. ' + p.numint : '');
  const f = p.ficha || {};
  return [f.num || 'sem número', f.tipoObj || catName(p.cat)].filter(Boolean).join(' · ');
}
const tituloItem = p => p.avdoc ? objetoProc(p) : (p.ficha.objeto || tituloProc(p));
function linhaItem(p, extra, sub){
  const bt = h('button', { class:'aRow', onclick:() => { if(bt._aberto){ fecharDeslize(bt); return; } if(!HOME.editar) abrirItem(p); } },
    h('span', { class:'tx' }, h('b', null, tituloItem(p)), h('span', null, sub || subProc(p))),
    extra || h('span', { class:'chev', html:I.chevR }));
  toqueLongo(bt, () => menuItem(p, bt));
  if(HOME.editar) return bt;
  /* como no iPhone: deslizar para a direita fixa; para a esquerda mostra Apagar */
  const fx = estaFixado(p);
  const wrap = h('div', { class:'aSw' },
    h('button', { class:'swL', onclick:() => { fixar(p, !fx); renderHome(); toast(fx ? 'Desafixado.' : 'Fixado.', { ms:1200 }); } }, fx ? 'Desafixar' : 'Fixar'),
    h('button', { class:'swR', onclick:() => { fecharDeslize(bt); excluirProc(p); } }, 'Apagar'), bt);
  deslizar(bt);
  return wrap;
}
function fecharDeslize(row){ row._aberto = 0; row.style.transition = 'transform .2s ease'; row.style.transform = ''; }
function deslizar(row){
  let x0 = null, y0 = 0, dx = 0, modo = null;
  row.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; dx = row._aberto || 0; modo = null; row.style.transition = 'none'; });
  row.addEventListener('pointermove', e => {
    if(x0 == null) return;
    const ddx = e.clientX - x0, ddy = e.clientY - y0;
    if(!modo){ if(Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.3){ modo = 'h'; try{ row.setPointerCapture(e.pointerId); }catch(err){} } else if(Math.abs(ddy) > 10) modo = 'v'; }
    if(modo !== 'h') return;
    dx = Math.max(-110, Math.min(110, ddx + (row._aberto || 0))); row.style.transform = 'translateX(' + dx + 'px)';
  });
  const fim = () => {
    if(x0 == null) return; x0 = null; row.style.transition = 'transform .2s ease';
    if(modo !== 'h'){ return; }
    row._aberto = dx < -55 ? -84 : dx > 55 ? 84 : 0;
    row.style.transform = row._aberto ? 'translateX(' + row._aberto + 'px)' : '';
    row._arrastou = true; setTimeout(() => { row._arrastou = false; }, 60);
  };
  row.addEventListener('pointerup', fim); row.addEventListener('pointercancel', fim);
  row.addEventListener('click', ev => { if(row._arrastou){ ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
}
const pare = fn => ev => { ev.stopPropagation(); fn(); };
function homeProcessos(b){
  const busca = h('input', { placeholder:'Buscar', 'aria-label':'Buscar', value:HOME.busca, oninput:() => { HOME.busca = busca.value; desenha(); } });
  b.append(h('label', { class:'aBusca' }, h('span', { html:I.search }), busca));
  const corpo = h('div'); b.append(corpo);
  function desenha(){
    corpo.replaceChildren();
    const q = norm(HOME.busca.trim());
    if(q){
      const achou = DB.procs.filter(p => !p.avulsa && norm([p.ficha.num, p.ficha.objeto, p.numint, TIPO_NOME[p.tipoAv], revitNumero(p)].join(' ')).includes(q)).slice(0, 40);
      corpo.append(h('div', { class:'aSec' }, 'Resultados'), achou.length ? h('div', { class:'aGrp' }, achou.map(p => linhaItem(p))) : h('div', { class:'aVazio' }, 'Nada encontrado.'));
      return;
    }
    const fx = fixados();
    corpo.append(h('div', { class:'aSec' }, h('span', null, 'Fixados'), fx.length > 1 ? h('button', { onclick:() => { HOME.editar = !HOME.editar; desenha(); } }, HOME.editar ? 'OK' : 'Editar') : null));
    if(!fx.length) corpo.append(h('div', { class:'aGrp' }, h('div', { class:'aVazio' }, 'Toque e segure um processo para fixar aqui.')));
    else corpo.append(h('div', { class:'aGrp' }, fx.map((p, i) => linhaItem(p, HOME.editar ? h('span', { class:'ord' },
      h('button', { html:I.chevU, 'aria-label':'Subir', disabled:i === 0, onclick:pare(() => { moverFixado(p, -1); desenha(); }) }),
      h('button', { html:I.chevD, 'aria-label':'Descer', disabled:i === fx.length - 1, onclick:pare(() => { moverFixado(p, 1); desenha(); }) })) : null))));
    const ul = ultimos();
    if(ul.length) corpo.append(h('div', { class:'aSec' }, 'Recentes'), h('div', { class:'aGrp' }, ul.map(p => linhaItem(p, null, p.avdoc ? subProc(p) : (p.ficha.num || 'sem número') + ' · ' + quando(p.updated)))));
    if(!fx.length && !ul.length) corpo.append(h('div', { class:'aVazio', style:{ textAlign:'center', marginTop:'30px' } }, 'Toque no + para começar.'));
  }
  desenha();
}
function menuMais(ancora){
  popMenu(ancora, [
    { t:'Novo documento', ic:'docplus', fn:() => novoDocumento({}) },
    { t:'Novo processo', ic:'folderPlus', fn:() => fichaSheet(null) },
    '-',
    { t:'Abrir PDF', ic:'pdf', fn:() => escolherArquivos(l => receberArquivos(l)) },
    { t:'Fotografar', ic:'camera', fn:() => fotografar() },
    { t:'Mesa de PDF', ic:'layers', fn:() => abrirMesaPdf() },
    '-',
    { t:'Calculadora', ic:'calc', fn:() => calcSheet() }
  ]);
}
function abrirItem(p){ if(p.avdoc) abrirAvulso(p); else abrirMesa(p); }
function menuItem(p, ancora){
  if(p.avdoc) return menuAvulso(p, ancora);
  menuProc(p, ancora);
}
function menuProc(p, ancora){
  const fx = estaFixado(p);
  menu(tituloProc(p), [
    { t:'Abrir processo', ic:'doc', fn:() => abrirMesa(p) },
    { t: fx ? 'Desafixar' : 'Fixar no início', ic:'pin', fn:() => { fixar(p, !fx); renderHome(); } },
    { t:'Montar PDF para imprimir ou exportar', ic:'layers', fn:() => exportarProcesso(p) },
    { t:'Ficha central', ic:'pen', fn:() => fichaSheet(p) },
    { t:'Relatório e prontuário', ic:'report', fn:() => abrirRel(p) },
    { t:'Registrar tramitação', ic:'route', fn:() => tramSheet(p) },
    '-',
    { t:'Duplicar processo', sub:'Copia a ficha e os textos, sem os PDFs', ic:'dup', fn:() => duplicarProc(p) },
    { t:'Excluir processo', ic:'trash', danger:true, fn:() => excluirProc(p) }
  ], ancora);
}
function exportarProcesso(p){ abrirMesa(p); setTimeout(() => { if(typeof entrarSelecao === 'function') entrarSelecao(true); }, 150); }
function duplicarProc(p){
  const q = novoProc({ cat:p.cat, status:'Em elaboração', ficha:clone(p.ficha) });
  q.ficha.num = (q.ficha.num || '') + (q.ficha.num ? ' (cópia)' : '');
  q.ficha.revitSeq = q.ficha.revitInicio ? revitSeqLivre(q.ficha.revitInicio, q) : q.ficha.revitSeq;
  const mapa = {};
  q.docs = p.docs.filter(d => d.kind === 'texto').map(d => { const n = Object.assign(clone(d), { id:uid() }); mapa[d.id] = n.id; return n; });
  q.docs.forEach(d => { if(d.pai) d.pai = mapa[d.pai] || null; });
  DB.procs.push(q); saveDB(true); renderHome(); toast('Processo duplicado.');
}
async function excluirProc(p){
  const nome = p.avdoc ? (TIPO_NOME[p.tipoAv] || 'Documento') + ' ' + (p.numint || '') : 'O processo ' + (p.ficha.num || '');
  if(!await confirmar('Excluir', nome + ' e todos os seus documentos e PDFs serão apagados deste aparelho.', 'Excluir', true)) return;
  DB.procs = DB.procs.filter(x => x !== p);
  if(p.avdoc && p.numint) liberarNum(p.numint);
  for(const d of p.docs) if(d.kind === 'pdf' && d.fileId && !fileEmUso(d.fileId)) await apagarBytes(d.fileId);
  saveDB(true);
  if(VIEW !== 'home') mostrar('home');
  renderHome(); if($('hPanel').classList.contains('open')) renderRapido();
  toast('Excluído.');
}

/* ---------- acesso rápido (aba da esquerda na tela inicial) ---------- */
function abrirRapido(){ renderRapido(); $('hPanel').classList.add('open'); $('hScrim').hidden = false; }
function fecharRapido(){ $('hPanel').classList.remove('open'); $('hScrim').hidden = true; }
const TIPOS_AV = [['ci', 'Comunicação interna'], ['of', 'Ofício'], ['nt', 'Nota técnica'], ['livre', 'Outros documentos']];
function ordemAv(lista){ return lista.slice().sort((a, b) => (a.ordem != null ? a.ordem : -a.created) - (b.ordem != null ? b.ordem : -b.created)); }
function moverAv(p, dir){
  const lista = ordemAv(avulsosDoc(p.tipoAv).filter(x => (x.caixa || '') === (p.caixa || '')));
  lista.forEach((x, i) => x.ordem = i);
  const i = lista.indexOf(p), j = i + dir; if(j < 0 || j >= lista.length) return;
  lista[i].ordem = j; lista[j].ordem = i; saveDB(); renderRapido();
}
function renderRapido(){
  const P = $('hPanel');
  const body = h('div', { class:'pb' });
  P.replaceChildren(h('div', { class:'ph' }, h('b', null, 'Acesso rápido'), h('button', { class:'hbtn', html:I.x, 'aria-label':'Fechar', onclick:fecharRapido })), body);
  const fx = fixados();
  body.append(h('div', { class:'hl' }, 'Fixados'));
  if(!fx.length) body.append(h('div', { class:'hvazio' }, 'Nada fixado ainda.'));
  fx.forEach((p, i) => body.append(h('div', { class:'qrow' },
    h('span', { class:'tx', onclick:() => { fecharRapido(); abrirItem(p); } }, h('b', null, p.avdoc ? objetoProc(p) : (p.ficha.objeto || tituloProc(p))), h('span', null, subProc(p))),
    h('span', { class:'mini' },
      h('button', { html:I.up, disabled:i === 0, onclick:() => { moverFixado(p, -1); renderRapido(); renderHome(); } }),
      h('button', { html:I.down, disabled:i === fx.length - 1, onclick:() => { moverFixado(p, 1); renderRapido(); renderHome(); } }),
      h('button', { html:I.share, 'aria-label':'Exportar', onclick:() => { fecharRapido(); exportarProcesso(p); } })))));
  const ul = uiLista('ult').map(procPorId).filter(p => p && !estaFixado(p) && !p.avdoc);
  if(ul.length){
    body.append(h('div', { class:'hl' }, 'Últimos processos'));
    ul.forEach(p => body.append(h('div', { class:'qrow' },
      h('span', { class:'tx', onclick:() => { fecharRapido(); abrirItem(p); } }, h('b', null, p.ficha.objeto || tituloProc(p)), h('span', null, quando(p.updated))),
      h('span', { class:'mini' }, h('button', { html:I.pin, onclick:() => { fixar(p, true); renderRapido(); renderHome(); } }), h('button', { html:I.share, onclick:() => { fecharRapido(); exportarProcesso(p); } })))));
  }
  body.append(h('div', { class:'hl' }, 'Documentos avulsos'));
  DB.ui.acc = DB.ui.acc || {};
  for(const [tipo, nome] of TIPOS_AV){
    const lista = avulsosDoc(tipo).filter(p => tipo !== 'livre' || !['ci', 'of', 'nt'].includes(p.tipoAv));
    const aberto = !!DB.ui.acc[tipo];
    const acc = h('div', { class:'acc' }, h('button', { onclick:() => { DB.ui.acc[tipo] = !aberto; saveDB(); renderRapido(); } }, h('span', null, nome), h('small', null, lista.length + (aberto ? ' ▾' : ' ▸'))));
    if(aberto){
      const caixas = Array.from(new Set(lista.map(p => p.caixa || ''))).sort((a, b) => a === '' ? -1 : b === '' ? 1 : a.localeCompare(b));
      for(const cx of caixas){
        if(cx) acc.append(h('div', { class:'cx' }, cx));
        ordemAv(lista.filter(p => (p.caixa || '') === cx)).forEach(p => {
          const it = h('div', { class:'it' },
            h('span', { class:'tx', onclick:() => { fecharRapido(); abrirAvulso(p); } }, h('b', null, p.numint ? 'SEINFRA N. ' + p.numint : (TIPO_NOME[p.tipoAv] || 'Documento')), h('span', null, objetoProc(p))),
            h('span', { class:'mini' },
              h('button', { html:I.up, onclick:() => moverAv(p, -1) }), h('button', { html:I.down, onclick:() => moverAv(p, 1) }),
              h('button', { html:I.x, 'aria-label':'Apagar', onclick:() => excluirProc(p) }),
              h('button', { html:I.share, 'aria-label':'Exportar', onclick:() => exportarAvulso(p) })));
          toqueLongo(it, () => menuAvulso(p));
          acc.append(it);
        });
      }
      acc.append(h('div', { class:'add' },
        h('button', { class:'btn sm', onclick:() => { fecharRapido(); novoDocumento({ modo:'avulso', tipo: tipo === 'livre' ? 'livre' : tipo }); } }, h('span', { html:I.plus }), 'Novo'),
        h('button', { class:'btn sm ghost', onclick:() => novaCaixa(tipo) }, h('span', { html:I.folder }), 'Nova caixa')));
    }
    body.append(acc);
  }
}
async function novaCaixa(tipo){
  const nome = await perguntar('Nova caixa', 'Nome da caixa (ex.: Toner e material, Defesa Civil)', '', 'Criar');
  if(!nome) return;
  DB.ui.caixas = DB.ui.caixas || {}; const L = DB.ui.caixas[tipo] = DB.ui.caixas[tipo] || [];
  if(!L.includes(nome)) L.push(nome);
  saveDB(); toast('Caixa criada. Toque e segure um documento para colocar nela.');
}
function caixasDe(tipo){ const L = ((DB.ui.caixas || {})[tipo] || []).slice(); avulsosDoc(tipo).forEach(p => { if(p.caixa && !L.includes(p.caixa)) L.push(p.caixa); }); return L; }
function menuAvulso(p, ancora){
  menu((TIPO_NOME[p.tipoAv] || 'Documento') + (p.numint ? ' · ' + p.numint : ''), [
    { t:'Abrir', ic:'doc', fn:() => abrirAvulso(p) },
    { t:'Exportar PDF', ic:'share', fn:() => exportarAvulso(p) },
    { t:'Colocar numa caixa', ic:'folder', fn:async () => {
      const L = caixasDe(p.tipoAv);
      const v = await escolher('Caixa', [['', 'Sem caixa']].concat(L.map(c => [c, c])).concat([['+nova', '+ Nova caixa']]), p.caixa || '');
      if(v == null) return;
      if(v === '+nova'){ const nome = await perguntar('Nova caixa', 'Nome da caixa', '', 'Criar'); if(!nome) return; p.caixa = nome; }
      else p.caixa = v;
      p.ordem = null; saveDB(); renderRapido();
    } },
    { t: estaFixado(p) ? 'Desafixar' : 'Fixar no início', ic:'pin', fn:() => { fixar(p, !estaFixado(p)); renderHome(); if($('hPanel').classList.contains('open')) renderRapido(); } },
    { t:'Criar processo a partir deste', sub:'O documento vira o primeiro da linha do processo', ic:'folderPlus', fn:() => processoDeAvulso(p) },
    '-',
    { t:'Apagar', ic:'trash', danger:true, fn:() => excluirProc(p) }
  ], ancora);
}
function processoDeAvulso(p){
  const q = novoProc({ cat:'diversos', ficha:{ objeto:p.ficha.objeto || '', extras:[] } });
  p.docs.forEach(d => q.docs.push(Object.assign(clone(d), { id:uid() })));
  DB.procs.push(q); marcarUltimo(q); saveDB(true);
  fecharRapido(); abrirMesa(q); fichaSheet(q);
  toast('Processo criado com o documento. Preencha a ficha.');
}
async function exportarAvulso(p){
  const d = p.docs.find(x => x.kind === 'texto') || p.docs[0]; if(!d) return;
  if(typeof baixarDoc === 'function') baixarDoc(d, p);
}
function abrirAvulso(p){
  const de = VIEW === 'mesa' && M.p && !M.p.avdoc && M.p !== p ? M.p.id : null;
  abrirMesa(p, { voltar:de });
}

/* ---------- busca ---------- */
function buscaSheet(){
  const inp = h('input', { class:'inp', placeholder:'Número, objeto, SEINFRA N. ou rótulo', autofocus:true });
  const res = h('div', { style:{ display:'flex', flexDirection:'column', gap:'6px' } });
  const s = sheet({ titulo:'Buscar', corpo:[inp, res] });
  const run = () => {
    const q = norm(inp.value.trim()); res.replaceChildren();
    if(!q) return;
    const achou = DB.procs.filter(p => !p.avulsa && norm([p.ficha.num, p.ficha.objeto, p.numint, TIPO_NOME[p.tipoAv], revitNumero(p)].join(' ')).includes(q)).slice(0, 30);
    if(!achou.length) res.append(h('div', { class:'hvazio' }, 'Nada encontrado.'));
    achou.forEach(p => res.append(h('button', { class:'qrow', onclick:() => { s.fechar(); abrirItem(p); } }, h('span', { class:'tx' }, h('b', null, p.avdoc ? objetoProc(p) : (p.ficha.objeto || tituloProc(p))), h('span', null, subProc(p))))));
  };
  inp.addEventListener('input', run);
  setTimeout(() => inp.focus(), 150);
}

/* ---------- PDF: anexar, câmera, juntar ---------- */
function pdfMenu(){
  const s = sheet({ titulo:'PDF', corpo:[h('div', { class:'dots', style:{ gridTemplateColumns:'repeat(3,1fr)', margin:'4px 0 6px' } },
    h('button', { class:'dot', html:I.clip, 'aria-label':'Anexar arquivos', onclick:() => { s.fechar(); escolherArquivos(l => receberArquivos(l)); } }),
    h('button', { class:'dot', html:I.camera, 'aria-label':'Fotografar', onclick:() => { s.fechar(); fotografar(); } }),
    h('button', { class:'dot', html:I.layers, 'aria-label':'Mesa de PDF', onclick:() => { s.fechar(); abrirMesaPdf(); } })),
    h('div', { class:'row', style:{ justifyContent:'space-around', fontSize:'12px', color:'var(--muted)', marginTop:'-4px' } }, h('span', null, 'Anexar'), h('span', null, 'Câmera'), h('span', null, 'Mesa de PDF'))] });
}
function fotografar(){
  const inp = $('camIn'); inp.value = '';
  inp.onchange = () => { const l = Array.from(inp.files || []); if(l.length) receberArquivos(l); };
  inp.click();
}
function abrirMesaPdf(){ const av = procAvulsa(); abrirMesa(av, { pdf:true }); }
/* arquivos recebidos: um PDF vai direto; ZIP ou vários passam pela triagem */
async function receberArquivos(lista, destino){
  if(!needLibs()) return;
  const arqs = await expandirTudo(lista);
  if(!arqs.length) return;
  if(arqs.length === 1 && /\.pdf$/i.test(arqs[0].name) && !destino){
    const av = procAvulsa();
    const novos = await incluirArquivos(av, arqs, 'linha');
    abrirMesa(av, { pdf:true, doc:novos[0] && novos[0].id });
    return;
  }
  triagemSheet(arqs, destino);
}
function abrirOtimizador(){ pdfMenu(); }

/* ---------- novo documento: nova página · neste processo · avulso ---------- */
function mpiParaLinhas(texto){
  const L = String(texto || '').replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean);
  if(!L.length) return '';
  const out = [];
  L.forEach((l, i) => {
    const semPonto = !/[.;:]$/.test(l);
    if(i === 0 && l.length <= 110 && (l === l.toLocaleUpperCase('pt-BR') || semPonto) && !/^\d/.test(l)){ out.push('# ' + l); return; }
    if(i === 1 && out[0] && out[0].startsWith('# ') && l.length <= 80 && l === l.toLocaleUpperCase('pt-BR') && /(N[º°o.]|SEINFRA|PROCESSO|\d)/.test(l)){ out.push('= ' + l); return; }
    const m = /^(De|Para|Assunto|Interessad[oa]|Refer[êe]ncia|Ref\.|Objeto|Contratad[oa]|Processo)\s*:\s*(.*)$/i.exec(l);
    if(m){ out.push('| **' + m[1] + ':** ' + m[2]); return; }
    const c = /^(\d{1,2})(?:[.)]|\s*[-–])\s+(.{2,90})$/.exec(l);
    if(c && !/\d+\.\d+/.test(l.slice(0, 5)) && (c[2] === c[2].toLocaleUpperCase('pt-BR') || (semPonto && c[2].length < 70))){ out.push('## ' + c[1] + '. ' + titleCase(c[2])); return; }
    if(/^["“].{120,}["”]$/.test(l)){ out.push('> ' + l.replace(/^["“]|["”]$/g, '')); return; }
    out.push(l);
  });
  return out.join('\n');
}
function htmlDoTexto(texto){
  const t = String(texto || '');
  if(/<\/?(p|h[1-6]|table|ul|ol|blockquote|div|br)\b/i.test(t)) return limparHTML(t);
  return null;
}
function criarDocumento(o){
  const p = o.p, m = o.m || null;
  let html;
  const linhasModelo = m ? m.texto : '# [TÍTULO]\n[Texto.]';
  if(o.texto && o.texto.trim()){
    const pronto = htmlDoTexto(o.texto);
    if(pronto) html = pronto;
    else {
      let corpo = mpiParaLinhas(o.texto);
      if(m && m.tipo !== 'livre' && !/^# /m.test(corpo)){
        const cab = m.texto.split('\n').filter(l => /^(# |= |\|\+? |@data)/.test(l.trim())).join('\n');
        corpo = cab + '\n' + corpo;
      }
      html = tplParaHTML(corpo, p, { avulso:o.avulso, numint:o.numint });
    }
  } else html = tplParaHTML(linhasModelo, p, { avulso:o.avulso, numint:o.numint });
  if(o.rotulo && /\[assunto\]/.test(html)) html = html.replace('<span class="campo">[assunto]</span>', esc(o.rotulo));
  const tipo = m ? m.tipo : 'livre';
  const d = { id:uid(), kind:'texto', nome:o.rotulo || (m ? (m.nome.replace(/^LCT\.\d+ · /, '')) : titleOf(html)), modelo:m ? m.id : 'livre', tipo, sig:sigDoModelo(m), html,
    bras:settings.brasTexto || 'todas', linha:true, repo:false, criado:Date.now(), mpi:true };
  if(o.anexoDe){ d.pai = o.anexoDe; d.sig.sem = true; }
  const ref = o.anexoDe || o.depois;
  let i = ref ? p.docs.findIndex(x => x.id === ref) : -1;
  if(i >= 0){ while(i + 1 < p.docs.length && p.docs[i + 1].pai === ref) i++; p.docs.splice(i + 1, 0, d); } else p.docs.push(d);
  ordenarAnexos(p);
  touch(p); saveDB(true);
  return d;
}
function criarTexto(p, m, sigId, depois){ const d = criarDocumento({ p, m, depois }); if(sigId && pessoaPorId(sigId)) d.sig.pessoa = sigId; return d; }
function optSheet(titulo, grupos, atual){
  return new Promise(res => {
    const box = h('div', { class:'optlist' });
    let s;
    grupos.forEach(g => {
      if(g.g) box.append(h('div', { class:'g' }, g.g));
      g.itens.forEach(it => box.append(h('button', { class:(it.v === atual ? 'on ' : '') + (it.usado ? 'usado' : ''), onclick:() => { res(it.v); s.fechar(); } }, h('span', null, it.t), it.sub ? h('small', null, it.sub) : null)));
    });
    s = sheet({ titulo, corpo:[box], aoFechar:() => res(null) });
  });
}
function novoDocumento(o){
  o = o || {};
  const naMesa = VIEW === 'mesa' && M.p;
  const ctxProc = o.p || (naMesa && !M.p.avulsa && !M.p.avdoc ? M.p : null);
  const docAtual = naMesa && M.cur && M.cur.d ? M.cur.d : null;
  let modo = o.modo || (ctxProc ? 'processo' : 'avulso');
  let proc = ctxProc, m = modelos().find(x => x.tipo === o.tipo) || modelos().find(x => x.id === (ctxProc ? 'desp-rem' : 'ci'));
  let anexo = false;
  const hoje = hojeISO(); let dia = hoje, seq = seqLivre(hoje);
  const segB = {}, seg = h('div', { class:'ndSeg' });
  [['pagina', 'Nova página'], ['processo', ctxProc ? 'Neste processo' : 'Em processo'], ['avulso', 'Avulso']].forEach(([k, t]) => {
    segB[k] = h('button', { onclick:() => { if(k === 'pagina'){ s.fechar(); novaPaginaNaMesa(); return; } modo = k; pinta(); } }, t);
    if(k === 'pagina' && !(naMesa && docAtual && docAtual.kind === 'texto')) segB[k].disabled = true;
    seg.append(segB[k]);
  });
  const tipoBtn = h('button', { class:'f sel', style:{ textAlign:'left' }, onclick:async () => {
    const ms = modelos(), gr = [];
    for(const g of GRUPOS_MODELO.concat(Array.from(new Set(ms.map(x => x.grupo))).filter(x => !GRUPOS_MODELO.includes(x)))){ const it = ms.filter(x => x.grupo === g).map(x => ({ v:x.id, t:x.nome })); if(it.length) gr.push({ g, itens:it }); }
    const v = await optSheet('Tipo de documento', gr, m && m.id); if(v){ m = ms.find(x => x.id === v); pinta(); }
  } });
  const rot = h('input', { class:'inp', placeholder:'Do que se trata (ex.: Solicitação de toner)' });
  const procBtn = h('button', { class:'f sel', style:{ textAlign:'left' }, onclick:async () => {
    const ps = procsReais().sort((a, b) => b.updated - a.updated);
    const v = await optSheet('Qual processo', [{ itens:ps.map(p => ({ v:p.id, t:p.ficha.objeto || tituloProc(p), sub:p.ficha.num || '' })) }], proc && proc.id);
    if(v){ proc = procPorId(v); pinta(); }
  } });
  const anexoChk = h('input', { type:'checkbox' });
  anexoChk.onchange = () => { anexo = anexoChk.checked; };
  const anexoLin = h('label', { class:'chk' }, anexoChk, h('span', null, ''));
  const numBtns = h('div', { class:'numrow' });
  const prev = h('div', { class:'nprev' });
  const texto = h('textarea', { class:'txa', rows:1, placeholder:'Colar ou escrever o texto (opcional)', onfocus:e => { e.target.rows = 6; } });
  const lblProc = h('div', { class:'lbl' }, 'Processo'), lblNum = h('div', { class:'lbl' }, 'Numeração interna');
  const info = h('p', { class:'muted', style:{ margin:0, fontSize:'13px' } });
  function numTxt(){ return numintTexto(seq, dia); }
  function pinta(){
    for(const k in segB) segB[k].classList.toggle('on', k === modo);
    tipoBtn.textContent = m ? m.nome : 'Escolher tipo';
    const emProc = modo === 'processo';
    lblProc.hidden = procBtn.hidden = !emProc || !!ctxProc;
    procBtn.textContent = proc ? (proc.ficha.objeto || tituloProc(proc)) : 'Escolher processo';
    anexoLin.hidden = !(emProc && ctxProc && docAtual);
    if(docAtual) anexoLin.lastChild.textContent = 'Anexo de: ' + docAtual.nome;
    lblNum.hidden = numBtns.hidden = emProc;
    numBtns.replaceChildren(
      h('small', { style:{ fontWeight:700, color:'var(--muted)', marginRight:'4px' } }, 'SEINFRA N.'),
      h('button', { class:'on', onclick:async () => {
        const us = numsDoDia(dia), gr = [{ itens:Array.from({ length:Math.max(12, seqLivre(dia) + 5) }, (_, i) => i + 1).map(n => { const u = us.find(x => x.seq === n); return { v:n, t:String(n).padStart(3, '0'), sub:u ? (TIPO_NOME[u.tipo] || '') + (u.rot ? ' · ' + u.rot : '') : 'livre', usado:!!u }; }) }];
        const v = await optSheet('Número do dia', gr, seq); if(v != null){ seq = v; pinta(); } } }, String(seq).padStart(3, '0')), '.',
      h('button', { onclick:async () => { const [y, mm] = dia.split('-'); const n = new Date(+y, +mm, 0).getDate(); const v = await optSheet('Dia', [{ itens:Array.from({ length:n }, (_, i) => ({ v:i + 1, t:String(i + 1).padStart(2, '0') })) }], +dia.slice(8)); if(v){ dia = y + '-' + mm + '-' + String(v).padStart(2, '0'); seq = seqLivre(dia); pinta(); } } }, dia.slice(8)), '.',
      h('button', { onclick:async () => { const [y, mm, dd] = dia.split('-'); const v = await optSheet('Mês', [{ itens:Array.from({ length:12 }, (_, i) => 12 - i).map(n => ({ v:n, t:String(n).padStart(2, '0') + ' · ' + MESES_EXT[n - 1] })) }], +mm); if(v){ const max = new Date(+y, v, 0).getDate(); dia = y + '-' + String(v).padStart(2, '0') + '-' + String(Math.min(+dd, max)).padStart(2, '0'); seq = seqLivre(dia); pinta(); } } }, dia.slice(5, 7)), '.',
      h('button', { onclick:async () => { const [y, mm, dd] = dia.split('-'); const a = new Date().getFullYear(); const v = await optSheet('Ano', [{ itens:[a, a - 1].map(n => ({ v:n, t:String(n) })) }], +y); if(v){ dia = v + '-' + mm + '-' + dd; seq = seqLivre(dia); pinta(); } } }, dia.slice(0, 4)));
    const tit = m ? (m.texto.split('\n').find(l => l.startsWith('# ')) || '# DOCUMENTO').slice(2).replace(/\{\{\s*ano\s*\}\}/, new Date().getFullYear()) : 'DOCUMENTO';
    prev.replaceChildren(document.createTextNode(tit.toLocaleUpperCase('pt-BR')), h('br'), document.createTextNode(emProc ? (proc ? 'Processo Administrativo nº ' + (proc.ficha.num || '[nº]') + ' · na referência e na tarja' : '') : 'SEINFRA N. ' + numTxt()));
    info.textContent = emProc ? (ctxProc && docAtual ? 'Entra logo depois de "' + docAtual.nome + '" e abre na folha. O número do processo e os dados da ficha entram sozinhos.' : 'O documento entra no fim da linha do processo e abre na folha.') : 'Documento solto, guardado em Acesso rápido › Documentos avulsos. Não usa número de processo.';
    btnOk.textContent = emProc ? 'Criar e abrir na folha' : 'Criar e abrir';
    btnPdf.hidden = btnWord.hidden = emProc;
  }
  const btnOk = h('button', { class:'btn acc', style:{ flex:'1' }, onclick:() => criar() });
  const btnPdf = h('button', { class:'btn', onclick:() => criar('pdf') }, h('span', { html:I.share }), 'PDF');
  const btnWord = h('button', { class:'btn', onclick:() => criar('word') }, h('span', { html:I.share }), 'Word');
  const corpo = [
    h('div', { class:'lbl' }, 'Tipo'), tipoBtn,
    h('div', { class:'lbl' }, 'Rótulo'), rot,
    lblProc, procBtn, anexoLin,
    lblNum, numBtns,
    prev, info,
    h('div', { class:'lbl' }, 'Texto'), texto];
  const s = sheet({ titulo:'', cheio:true, cabExtra:h('div', { class:'ndTop', style:{ flex:'1' } }, seg), corpo, botoes:[] });
  const pe = h('div', { class:'shf' }, btnOk, btnPdf, btnWord);
  s.el.append(pe);
  pinta();
  function criar(saida){
    if(!m) return toast('Escolha o tipo.');
    const r = rot.value.trim();
    if(modo === 'processo'){
      const p = proc; if(!p) return toast('Escolha o processo.');
      const d = criarDocumento({ p, m, texto:texto.value, rotulo:r, depois: p === ctxProc && docAtual ? docAtual.id : null, anexoDe: anexo && docAtual && p === ctxProc ? (docAtual.pai || docAtual.id) : null });
      s.fechar(); marcarUltimo(p);
      if(VIEW === 'mesa' && M.p === p){ renderMesa(true); setTimeout(() => { irParaDoc(d.id); focarDoc(d.id); }, 80); }
      else abrirMesa(p, { doc:d.id, focar:true });
      return;
    }
    const num = numTxt();
    reservarNum(seq, dia, m.tipo, r);
    const q = novoProc({ avdoc:true, tipoAv:['ci', 'of', 'nt'].includes(m.tipo) ? m.tipo : 'livre', numint:num, caixa:'', ficha:{ objeto:r || m.nome, extras:[] } });
    DB.procs.push(q);
    const d = criarDocumento({ p:q, m, texto:texto.value, rotulo:r, avulso:true, numint:num });
    d.nome = (TIPO_NOME[m.tipo] || m.nome) + ' SEINFRA N. ' + num;
    saveDB(true); s.fechar();
    if(saida === 'pdf' || saida === 'word'){ setTimeout(() => saida === 'pdf' ? baixarDoc(d, q) : baixarWord(d, q), 60); return; }
    abrirAvulso(q);
  }
}

/* ---------- calculadora ---------- */
function calcSheet(){
  let expr = '';
  const vis = h('div', { class:'calcv' }, '0');
  const put = s => { expr += s; vis.textContent = expr; };
  const calc = () => { try{ const v = Function('"use strict";return (' + expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/[^0-9+\-*/().]/g, '') + ')')(); if(v == null || !isFinite(v)) throw 0; expr = String(Math.round(v * 1e8) / 1e8); vis.textContent = (typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits:8 }) : expr); }catch(e){ vis.textContent = 'erro'; expr = ''; } };
  const K = [['C', () => { expr = ''; vis.textContent = '0'; }], ['(', () => put('(')], [')', () => put(')')], ['÷', () => put('÷')],
    ['7', () => put('7')], ['8', () => put('8')], ['9', () => put('9')], ['×', () => put('×')],
    ['4', () => put('4')], ['5', () => put('5')], ['6', () => put('6')], ['−', () => put('-')],
    ['1', () => put('1')], ['2', () => put('2')], ['3', () => put('3')], ['+', () => put('+')],
    ['⌫', () => { expr = expr.slice(0, -1); vis.textContent = expr || '0'; }], ['0', () => put('0')], [',', () => put(',')], ['=', calc]];
  const grid = h('div', { class:'calcg' }, K.map(([t, fn]) => h('button', { class:'calcb' + (/[÷×\-+=]/.test(t) || t === '−' ? ' op' : '') + (t === 'C' ? ' cl' : '') + (t === '=' ? ' eq' : ''), onclick:fn }, t)));
  sheet({ titulo:'Calculadora', corpo:[vis, grid] });
}

/* ---------- ficha central ---------- */
function inputMoney(v){
  const i = h('input', { class:'inp', inputmode:'decimal', placeholder:'0,00' });
  const n = numBR(v); i.value = n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  i.addEventListener('blur', () => { const x = numBR(i.value); if(x != null) i.value = x.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }); });
  return i;
}
function fichaSheet(p, o = {}){
  const novo = !p;
  const base = p ? p.ficha : { extras:[], setor:settings.setor || '' };
  const campos = {};
  const listas = { MODALIDADES, SETORES, TIPOS_OBJ, MOD_COD, ESPECIES, SIM_NAO };
  const SELECTS = ['TIPOS_OBJ', 'MOD_COD', 'ESPECIES', 'SIM_NAO'];
  const corpo = [];
  let grupo = null, box = null, revitLbl = null;
  if(novo) corpo.push(h('p', { class:'muted', style:{ margin:0, fontSize:'13.5px' } }, 'Preencha o que já souber. Tudo o que você colocar aqui entra sozinho nos despachos, na nota técnica, no DFD, no ETP e no TR. Dá para pular e preencher depois.'));
  const catSel = h('select', { class:'sel' }, CATS.map(c => h('option', { value:c[0], selected:(p ? p.cat : (o.cat || 'diversos')) === c[0] }, c[1])));
  const stSel = h('select', { class:'sel' }, STATUS.map(s => h('option', { value:s, selected:(p ? p.status : 'Em elaboração') === s }, s)));
  const fls = h('input', { class:'inp', inputmode:'numeric', value:p ? String(p.fls0 || 1) : '1' });
  for(const [k, rot, tipo, g] of FICHA){
    if(g !== grupo){ grupo = g; const lb = h('div', { class:'lbl', style:{ marginTop:'6px' } }, g === 'REVIT' ? 'REVIT — estudo de viabilidade técnica' : g); if(g === 'REVIT') revitLbl = lb; corpo.push(lb); box = h('div', { class:'fgrp' }); corpo.push(box); }
    let inp;
    if(tipo === 'money') inp = inputMoney(base[k]);
    else if(tipo === 'area') inp = h('textarea', { class:'txa', rows:k === 'objeto' ? 3 : 2 }, base[k] || '');
    else if(tipo === 'date') inp = h('input', { class:'inp', type:'date', value:base[k] || '' });
    else if(tipo === 'number') inp = h('input', { class:'inp', inputmode:'numeric', value:base[k] || '' });
    else if(tipo.startsWith('list:') && SELECTS.includes(tipo.slice(5))){ inp = h('select', { class:'sel' }, h('option', { value:'' }, '—'), listas[tipo.slice(5)].map(x => h('option', { value:x, selected:base[k] === x }, x))); }
    else if(tipo.startsWith('list:')){ const id = 'dl' + uid(); inp = h('input', { class:'inp', list:id, value:base[k] || '' }); box.append(h('datalist', { id }, listas[tipo.slice(5)].map(x => h('option', { value:x })))); }
    else inp = h('input', { class:'inp', value:base[k] || '' });
    if(k === 'saldo' || k === 'valorAtual' || k === 'termino') inp.placeholder = k === 'saldo' ? 'Calculado se vazio' : k === 'valorAtual' ? 'Igual ao inicial se vazio' : 'Início + prazo se vazio';
    campos[k] = { inp, tipo };
    box.append(h('label', { class:'fld' + (tipo === 'area' || k === 'num' ? ' w2' : '') }, h('span', null, rot), inp));
    if(k === 'num'){ box.append(h('label', { class:'fld' }, h('span', null, 'Categoria'), catSel), h('label', { class:'fld' }, h('span', null, 'Situação'), stSel)); }
  }
  const prevRevit = () => {
    if(!revitLbl) return;
    const f = ler(), q = { ficha:Object.assign({}, f, { revitSeq: p && p.ficha.revitInicio === f.revitInicio && p.ficha.revitSeq ? p.ficha.revitSeq : (f.revitInicio ? revitSeqLivre(f.revitInicio, p) : 1) }) };
    if(campos.sigla && !campos.sigla.inp.value) campos.sigla.inp.placeholder = siglaDoObjeto(campos.objeto.inp.value) || 'automática';
    revitLbl.textContent = 'REVIT — ' + (revitTexto(q) || 'informe a data real de início do estudo');
  };
  setTimeout(() => { Object.values(campos).forEach(c => c.inp.addEventListener('input', prevRevit)); Object.values(campos).forEach(c => c.inp.addEventListener('change', prevRevit)); prevRevit(); }, 0);
  corpo.push(h('div', { class:'lbl', style:{ marginTop:'6px' } }, 'Folhas'));
  corpo.push(h('div', { class:'fgrp' }, h('label', { class:'fld' }, h('span', null, 'Folha inicial do processo'), fls), h('p', { class:'muted', style:{ margin:0, fontSize:'12.5px', alignSelf:'end' } }, 'Se o processo já tem folhas antes do primeiro documento daqui.')));
  corpo.push(h('div', { class:'lbl', style:{ marginTop:'6px' } }, 'Campos extras'));
  const extras = h('div', { style:{ display:'flex', flexDirection:'column', gap:'8px' } });
  const addExtra = (k, v) => { const a = h('input', { class:'inp', placeholder:'Nome do campo', value:k || '' }), b = h('input', { class:'inp', placeholder:'Valor', value:v || '' }); const r = h('div', { class:'row', style:{ flexWrap:'nowrap' } }, a, b, h('button', { class:'ib sm', html:I.x, 'aria-label':'Remover', onclick:() => r.remove() })); r._k = a; r._v = b; extras.append(r); };
  (base.extras || []).forEach(e => addExtra(e.k, e.v));
  corpo.push(extras, h('button', { class:'btn sm soft', style:{ alignSelf:'flex-start' }, onclick:() => addExtra() }, h('span', { html:I.plus }), 'Campo extra'));
  corpo.push(h('p', { class:'muted', style:{ margin:0, fontSize:'12.5px' } }, 'Campo extra entra nos modelos como {{nome_do_campo}}.'));
  const ler = () => {
    const f = { extras:[] };
    for(const k in campos){ const c = campos[k]; let v = c.inp.value.trim(); if(c.tipo === 'money'){ const n = numBR(v); v = n == null ? '' : String(Math.round(n * 100) / 100); } f[k] = v; }
    extras.querySelectorAll('.row').forEach(r => { const k = r._k.value.trim(), v = r._v.value.trim(); if(k) f.extras.push({ k, v }); });
    return f;
  };
  const salvar = abrir => {
    const f = ler();
    if(novo){
      if(f.revitInicio) f.revitSeq = revitSeqLivre(f.revitInicio);
      const q = novoProc({ cat:catSel.value, status:stSel.value, fls0:parseInt(fls.value, 10) || 1, ficha:f });
      DB.procs.push(q); marcarUltimo(q); saveDB(true);
      if(VIEW === 'home') renderHome();
      if(abrir) abrirMesa(q, { vazio:true });
      toast('Processo criado.');
      return;
    }
    if(VIEW === 'mesa' && M.p === p) salvarTudo();
    const antes = clone(p.ficha);
    if(f.revitInicio && (f.revitInicio !== antes.revitInicio || !antes.revitSeq)) f.revitSeq = revitSeqLivre(f.revitInicio, p); else f.revitSeq = antes.revitSeq;
    p.ficha = f; p.cat = catSel.value; p.status = stSel.value; p.fls0 = parseInt(fls.value, 10) || 1; touch(p);
    const n = replicarFicha(p, antes);
    saveDB(true);
    toast(n ? 'Ficha salva. ' + plural(n, 'documento atualizado', 'documentos atualizados') + ' com os novos dados.' : 'Ficha salva.');
    aposMudarProc(p);
  };
  sheet({ titulo:novo ? 'Novo processo' : 'Ficha central', cheio:true, corpo, botoes:novo
    ? [{ t:'Pular a ficha', v:'ghost', fn:() => { const q = novoProc({ cat:catSel.value, fls0:parseInt(fls.value, 10) || 1, ficha:ler() }); DB.procs.push(q); marcarUltimo(q); saveDB(true); abrirMesa(q, { vazio:true }); } }, { t:'Criar processo', v:'pri', fn:() => salvar(true) }]
    : [{ t:'Cancelar', v:'ghost' }, { t:'Salvar ficha', v:'pri', fn:() => salvar(false) }] });
}
/* redesenha o que estiver aberto depois de mudar um processo */
function aposMudarProc(p){
  if(VIEW === 'home') renderHome();
  if(VIEW === 'rel' && REL && REL.id === p.id) renderRel();
  if(VIEW === 'mesa' && M.p === p){ renderMesa(true); }
}

/* ---------- aba Relatórios do início ---------- */
function homeRelatorios(b){
  const ps = procsReais().sort((a, b) => b.updated - a.updated);
  b.append(h('div', { class:'sec-t' }, h('h3', null, 'Relatório geral')));
  const abertos = ps.filter(p => p.status !== 'Concluído');
  const totPend = ps.reduce((a, p) => a + pendAbertas(p).length, 0);
  b.append(h('div', { class:'rbox', style:{ display:'flex', flexDirection:'column', gap:'10px' } },
    h('div', { class:'stat' }, h('div', null, h('small', null, 'Objetos'), h('b', null, String(ps.length))), h('div', null, h('small', null, 'Em andamento'), h('b', null, String(abertos.length))), h('div', null, h('small', null, 'Pendências'), h('b', null, String(totPend)))),
    h('p', { class:'muted', style:{ margin:0, fontSize:'13px' } }, 'Lista de todos os objetos com situação, onde está e pendências. Serve para as reuniões.'),
    h('div', { class:'rbtns' }, h('button', { class:'btn acc', onclick:() => relGeralPdf(ps) }, h('span', { html:I.pdf }), 'PDF'), h('button', { class:'btn', onclick:() => copiarTexto(relGeralTexto(ps), 'Relatório copiado. Cole no WhatsApp.') }, h('span', { html:I.whats }), 'WhatsApp'))));
  b.append(h('div', { class:'sec-t' }, h('h3', null, 'Por processo')));
  if(!ps.length){ b.append(h('div', { class:'empty' }, 'Nenhum processo ainda.')); return; }
  const l = h('div', { class:'plist' });
  ps.forEach(p => {
    const t = tramAtual(p), pend = pendAbertas(p);
    l.append(h('button', { class:'pc', onclick:() => abrirRel(p) },
      h('div', { class:'l1' }, h('span', { class:'num' }, p.ficha.num ? 'Processo ' + p.ficha.num : 'Processo sem número'), chipStatus(p.status)),
      h('div', { class:'obj' }, objetoProc(p)),
      h('div', { class:'l3' }, t ? h('span', null, t.setor + (t.acao ? ' — ' + t.acao : '')) : h('span', null, 'Sem tramitação registrada'),
        pend.length ? h('span', { class:'chip warn' }, plural(pend.length, 'pendência', 'pendências')) : h('span', { class:'chip ok' }, 'Sem pendências'))));
  });
  b.append(l);
}

/* ===== f_mesa.js ===== */
/* =====================================================================
   Mesa: o processo inteiro em folhas, para ler e editar
   ===================================================================== */
const M = { p:null, zoom:88, selMode:false, painel:null, rTab:'pag', quebras:{}, pgList:[], anchors:[], cur:null, fls:{}, lay:null, editing:false };
const docEl = $('doc'), pagesEl = $('pages'), screenEl = $('mScreen');
const docById = id => M.p ? M.p.docs.find(d => d.id === id) || null : null;
const paginaEl = id => pagesEl.querySelector('.page[data-doc="' + id + '"]');

/* ---------- botões da tela (editáveis) ---------- */
const XS = [7.5, 21.5, 35.5, 49.5, 63.5, 77.5, 91.5];
function layPadrao(){
  const els = [];
  const ic = (code, x, ay, dy, size, rot, acao, cor, icone) => els.push({ id:uid(), code, type:'icone', x, ay, dy, size, shape:'bola', cor:cor || 'branco', rot, acao:acao || '', nota:'', ic:icone || '' });
  els.push(...topoPadrao());
  const up = [['R', 'revisar'], ['P', 'palavra'], ['¶', 'paragrafo'], ['T', 'tudo'], ['C', 'copiar'], ['V', 'colar'], ['▲', 'cima']];
  const dn = [['S', 'selecionar'], ['◀', 'esq'], ['▶', 'dir'], ['M', 'marca'], ['⊞', 'tabela'], ['Aa', 'formatar'], ['▼', 'baixo']];
  up.forEach((u, i) => ic('R' + (i + 1), XS[i], 'bottom', 74, 38, u[0], u[1]));
  dn.forEach((u, i) => ic('R' + (i + 8), XS[i], 'bottom', 28, 38, u[0], u[1]));
  return { v:3, topH:52, botH:100, abaY:12, leftW:88, rightW:92, speed:40, iconMode:'bola', labelMode:'nome', els };
}
/* barra de cima: início, título, lupa −, 88%, lupa +, rolar, notas, compartilhar */
function topoPadrao(){
  const els = [];
  const ic = (code, x, size, rot, acao, cor, icone) => els.push({ id:uid(), code, type:'icone', x, ay:'top', dy:26, size, shape:'bola', cor:cor || 'branco', rot, acao, nota:'', ic:icone || '' });
  ic('T1', 6.5, 34, 'Início', 'home', '', 'home');
  els.push({ id:uid(), code:'T2', type:'titulo', x:25.5, ay:'top', dy:26, w:27, h:40 });
  ic('Z2', 44.5, 30, 'Diminuir', 'zoomMenos', 'vidro', 'zoomOut');
  ic('Z1', 53, 32, '88%', 'zoom88', 'vidro');
  ic('Z3', 61.5, 30, 'Aumentar', 'zoomMais', 'vidro', 'zoomIn');
  ic('T3', 71.5, 34, 'Rolar', 'rolar');
  ic('T4', 81.5, 34, 'Folhas', 'selfolhas', '', 'selpg');
  ic('T5', 91.5, 34, 'Compartilhar', 'compartilhar', '', 'share');
  return els;
}
/* quem já tinha botões salvos: setas passam a mover o cursor e, se o topo estava como veio, ganha as lupas */
function migrarLay(L){
  L.els.forEach(e => { if(e.code === 'R7' && e.acao === 'anterior') e.acao = 'cima'; if(e.code === 'R14' && e.acao === 'proxima') e.acao = 'baixo'; });
  const orig = { T1:6.5, T2:31, Z1:55.5, T3:67, T4:79, T5:91 };
  const intacto = Object.keys(orig).every(c => { const e = L.els.find(x => x.code === c); return e && e.x === orig[c] && e.ay === 'top'; });
  if(intacto) L.els = L.els.filter(e => !(e.code in orig)).concat(topoPadrao());
  delete L.edgeTop; delete L.edgeH; if(L.abaY == null) L.abaY = 12;
  L.v = 2;
  return migrarLay3(L);
}
/* v3 (Panda): todos os botões iguais (sem o ▼ laranja) e o botão de notas vira seleção de folhas */
function migrarLay3(L){
  L.els.forEach(e => {
    if(e.cor === 'laranja'){ e.cor = 'branco'; if(e.size === 42) e.size = 38; }
    if(e.code === 'T4' && e.acao === 'notas'){ e.acao = 'selfolhas'; e.rot = 'Folhas'; e.ic = 'selpg'; }
  });
  L.v = 3; settings.lay = L; saveSettings();
  return L;
}
function layRetrato(){
  if(M.lay) return M.lay;
  let L = settings.lay;
  if(L && L.v === 1) L = migrarLay(L);
  else if(L && L.v === 2) L = migrarLay3(L);
  return M.lay = L && L.v === 3 ? L : layPadrao();
}
/* celular deitado = modo leitura: sem barra de cima, botões de leitura embaixo à esquerda, sem zoom */
function layDeitado(){
  if(M.layD) return M.layD;
  const els = [], b = (code, px, rot, acao, cor) => els.push({ id:'d-' + code, code, type:'icone', px, ay:'bottom', dy:27, size:38, shape:'bola', cor:cor || 'branco', rot, acao, nota:'', ic:'' });
  b('D1', 30, 'S', 'selecionar'); b('D2', 75, '◀', 'esq'); b('D3', 120, '▶', 'dir'); b('D4', 165, '▲', 'cima'); b('D5', 210, '▼', 'baixo');
  b('D6', 266, 'C', 'copiar'); b('D7', 311, 'V', 'colar'); b('D8', 368, 'Rolar', 'rolar');
  return M.layD = { v:2, topH:0, botH:54, abaY:10, leftW:52, rightW:58, iconMode:'bola', labelMode:'nome', els, fixo:true };
}
const lay = () => M.deitado ? layDeitado() : layRetrato();
/* margens seguras da tela (entalhe da câmera quando deitado) */
function margemSegura(){ const pr = $('saProbe'); if(!pr) return { l:0, r:0 }; const cs = getComputedStyle(pr); return { l:parseFloat(cs.paddingLeft) || 0, r:parseFloat(cs.paddingRight) || 0 }; }
const ehDeitado = () => { const W = window.innerWidth, H = window.innerHeight; return W > H && Math.min(screen.width || W, screen.height || H) < 600; };
const layY = (e, H) => e.ay === 'bottom' ? H - e.dy : e.dy;
/* em tela larga (computador) os botões ficam numa faixa central, do tamanho de um celular grande */
const faixaBotoes = W => Math.min(W, 640);
function aplicarBarras(){
  const L = lay();
  $('barTop').style.height = L.topH + 'px'; $('barTop').hidden = L.topH <= 0;
  $('barBot').style.height = L.botH + 'px'; $('barBot').hidden = L.botH <= 0;
  docEl.style.top = L.topH + 'px'; docEl.style.bottom = L.botH + 'px';
  const W = screenEl.clientWidth || window.innerWidth, F = faixaBotoes(W), sa = margemSegura();
  const mgL = (M.deitado ? sa.l : Math.round((W - F) / 2)) + 10, mgR = (M.deitado ? sa.r : Math.round((W - F) / 2)) + 10;
  const by = L.botH + (L.abaY == null ? 12 : L.abaY);
  $('edgeL').style.bottom = $('edgeR').style.bottom = by + 'px';
  $('edgeL').style.left = mgL + 'px'; $('edgeR').style.right = mgR + 'px';
  screenEl.classList.toggle('deitado', !!M.deitado);
  $('pLeft').style.width = L.leftW + '%'; $('pRight').style.width = L.rightW + '%';
  $('pill').style.top = (L.topH + 10) + 'px';
  /* bolinhas: ✎ signatário (ou PDF) acima do botão da aba esquerda; + novo documento acima da direita */
  $('bSig').style.left = $('bPdf').style.left = mgL + 'px'; $('bNovo').style.right = mgR + 'px';
  $('bSig').style.bottom = $('bPdf').style.bottom = $('bNovo').style.bottom = (by + 46) + 'px';
  M.abaPos = { l:mgL, r:mgR, b:by };
  $('fmt').style.bottom = (L.botH + 8) + 'px';
}
function rotuloEl(e){
  const L = lay();
  if(e.acao === 'zoom88') return L.labelMode === 'codigo' ? e.code : Math.round(M.zoom) + '%';
  return L.labelMode === 'codigo' ? e.code : L.labelMode === 'nome' ? (e.rot || '') : '';
}
function aplicarEl(n, e){
  const H = screenEl.clientHeight || window.innerHeight, W = screenEl.clientWidth || window.innerWidth, L = lay(), F = faixaBotoes(W);
  n.style.left = Math.round(e.px != null ? margemSegura().l + e.px : (W - F) / 2 + e.x / 100 * F) + 'px'; n.style.top = layY(e, H) + 'px';
  let cls = 'el ' + e.type; n.textContent = '';
  if(e.type === 'icone'){
    const lab = rotuloEl(e), shape = L.iconMode === 'misto' ? e.shape : L.iconMode;
    cls += ' ' + shape + (e.cor && e.cor !== 'branco' ? ' ' + e.cor : '') + (lab && lab.length <= 2 && !(e.ic && L.labelMode === 'nome') ? ' curto' : '') + (e.acao ? ' a-' + e.acao : '');
    if((e.acao === 'rolar' && ROL.on) || (e.acao === 'selecionar' && M.selMode) || (e.acao === 'selfolhas' && M.fsel) || (e.acao === 'formatar' && !$('fmt').hidden) || (e.acao === 'notas' && M.painel === 'dir' && M.rTab === 'notas')) cls += ' ativo';
    n.style.width = n.style.height = e.size + 'px';
    if(e.ic && I[e.ic] && L.labelMode === 'nome') n.innerHTML = I[e.ic]; else n.textContent = lab;
    n.setAttribute('aria-label', acaoNome(e.acao) || e.rot || e.code);
  } else if(e.type === 'titulo'){
    n.style.width = Math.round(e.w / 100 * F) + 'px'; n.style.height = e.h + 'px';
    const d = M.cur && M.cur.d, fl = M.cur && M.cur.fl;
    n.append(h('b', null, M.p ? (M.p.avulsa ? 'Mesa de PDF' : M.p.avdoc ? (M.p.numint ? 'SEINFRA N. ' + M.p.numint : (TIPO_NOME[M.p.tipoAv] || 'Avulso')) : (M.p.ficha.num ? M.p.ficha.num : 'Processo')) : ''), h('span', null, d ? d.nome + (fl ? ' · fls. ' + fl : '') : (M.p ? objetoProc(M.p) : '')));
    if(L.labelMode === 'codigo') n.append(h('span', { class:'tag' }, e.code));
  } else {
    n.style.width = Math.round(e.w / 100 * F) + 'px'; n.style.height = e.h + 'px';
    if(e.type === 'texto'){ cls += ' ' + (e.box || 'nenhuma') + (e.neg ? ' negrito' : ''); n.append(h('span', { class:'tx' }, e.text || '')); }
    if(L.labelMode === 'codigo') n.append(h('span', { class:'tag' }, e.code));
  }
  if(M.editing && ED.sel === e.id){ cls += ' sel'; n.append(h('span', { class:'knob' })); }
  n.className = cls;
}
function renderLay(){
  const layer = $('L-tela'); layer.replaceChildren();
  lay().els.forEach(e => { const n = h('div', { dataset:{ id:e.id } }); aplicarEl(n, e); layer.append(n); });
}
const elsDe = acao => Array.from($('L-tela').children).filter(n => { const e = lay().els.find(x => x.id === n.dataset.id); return e && (!acao || e.acao === acao); });
function atualizarIcones(){
  lay().els.forEach(e => { const n = $('L-tela').querySelector('[data-id="' + e.id + '"]'); if(n) aplicarEl(n, e); }); mostrarAbaBtns();
  const b = $('aBot').querySelector('[data-a="selecionar"]'); if(b) b.classList.toggle('on', !!M.selMode);
  const d = M.cur && M.cur.d; $('aSig').hidden = !(d && d.kind === 'texto');
}
/* botõezinhos das abas: somem quando uma aba ou a faixa de formatação está aberta */
function mostrarAbaBtns(){
  const esc = !!M.painel || !$('fmt').hidden || !!M.fsel || M.editing;
  $('edgeL').hidden = $('edgeR').hidden = esc;
  const d = M.cur && M.cur.d, bub = esc || !!M.deitado || !M.p;
  $('bNovo').hidden = bub || !!M.p.avulsa;
  $('bSig').hidden = bub || !d || d.kind !== 'texto';
  $('bPdf').hidden = bub || !d || d.kind !== 'pdf' || !M.cur.e;
}

/* ---------- abrir ---------- */
function abrirMesa(p, o = {}){
  if(M.p && M.p !== p) salvarTudo();
  if(M.fsel) sairSelecao(true);
  M.p = p; M.zoom = 100; pagesEl.style.setProperty('--tz', 1); pagesEl.classList.remove('tzoom'); M.quebras = {}; M.notas = {}; M.cur = null; M.selMode = false; TEC.digitando = false; TEC.ultimo = null;
  M.voltar = o.voltar || null; M.modoPdf = !!o.pdf;
  DB.ui.proc = p.id; if(!o.doc) DB.ui.doc = null; marcarUltimo(p); saveDB();
  fecharPainel(true); $('fmt').hidden = true; pararRolagem();
  mostrar('mesa');
  M.deitado = ehDeitado(); M.lastW = 0; M.girando = null;
  aplicarBarras();
  renderMesa();
  if(o.doc) setTimeout(() => { irParaDoc(o.doc); if(o.focar) focarDoc(o.doc); }, 60);
  if(o.pdf && p.docs.some(d => d.linha && d.kind === 'pdf')) setTimeout(() => entrarSelecao(false, 'pdf'), 120);
}
/* copia o que está na tela para os dados (só quando a mesa está aberta e é deste processo) */
function salvarTudo(){
  if(!M.p || VIEW !== 'mesa' || pagesEl.dataset.proc !== M.p.id) return;
  limparFolhaTmp(true);
  for(const k in salvarT) clearTimeout(salvarT[k]);
  pagesEl.querySelectorAll('.page.txt .body').forEach(b => { const d = docById(b.parentElement.dataset.doc); if(d) d.html = b.innerHTML; });
  saveDB(true);
}
/* grava só os textos que ainda tinham digitação pendente */
function descarregar(){
  if(!M.p || pagesEl.dataset.proc !== M.p.id) return;
  for(const id in salvarT){
    if(!salvarT[id]) continue;
    clearTimeout(salvarT[id]); salvarT[id] = 0;
    const d = docById(id), pg = paginaEl(id);
    if(d && pg) d.html = pg.querySelector('.body').innerHTML;
  }
}
function sairMesa(){
  salvarTudo(); pararRolagem(); fecharPainel(true);
  if(M.fsel) sairSelecao(true);
  const volta = M.voltar && procPorId(M.voltar);
  if(volta && volta !== M.p){ M.voltar = null; return abrirMesa(volta); }
  mostrar('home'); pagesEl.replaceChildren(); pagesEl.dataset.proc = ''; M.p = null; esconderCaret(); renderHome();
}

/* ---------- páginas ---------- */
let obs = null;
function larguraBase(){ return Math.min((docEl.clientWidth || window.innerWidth) * 0.92, 820); }
function renderMesa(manterScroll){
  const p = M.p; if(!p) return;
  descarregar();
  const sc = docEl.scrollTop;
  if(obs) obs.disconnect();
  obs = new IntersectionObserver(ents => ents.forEach(en => { if(en.isIntersecting) filaPdf(en.target); }), { root:docEl, rootMargin:'700px 0px' });
  pagesEl.replaceChildren(); pagesEl.dataset.proc = p.id;
  const linha = p.docs.filter(d => d.linha);
  if(!linha.length){
    pagesEl.append(h('div', { class:'mEmpty' }, h('b', null, p.avulsa ? 'Mesa de PDF' : 'Processo sem documentos'),
      h('span', null, p.avulsa ? 'Inclua PDFs, fotos ou ZIP do WhatsApp para juntar, separar, girar e numerar.' : 'Comece por um documento novo ou inclua os PDFs que você já tem.'),
      h('div', { class:'row', style:{ justifyContent:'center' } },
        p.avulsa ? null : h('button', { class:'btn acc', onclick:() => novoDocumento({}) }, h('span', { html:I.docplus }), 'Novo documento'),
        h('button', { class:'btn', onclick:() => incluirPdfNaMesa() }, h('span', { html:I.clip }), 'Incluir PDF'),
        p.avulsa ? h('button', { class:'btn', onclick:() => fotografar() }, h('span', { html:I.camera }), 'Fotografar') : null),
      p.avulsa || p.avdoc ? null : h('button', { class:'btn ghost sm', onclick:() => fichaSheet(p) }, 'Preencher a ficha central')));
  }
  for(const d of linha){
    pagesEl.append(h('div', { class:'dlabel', dataset:{ lab:d.id } }, h('span', { class:'dn' }, d.nome), h('span', { class:'dfl' })));
    if(d.kind === 'texto'){
      const body = h('div', { class:'body', contenteditable:'true', spellcheck:'true', lang:'pt-BR', inputmode:TEC.digitando ? 'text' : 'none', html:d.html || '<p><br></p>' });
      const pg = h('div', { class:'page txt' + (d.bras === 'nenhum' ? ' semtimbre' : ''), dataset:{ doc:d.id } },
        d.bras !== 'nenhum' ? h('div', { class:'timbre' }, h('img', { src:BRAS_SRC, alt:'' }), timbreLinhas().map(t => h('b', null, t)), timbreLinhas().length ? h('i', { class:'rule' }) : null) : null,
        body, fechoEl(d), h('div', { class:'notasV', hidden:true }), tarjaEl(d), h('span', { class:'fl fl0' }));
      prepararCorpo(body, d);
      ligarTexto(body, d);
      pagesEl.append(pg);
    } else {
      const lv = vivas(d);
      if(!lv.length) pagesEl.append(h('div', { class:'page ph', dataset:{ doc:d.id } }, 'Todas as páginas deste PDF foram retiradas.', h('button', { class:'btn sm', onclick:() => { d.pl.forEach(e => e.d = false); saveDB(); renderMesa(true); } }, 'Restaurar páginas')));
      d.pl.forEach((e, idx) => {
        if(e.d) return;
        const [w, hh] = tamanhoPagina(d, e);
        const pg = h('div', { class:'page pdf', dataset:{ doc:d.id, i:String(idx) }, style:{ aspectRatio:w + ' / ' + hh } },
          h('canvas'), h('div', { class:'ld' }, temPdfjs() ? '' : 'Carregando leitor de PDF…'), h('span', { class:'fl' }));
        const tags = []; if(e.b) tags.push('Brasão'); if(e.s < 0) tags.push('Em branco');
        if(tags.length) pg.append(h('div', { class:'pb' }, tags.map(t => h('span', null, t))));
        pg._ratio = hh / w;
        pagesEl.append(pg); obs.observe(pg);
      });
    }
  }
  aplicarLarguras();
  atualizarFolhas();
  renderLay();
  if(manterScroll) docEl.scrollTop = sc;
  mapaPaginas(); aoRolar();
  diagramarTudo();
  if(M.painel) renderPainel();
  mostrarAbaBtns();
  if(M.fsel) pintarSelecao();
  atualizarCaret();
}
function aplicarLarguras(){
  const w = Math.round(Math.min((docEl.clientWidth || window.innerWidth) * 0.88, 820));   /* folha travada em 88% */
  pagesEl.querySelectorAll('.page').forEach(p => p.style.width = w + 'px');
  pagesEl.querySelectorAll('.dlabel').forEach(l => l.style.width = w + 'px');
}
function atualizarFolhas(){
  if(!M.p) return;
  const F = M.fls = folhas(M.p);
  pagesEl.querySelectorAll('.dlabel').forEach(l => { const f = F[l.dataset.lab]; l.querySelector('.dfl').textContent = !f ? '' : f.k === 0 ? 'sem páginas' : f.k > 1 ? 'fls. ' + f.ini + '–' + f.fim : 'fls. ' + f.ini; });
  const cont = {};
  pagesEl.querySelectorAll('.page.pdf').forEach(pg => { const f = F[pg.dataset.doc]; if(!f) return; const k = cont[pg.dataset.doc] || 0; cont[pg.dataset.doc] = k + 1; pg.querySelector('.fl').textContent = 'fls. ' + (f.ini + k); });
  pagesEl.querySelectorAll('.page.txt').forEach(pg => { const f = F[pg.dataset.doc]; if(!f) return; pg.querySelector('.fl0').textContent = 'fls. ' + f.ini; pg.querySelectorAll('.brk .fl').forEach((m, j) => m.textContent = 'fls. ' + (f.ini + j + 1)); });
}

/* ---------- PDF: desenho sob demanda ---------- */
let filaP = Promise.resolve();
function filaPdf(pg){
  if(pg._fila) return; pg._fila = true;
  filaP = filaP.then(() => desenharPg(pg)).catch(e => { console.warn('pdf', e); const ld = pg.querySelector('.ld'); if(ld){ ld.textContent = 'Não consegui mostrar esta página. Toque para tentar de novo.'; ld.onclick = () => { pg._key = null; ld.textContent = 'Carregando…'; filaPdf(pg); }; } }).then(() => { pg._fila = false; });
}
async function desenharPg(pg){
  if(!temPdfjs() || !pg.isConnected) return;
  const d = docById(pg.dataset.doc); if(!d) return;
  const e = d.pl[+pg.dataset.i]; if(!e) return;
  const w = pg.clientWidth, key = w + '|' + JSON.stringify(e);
  if(pg._key === key) return;
  const bytes = await bytesDe(d.fileId);
  if(!bytes){ pg.querySelector('.ld').textContent = 'Arquivo não encontrado neste aparelho.'; return; }
  const pdf = await getPdf(d.fileId, bytes);
  await desenharPaginaPdf(pg.querySelector('canvas'), pdf, e, w);
  pg._key = key;
  const ld = pg.querySelector('.ld'); if(ld) ld.textContent = '';
}
function redesenharVisiveis(){
  const top = docEl.scrollTop - 400, bot = docEl.scrollTop + docEl.clientHeight + 400;
  pagesEl.querySelectorAll('.page.pdf').forEach(pg => { if(pg.offsetTop + pg.offsetHeight > top && pg.offsetTop < bot) filaPdf(pg); });
}
window.addEventListener('pdfjs-ready', () => { if(VIEW === 'mesa'){ pagesEl.querySelectorAll('.page.pdf .ld').forEach(l => l.textContent = ''); redesenharVisiveis(); } });

/* ---------- texto: edição, colagem e diagramação ---------- */
const salvarT = {}, diagT = {};
function ligarTexto(body, d){
  body.addEventListener('input', () => {
    if(body.querySelector('p.tmpP')) limparFolhaTmp(false);
    body.querySelectorAll('.campo,.fc.vazio').forEach(c => { if(!/^\[.*\]$/.test(c.textContent.trim())){ c.classList.remove('campo'); c.classList.remove('vazio'); } });
    clearTimeout(salvarT[d.id]); salvarT[d.id] = setTimeout(() => { salvarT[d.id] = 0; if(body.isConnected){ d.html = body.innerHTML; touch(M.p); saveDB(); } }, 450);
    clearTimeout(diagT[d.id]); diagT[d.id] = setTimeout(() => diagramar(d), 900);
  });
  body.addEventListener('paste', e => {
    const cd = e.clipboardData; if(!cd) return;
    const html = htmlDeColagem(cd);
    if(html == null) return;
    e.preventDefault();
    const s = window.getSelection();
    const campo = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('.campo');
    if(campo && body.contains(campo) && body.children.length === 1 && campo.parentElement === body.firstElementChild){
      body.innerHTML = html || '<p><br></p>';
      if(d.modelo === 'colar' && d.nome === 'Texto pronto'){ d.nome = titleOf(body.innerHTML); const l = pagesEl.querySelector('[data-lab="' + d.id + '"] .dn'); if(l) l.textContent = d.nome; }
      body.dispatchEvent(new Event('input')); toast('Texto colado no padrão do texto pronto.'); return;
    }
    document.execCommand('insertHTML', false, html || '');
  });
  body.addEventListener('click', e => {
    const c = e.target.closest('.campo,.fc.vazio');
    if(c && !M.editing) selecionarNo(c);
  });
  body.addEventListener('focus', () => { M.focoDoc = d.id; });
}
let diagFila = Promise.resolve();
function diagramar(d){
  diagFila = diagFila.then(async () => {
    if(!window.PDFLib || !M.p || d.kind !== 'texto') return;
    const pg = paginaEl(d.id); if(!pg) return;
    const body = pg.querySelector('.body');
    try{
      prepararCorpo(body, d);
      const fe = pg.querySelector('.fecho'), els = fe ? { loc:fe.querySelector('.loc'), n1:fe.querySelector('.n1'), n2:fe.querySelector('.n2') } : null;
      const r = await diagramarTexto(body, d, els);
      M.quebras[d.id] = r.quebras;
      mostrarNotas(pg, r.notas);
      const mudou = d.pags !== r.n; d.pags = r.n;
      marcar(d);
      if(mudou){ atualizarFolhas(); saveDB(); }
      mapaPaginas();
    }catch(e){ console.warn('diagramação', e); }
  });
  return diagFila;
}
function diagramarTudo(){ if(!M.p) return; M.p.docs.filter(d => d.linha && d.kind === 'texto').forEach(d => diagramar(d)); }
function marcar(d){
  const pg = paginaEl(d.id); if(!pg) return;
  pg.querySelectorAll('.brk').forEach(b => b.remove());
  const q = M.quebras[d.id] || [], W = pg.clientWidth, k = W / PAG.retrato.W, r0 = pg.getBoundingClientRect();
  const f = M.fls[d.id] || { ini:1 };
  q.forEach((x, j) => {
    let y = null;
    if(x.el && pg.contains(x.el)){
      const r = x.el.getBoundingClientRect(); y = r.top - r0.top;
      if(x.el.tagName === 'TABLE'){ const rows = Array.from(x.el.querySelectorAll('tr')).filter(tr => tr.closest('table') === x.el && tr.querySelector('td,th')); const tr = rows[x.ri >= 0 ? x.ri : 0]; if(tr) y = tr.getBoundingClientRect().top - r0.top; }
      else y += (x.linhas || 0) * (x.lh || 15.86) * k;
    }
    if(y == null) y = (j + 1) * W * 1.4142;
    pg.append(h('div', { class:'brk', style:{ top:Math.round(y) + 'px' } }, h('span', { class:'fl' }, 'fls. ' + (f.ini + j + 1))));
  });
}
function marcarTodos(){ if(M.p) M.p.docs.filter(d => d.linha && d.kind === 'texto').forEach(marcar); }

/* ---------- onde estou: documento e folha em vista ---------- */
function mapaPaginas(){
  const L = [], A = [];
  pagesEl.querySelectorAll('.page').forEach(pg => {
    const d = docById(pg.dataset.doc); if(!d) return;
    const top = pg.offsetTop, bot = top + pg.offsetHeight;
    L.push({ pg, d, top, bot });
    const lab = pg.previousElementSibling;
    A.push(lab && lab.classList.contains('dlabel') ? lab.offsetTop : top);
    if(d.kind === 'texto') pg.querySelectorAll('.brk').forEach(b => A.push(top + b.offsetTop));
  });
  M.pgList = L; M.anchors = A.sort((a, b) => a - b);
  /* espaço no fim só do tamanho necessário para o último documento também parar com o nome no topo */
  let esp = pagesEl.querySelector('.fimEsp'); if(!esp) esp = h('div', { class:'fimEsp', 'aria-hidden':'true' });
  pagesEl.append(esp); esp.style.height = '0px';
  const labs = pagesEl.querySelectorAll('.dlabel'), ult = labs[labs.length - 1];
  if(ult){ const falta = ult.offsetTop - 6 + docEl.clientHeight - docEl.scrollHeight; if(falta > 0) esp.style.height = Math.ceil(falta) + 'px'; }
  if(M.fsel) pintarSelecao();
  atualizarCaret();
}
/* âncora: o ponto do texto que está numa altura da tela, para voltar ao mesmo lugar depois de zoom ou giro */
function ancoraEm(yv){
  const y = docEl.scrollTop + yv; let alvo = null;
  for(const el of pagesEl.children){ if(el.offsetTop <= y) alvo = el; else break; }
  return alvo ? { el:alvo, frac:(y - alvo.offsetTop) / Math.max(1, alvo.offsetHeight), yv } : null;
}
function voltarAncora(a){ if(a && a.el.isConnected) docEl.scrollTop = a.el.offsetTop + a.frac * a.el.offsetHeight - a.yv; }
let _rolT = 0;
function aoRolar(){
  if(!M.p) return;
  if(!M.girando) M.ancTopo = ancoraEm(6);
  const y = docEl.scrollTop + docEl.clientHeight * 0.33;
  let it = null;
  for(const x of M.pgList){ if(x.top <= y) it = x; else break; }
  if(!it) it = M.pgList[0];
  const ant = M.cur && M.cur.pg;
  if(!it){ M.cur = null; atualizarTitulo(); return; }
  const f = M.fls[it.d.id] || { ini:1 };
  let fl = f.ini, e = null, idx = null;
  if(it.d.kind === 'pdf'){ idx = +it.pg.dataset.i; const antes = it.d.pl.slice(0, idx).filter(z => !z.d).length; fl = f.ini + antes; e = it.d.pl[idx]; }
  else { let n = 0; it.pg.querySelectorAll('.brk').forEach(b => { if(it.top + b.offsetTop <= y) n++; }); fl = f.ini + n; }
  const antD = M.cur && M.cur.d, antE = M.cur && M.cur.e;
  M.cur = { d:it.d, pg:it.pg, fl, e, idx };
  if(ant !== it.pg){ if(ant) ant.classList.remove('cur'); if(it.d.kind === 'pdf') it.pg.classList.add('cur'); }
  if(antD !== it.d || !antE !== !e){ mostrarAbaBtns(); if(DB.ui.doc !== it.d.id){ DB.ui.doc = it.d.id; saveDB(); } }
  atualizarTitulo();
  if(M.painel === 'dir' && M.rTab === 'pag'){ clearTimeout(_rolT); _rolT = setTimeout(renderPainel, 160); }
}
function atualizarTitulo(){
  const t = $('aTit'); if(!t || !M.p) return;
  const d = M.cur && M.cur.d, fl = M.cur && M.cur.fl, p = M.p;
  t.querySelector('b').textContent = d ? d.nome : (p.avulsa ? 'Mesa de PDF' : objetoProc(p));
  const num = p.avulsa ? 'Mesa de PDF' : p.avdoc ? (p.numint ? 'SEINFRA N. ' + p.numint : (TIPO_NOME[p.tipoAv] || 'Avulso')) : (p.ficha.num || 'Processo');
  t.querySelector('span').textContent = num + (fl ? ' · fls. ' + fl : '') + ' ▾';
  const s = $('aSig'); if(s) s.hidden = !(d && d.kind === 'texto');
}
let _raf = 0;
docEl.addEventListener('scroll', () => { if(_raf) return; _raf = requestAnimationFrame(() => { _raf = 0; aoRolar(); }); }, { passive:true });
function irParaDoc(id){ const l = pagesEl.querySelector('[data-lab="' + id + '"]'); if(l) docEl.scrollTop = Math.max(0, l.offsetTop - 10); aoRolar(); }
function irParaFolha(n){
  const F = M.fls;
  for(const d of M.p.docs){
    const f = F[d.id]; if(!f || n < f.ini || n > f.fim) continue;
    const k = n - f.ini;
    if(d.kind === 'pdf'){ const pgs = Array.from(pagesEl.querySelectorAll('.page.pdf[data-doc="' + d.id + '"]')); const pg = pgs[k]; if(pg) docEl.scrollTop = pg.offsetTop - 10; }
    else { const pg = paginaEl(d.id); if(pg){ const b = pg.querySelectorAll('.brk')[k - 1]; docEl.scrollTop = pg.offsetTop + (b ? b.offsetTop : 0) - 10; } }
    aoRolar(); return true;
  }
  return false;
}
function focarDoc(id){
  const pg = paginaEl(id); if(!pg) return;
  const body = pg.querySelector('.body'); body.focus();
  const c = body.querySelector('.campo,.fc.vazio');
  if(c) selecionarNo(c); else { const r = document.createRange(); r.selectNodeContents(body); r.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
}

/* ---------- zoom (88% ao abrir) e pinça ---------- */
let _zT = 0;
/* zoom só da letra: a folha continua em 88%, o texto cresce dentro dela */
const ZOOMS = [100, 125, 150, 180, 210, 250];
function hudZoom(){
  let hd = $('zHud'); if(!hd){ hd = h('div', { id:'zHud' }); screenEl.append(hd); }
  hd.textContent = M.zoom === 100 ? 'Texto no tamanho da folha' : 'Texto ' + M.zoom + '% · a folha continua em 88%';
  hd.hidden = false; clearTimeout(hd._t); hd._t = setTimeout(() => { hd.hidden = true; }, 1300);
}
function setZoom(z, silencioso){
  z = Math.round(clamp(z, 100, 260)); if(z < 104) z = 100;
  const a = ancoraEm(docEl.clientHeight * 0.33);
  M.zoom = z; pagesEl.style.setProperty('--tz', z / 100); pagesEl.classList.toggle('tzoom', z !== 100);
  voltarAncora(a);
  clearTimeout(_zT); _zT = setTimeout(() => { marcarTodos(); mapaPaginas(); aoRolar(); }, 260);
  if(!silencioso) hudZoom();
}
let pinca = null;
docEl.addEventListener('touchstart', ev => {
  ROL.toque = true;
  if(ev.touches.length === 2 && !M.editing){ const a = ev.touches[0], b = ev.touches[1]; pinca = { d0:Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z0:M.zoom }; }
}, { passive:true });
docEl.addEventListener('touchmove', ev => {
  if(!pinca || ev.touches.length !== 2) return;
  ev.preventDefault();
  const a = ev.touches[0], b = ev.touches[1], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  setZoom(pinca.z0 * d / pinca.d0, true);
}, { passive:false });
docEl.addEventListener('touchend', ev => { if(!ev.touches.length){ ROL.toque = false; ROL.last = 0; } if(pinca && ev.touches.length < 2){ pinca = null; hudZoom(); } });
docEl.addEventListener('touchcancel', ev => { if(!ev.touches.length){ ROL.toque = false; ROL.last = 0; } });
docEl.addEventListener('wheel', ev => { if(ev.ctrlKey){ ev.preventDefault(); setZoom(M.zoom * (ev.deltaY < 0 ? 1.08 : 0.93), true); } }, { passive:false });
/* girar o celular: deitado vira modo leitura; em pé volta como estava, no mesmo trecho do texto */
function aplicarModo(d){
  M.deitado = d;
  if(d){ if(M.editing) fecharEditor(); $('fmt').hidden = true; }
  aplicarBarras(); aplicarLarguras(); renderLay(); mostrarAbaBtns();
  if(M.girando) voltarAncora(M.girando);
}
window.addEventListener('resize', () => {
  if(VIEW !== 'mesa' || !M.p) return;
  const W = screenEl.clientWidth;
  if(W !== M.lastW && !M.girando) M.girando = M.ancTopo || ancoraEm(6);
  const d = ehDeitado(); if(d !== !!M.deitado) aplicarModo(d);
  clearTimeout(window.__rz); window.__rz = setTimeout(() => {
    if(VIEW !== 'mesa') return;
    aplicarBarras(); aplicarLarguras(); renderLay(); marcarTodos(); mapaPaginas();
    if(M.girando){ voltarAncora(M.girando); M.girando = null; }
    M.lastW = screenEl.clientWidth; aoRolar(); redesenharVisiveis();
  }, 220);
});

/* ---------- rolagem automática (tipo PJe) ---------- */
const ROL = { on:false, last:0, acc:0, toque:false };
function passo(t){
  if(!ROL.on) return;
  if(ROL.toque || M.painel || pinca){ ROL.last = 0; requestAnimationFrame(passo); return; }   // pausa enquanto o dedo está na tela ou uma aba está aberta
  if(ROL.last){ ROL.acc += layRetrato().speed * (t - ROL.last) / 1000; const s = Math.floor(ROL.acc); if(s){ docEl.scrollTop += s; ROL.acc -= s; } }
  ROL.last = t;
  if(docEl.scrollTop + docEl.clientHeight >= docEl.scrollHeight - 1){ pararRolagem(); toast('Fim do processo.'); return; }
  requestAnimationFrame(passo);
}
function iniciarRolagem(){ ROL.on = true; ROL.last = 0; ROL.acc = 0; $('pill').hidden = false; $('spdV').textContent = layRetrato().speed + ' px/s'; atualizarIcones(); requestAnimationFrame(passo); }
function pararRolagem(){ if(!ROL.on) return; ROL.on = false; $('pill').hidden = true; atualizarIcones(); }
function velocidade(dv){ const L = layRetrato(); L.speed = clamp(L.speed + dv, 5, 400); $('spdV').textContent = L.speed + ' px/s'; salvarLay(); }
$('spdM').onclick = () => velocidade(layRetrato().speed > 60 ? -20 : -5);
$('spdP').onclick = () => velocidade(layRetrato().speed >= 60 ? 20 : 5);
$('spdStop').onclick = pararRolagem;

/* ---------- teclado: só abre quando você quer digitar ----------
   1º toque no texto: põe o cursor, sem teclado.
   2º toque no mesmo ponto: abre o teclado para digitar.
   Botões da barra e abas: nunca abrem o teclado e fecham o que estiver aberto. */
const TEC = { digitando:false, ultimo:null, dica:false };
const tecladoVisivel = () => !!(window.visualViewport && window.visualViewport.height < window.innerHeight - 140);
function modoTeclado(on){ TEC.digitando = !!on; pagesEl.querySelectorAll('.body').forEach(b => b.setAttribute('inputmode', on ? 'text' : 'none')); }
function guardarSel(){ const s = window.getSelection(); return s && s.rangeCount ? { an:s.anchorNode, ao:s.anchorOffset, fn:s.focusNode, fo:s.focusOffset } : null; }
function voltarSel(g){ if(!g) return; try{ window.getSelection().setBaseAndExtent(g.an, g.ao, g.fn, g.fo); }catch(e){} }
function fecharTeclado(){
  const a = document.activeElement, body = a && a.classList && a.classList.contains('body') ? a : null;
  const eraDigitando = TEC.digitando; modoTeclado(false); TEC.ultimo = null;
  if(!body || !(eraDigitando || tecladoVisivel())) return;
  const g = guardarSel(), st = docEl.scrollTop, sl = docEl.scrollLeft;
  body.blur(); body.focus({ preventScroll:true }); voltarSel(g);
  docEl.scrollTop = st; docEl.scrollLeft = sl;
}
function abrirTeclado(body){
  body = body || curBody() || bodyDoDoc(M.cur && M.cur.d);
  if(!body) return toast('Este documento é PDF: não tem texto para digitar.');
  const g = guardarSel(); modoTeclado(true);
  if(document.activeElement === body) body.blur();
  body.focus({ preventScroll:true });
  if(g && body.contains(g.fn)) voltarSel(g);
  else { const r = document.createRange(); r.selectNodeContents(body); r.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
}
docEl.addEventListener('pointerdown', ev => {
  const b = ev.target.closest && ev.target.closest('#pages .body');
  if(!b || ev.pointerType === 'mouse') return;
  if(TEC.digitando && (tecladoVisivel() || document.activeElement === b)) return;   // já está digitando: segue normal
  const t = TEC.ultimo, perto = t && t.b === b && document.activeElement === b && Date.now() - t.t < 8000 && Math.hypot(ev.clientX - t.x, ev.clientY - t.y) < 34;
  if(perto){ TEC.ultimo = null; modoTeclado(true); TEC.abrir = b; return; }
  modoTeclado(false); TEC.ultimo = { b, x:ev.clientX, y:ev.clientY, t:Date.now() };
  if(!TEC.dica){ TEC.dica = true; toast('Toque de novo no mesmo ponto para abrir o teclado.', { ms:2600 }); }
});
docEl.addEventListener('click', () => { const b = TEC.abrir; TEC.abrir = null; if(b) abrirTeclado(b); });
if(window.visualViewport){ let aberto = false; window.visualViewport.addEventListener('resize', () => { const v = tecladoVisivel(); if(aberto && !v && TEC.digitando) modoTeclado(false); aberto = v; }); }

/* ---------- seleção e edição ---------- */
const LETRA = /[\p{L}\p{N}_]/u;
function frente(s){ if(s.anchorNode === s.focusNode) return s.anchorOffset <= s.focusOffset; return !!(s.anchorNode.compareDocumentPosition(s.focusNode) & Node.DOCUMENT_POSITION_FOLLOWING); }
function meioDePalavra(s){ const n = s.focusNode, o = s.focusOffset; if(!n || n.nodeType !== 3) return false; return o > 0 && o < n.data.length && LETRA.test(n.data[o - 1]) && LETRA.test(n.data[o]); }
function aparar(s){ for(let i = 0; i < 4 && !s.isCollapsed && frente(s) && /\s$/.test(String(s)); i++) s.modify('extend', 'backward', 'character'); }
function verFoco(){
  const s = window.getSelection(); if(!s.rangeCount || !s.focusNode) return;
  let rc = null;
  try{ const r = document.createRange(); r.setStart(s.focusNode, s.focusOffset); r.collapse(true); rc = r.getBoundingClientRect(); }catch(e){}
  if(!rc || (!rc.height && !rc.top)){ const el = s.focusNode.nodeType === 1 ? s.focusNode : s.focusNode.parentElement; rc = el.getBoundingClientRect(); }
  const d = docEl.getBoundingClientRect(), m = 48;
  if(rc.top < d.top + m) docEl.scrollTop -= d.top + m - rc.top; else if(rc.bottom > d.bottom - m) docEl.scrollTop += rc.bottom - (d.bottom - m);
}
/* sem cursor ainda: põe o cursor no início da linha que está na altura de leitura da tela, sem teclado */
function cursorNaTela(){
  const r0 = docEl.getBoundingClientRect();
  for(const f of [0.33, 0.2, 0.5, 0.1, 0.7]){
    const y = r0.top + r0.height * f;
    for(const b of pagesEl.querySelectorAll('.page.txt .body')){
      const rb = b.getBoundingClientRect(); if(rb.top > y || rb.bottom < y) continue;
      const cr = document.caretRangeFromPoint ? document.caretRangeFromPoint(rb.left + 4, y) : null;
      if(!cr || !b.contains(cr.startContainer)) continue;
      modoTeclado(false); b.focus({ preventScroll:true });
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(cr);
      try{ s.modify('move', 'backward', 'lineboundary'); }catch(e){}
      return s;
    }
  }
  return null;
}
/* o cursor precisa do texto em foco para aparecer; foca sem teclado e sem pular a tela */
function selComFoco(){
  let s = curSel();
  if(!s) return cursorNaTela();
  const b = curBody();
  if(b && document.activeElement !== b){ const g = guardarSel(), st = docEl.scrollTop; if(!TEC.digitando) b.setAttribute('inputmode', 'none'); b.focus({ preventScroll:true }); voltarSel(g); docEl.scrollTop = st; s = window.getSelection(); }
  return s;
}
function moverCursor(dir, unidade){
  if(M.selMode && curSel()) return estender(dir, unidade);
  const s = selComFoco(); if(!s) return toast('Toque no texto primeiro.');
  const n0 = s.focusNode, o0 = s.focusOffset;
  try{ s.modify('move', dir, unidade); }catch(e){}
  if(unidade === 'line' && s.focusNode === n0 && s.focusOffset === o0) pularDeDocumento(dir);   // fim do documento: segue para o próximo texto
  verFoco();
}
function pularDeDocumento(dir){
  const bodies = Array.from(pagesEl.querySelectorAll('.page.txt .body')), atual = curBody(), i = bodies.indexOf(atual);
  const alvo = bodies[dir === 'forward' ? i + 1 : i - 1];
  if(!alvo) return toast(dir === 'forward' ? 'Fim do último texto.' : 'Início do primeiro texto.', { ms:1200 });
  alvo.setAttribute('inputmode', TEC.digitando ? 'text' : 'none'); alvo.focus({ preventScroll:true });
  const r = document.createRange(); r.selectNodeContents(alvo); r.collapse(dir === 'forward');
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
/* S ligado: ◀ ▶ aumentam ou diminuem a seleção palavra inteira por palavra; ▲ ▼ linha por linha, sem cortar palavra */
function estender(dir, unidade){
  const s = selComFoco(); if(!s) return toast('Toque no texto primeiro.');
  try{
    s.modify('extend', dir, unidade);
    if(unidade === 'line' && meioDePalavra(s)) s.modify('extend', dir, 'word');
    aparar(s);
  }catch(e){ return toast('Este navegador não deixa selecionar assim.'); }
  verFoco();
}
function curSel(){ const s = window.getSelection(); if(!s || !s.rangeCount) return null; const r = s.getRangeAt(0); const n = r.startContainer, el = n.nodeType === 1 ? n : n.parentElement; if(!el || !el.closest('#pages .body')) return null; return s; }
function curBody(){ const s = curSel(); if(!s) return null; const n = s.anchorNode, el = n.nodeType === 1 ? n : n.parentElement; return el.closest('.body'); }
function selecionarNo(node){ const r = document.createRange(); r.selectNodeContents(node); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
function bodyDoDoc(d){ const pg = d && paginaEl(d.id); return pg ? pg.querySelector('.body') : null; }
function acao(a){
  let s;
  switch(a){
    case 'palavra':
      s = curSel(); if(!s) return toast('Toque no texto primeiro.');
      try{ s.collapseToStart(); s.modify('move', 'forward', 'character'); s.modify('move', 'backward', 'word'); s.modify('extend', 'forward', 'word'); aparar(s); }catch(e){ toast('Este navegador não deixa selecionar por palavra.'); }
      return;
    case 'paragrafo': {
      s = curSel(); if(!s) return toast('Toque no texto primeiro.');
      const n = s.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement), p = el && el.closest('p,li,td,th,h1,h2,h3');
      return p ? selecionarNo(p) : toast('Toque dentro de um parágrafo.');
    }
    case 'tudo': {
      const b = curBody() || bodyDoDoc(M.cur && M.cur.d);
      if(!b) return toast('Este documento é PDF: não tem texto para selecionar.');
      b.focus(); selecionarNo(b); return toast('Documento inteiro selecionado.');
    }
    case 'copiar': {
      const t = String(window.getSelection() || '');
      if(!t) return toast('Selecione algo primeiro.');
      return copiarTexto(t, 'Copiado.');
    }
    case 'colar': {
      if(!curSel()) return toast('Toque no texto onde vai colar.');
      const falha = () => toast(PWA ? 'O celular não liberou a área de transferência. Segure o dedo no texto e toque em Colar.' : 'Aqui no Claude o colar direto é bloqueado. No app instalado ele cola; por enquanto, segure o dedo no texto e toque em Colar.');
      try{
        if(navigator.clipboard && navigator.clipboard.read){
          navigator.clipboard.read().then(async items => {
            const it = items[0]; let html = null;
            if(it && it.types.includes('text/html')) html = limparHTML(await (await it.getType('text/html')).text());
            else { const t = await navigator.clipboard.readText(); html = looksMarkdown(t) ? mdParaHTML(t) : null; if(html == null){ document.execCommand('insertText', false, t); return; } }
            document.execCommand('insertHTML', false, html);
          }).catch(falha);
        } else navigator.clipboard.readText().then(t => document.execCommand('insertText', false, t), falha);
      }catch(e){ falha(); }
      return;
    }
    case 'selecionar': {
      M.selMode = !M.selMode; atualizarIcones();
      s = M.selMode ? selComFoco() : null; if(s && s.isCollapsed) acao('palavra');
      atualizarCaret();
      return toast(M.selMode ? 'Selecionar ligado: ◀ ▶ palavra a palavra (dois toques: até o fim da frase) · ▼ até o fim do parágrafo.' : 'Selecionar desligado: ◀ ▶ vão de palavra em palavra · ▲ ▼ de parágrafo em parágrafo.', { ms:2600 });
    }
    case 'esq': case 'dir': return navPalavra(a === 'esq' ? -1 : 1);
    case 'marca': {
      s = curSel(); if(!s || s.isCollapsed) return toast('Selecione o trecho primeiro.');
      const an = s.anchorNode, ae = an.nodeType === 1 ? an : an.parentElement, marcado = ae && ae.closest('[style*="background"]');
      document.execCommand('styleWithCSS', false, true); document.execCommand('hiliteColor', false, marcado ? 'transparent' : '#fbe38e'); document.execCommand('styleWithCSS', false, false);
      return;
    }
    case 'formatar': $('fmt').hidden = !$('fmt').hidden; return atualizarIcones();
    case 'tabela': return abrirTabela();
    case 'proxima': {
      if(M.selMode && curSel()) return estender('forward', 'line');
      const ref = docEl.scrollTop + docEl.clientHeight * 0.33, nx = M.anchors.find(t => t > ref + 2);
      if(nx == null) return toast('Última folha.');
      docEl.scrollTop = nx - 6; aoRolar(); return toast('Folha ' + (M.cur ? M.cur.fl : ''), { ms:900 });
    }
    case 'anterior': {
      if(M.selMode && curSel()) return estender('backward', 'line');
      const y = docEl.scrollTop, pv = M.anchors.filter(t => t - 6 < y - 4).pop();
      docEl.scrollTop = pv == null ? 0 : pv - 6; aoRolar(); return toast('Folha ' + (M.cur ? M.cur.fl : ''), { ms:900 });
    }
    case 'rolar': return ROL.on ? pararRolagem() : iniciarRolagem();
    case 'revisar': return abrirRevisao();
    case 'notas': return M.painel === 'dir' && M.rTab === 'notas' ? fecharPainel() : abrirPainel('dir', 'notas');
    case 'compartilhar': return compartilharSheet();
    case 'zoom88': return setZoom(100);
    case 'home': return sairMesa();
    case 'abaEsq': return M.painel === 'esq' ? fecharPainel() : abrirPainel('esq');
    case 'abaDir': return M.painel === 'dir' ? fecharPainel() : abrirPainel('dir');
    case 'novodoc': return novoDocumento({ p:M.p, depois:M.cur && M.cur.d.id });
    case 'incluirpdf': return incluirPdfNaMesa();
    case 'ficha': return M.p.avulsa ? toast('A mesa avulsa não tem ficha.') : fichaSheet(M.p);
    case 'relatorio': return M.p.avulsa ? toast('A mesa avulsa não tem relatório.') : abrirRel(M.p);
    case 'buscar': return buscarNoProcesso();
    case 'teclado': return abrirTeclado();
    case 'cima': return navParagrafo(-1);
    case 'baixo': return navParagrafo(1);
    case 'selfolhas': return M.fsel ? sairSelecao() : entrarSelecao(false);
    case 'signatario': { const d = M.cur && M.cur.d; return d && d.kind === 'texto' ? sigSheet(d) : toast('Vá até um texto para escolher o signatário.'); }
    case 'zoomMais': { const z = M.zoom, n = ZOOMS.find(v => v > z + 0.5); return n ? setZoom(n) : toast('Letra no máximo.'); }
    case 'zoomMenos': { const z = M.zoom, n = ZOOMS.filter(v => v < z - 0.5).pop(); return n ? setZoom(n) : toast('Letra no tamanho da folha.'); }
    case 'campo': return proximoCampo();
    case 'ferramentas': return menuFerramentas($('aBot').querySelector('[data-a="ferramentas"]'));
    case 'mais': return menuTopo($('aMais'));
  }
}
$('fmt').addEventListener('pointerdown', e => { if(e.target.closest('button')) e.preventDefault(); });
$('fmt').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  const f = b.dataset.f;
  if(f === 'fechar'){ $('fmt').hidden = true; return atualizarIcones(); }
  if(!curSel()) return toast('Toque no texto primeiro.');
  document.execCommand('styleWithCSS', false, false);
  if(f === 'h2' || f === 'p') document.execCommand('formatBlock', false, f === 'h2' ? 'h2' : 'p');
  else document.execCommand(f, false, null);
});
function buscarNoProcesso(){
  perguntar('Buscar no processo', 'Palavra ou trecho', '', 'Buscar').then(q => {
    if(!q) return;
    const n = norm(q);
    for(const d of M.p.docs.filter(x => x.linha && x.kind === 'texto')){
      const b = bodyDoDoc(d); if(!b) continue;
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let t;
      while((t = w.nextNode())){
        const i = norm(t.data).indexOf(n);
        if(i >= 0){ const r = document.createRange(); r.setStart(t, i); r.setEnd(t, Math.min(t.data.length, i + q.length)); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); const rc = r.getBoundingClientRect(), r0 = docEl.getBoundingClientRect(); docEl.scrollTop += rc.top - r0.top - docEl.clientHeight / 3; aoRolar(); return; }
      }
    }
    toast('Não encontrei “' + q + '” nos textos deste processo.');
  });
}

/* ---------- toques nos botões: usar ou editar ---------- */
let apertado = null;
screenEl.addEventListener('pointerdown', ev => {
  const n = ev.target.closest('.el');
  if(!M.editing){ if(n){ ev.preventDefault(); apertado = n; n.classList.add('press'); } return; }
  editorPointerDown(ev, n);
});
screenEl.addEventListener('pointermove', ev => { if(M.editing) editorPointerMove(ev); });
const soltar = ev => { if(apertado){ apertado.classList.remove('press'); apertado = null; } if(M.editing) editorPointerUp(ev); };
screenEl.addEventListener('pointerup', soltar);
screenEl.addEventListener('pointercancel', soltar);
screenEl.addEventListener('click', ev => {
  if(M.editing) return;
  const n = ev.target.closest('.el'); if(!n) return;
  const e = lay().els.find(x => x.id === n.dataset.id);
  if(!e) return;
  if(e.type === 'titulo'){ fecharTeclado(); return abrirPainel('esq'); }
  if(e.type !== 'icone') return;
  if(!e.acao) return toast((e.rot || e.code) + ': sem função. Escolha uma em Editar botões.');
  if(e.acao !== 'teclado') fecharTeclado();
  acao(e.acao);
});
for(const [id, q] of [['edgeL', 'esq'], ['edgeR', 'dir']]){
  $(id).addEventListener('pointerdown', ev => ev.preventDefault());   // não tira o cursor do texto nem abre teclado
  $(id).onclick = () => { if(M.editing) return; M.painel === q ? fecharPainel() : abrirPainel(q); };
}
$('scrim').onclick = () => fecharPainel();

/* ===== g_paineis.js ===== */
/* =====================================================================
   Abas laterais da mesa
   esquerda: processo, linha do processo, repositório, outros processos
   direita: página/documento, notas e pendências, ficha
   ===================================================================== */
function abrirPainel(qual, tab){
  fecharTeclado();
  M.painel = qual; if(tab) M.rTab = tab;
  $('pLeft').classList.toggle('open', qual === 'esq'); $('pRight').classList.toggle('open', qual === 'dir');
  $('scrim').hidden = false; mostrarAbaBtns();
  renderPainel(); atualizarIcones();
}
function fecharPainel(semAnim){
  M.painel = null;
  $('pLeft').classList.remove('open'); $('pRight').classList.remove('open');
  $('scrim').hidden = true; mostrarAbaBtns();
  if(!semAnim) atualizarIcones();
}
function renderPainel(){
  if(M.painel === 'esq') renderEsq(); else if(M.painel === 'dir') renderDir();
  /* botão de fechar dentro da aba, no mesmo lugar do botão que abriu */
  const box = M.painel === 'esq' ? $('pLeft') : M.painel === 'dir' ? $('pRight') : null; if(!box) return;
  const A = M.abaPos || { l:10, r:10, b:112 };
  const b = h('button', { class:'abaIn', 'aria-label':'Fechar a aba', html:M.painel === 'esq' ? I.side : I.sideR, onclick:() => fecharPainel() });
  b.addEventListener('pointerdown', ev => ev.preventDefault());
  if(M.painel === 'esq') b.style.left = A.l + 'px'; else b.style.right = A.r + 'px';
  b.style.bottom = A.b + 'px';
  box.append(b);
}
function cabPainel(titulo, extra){
  return h('div', { class:'ph', style:{ minHeight:lay().topH + 'px' } }, h('b', null, titulo), extra || null, h('button', { class:'ib', 'aria-label':'Fechar', html:I.x, onclick:() => fecharPainel() }));
}

/* ---------- esquerda ---------- */
M.onde = 'linha';
M.colap = M.colap || {};
function renderEsq(){
  const p = M.p, box = $('pLeft'); box.replaceChildren();
  const corpo = h('div', { class:'pbody' });
  box.append(cabPainel(p.avulsa ? 'Mesa avulsa' : p.avdoc ? (TIPO_NOME[p.tipoAv] || 'Documento avulso') : 'Processo'), corpo);
  if(!p.avulsa && !p.avdoc){
    const t = tramAtual(p);
    corpo.append(h('div', { class:'pcard' },
      h('b', null, p.ficha.num ? 'Processo ' + p.ficha.num : 'Processo sem número'), h('div', { class:'o' }, objetoProc(p)),
      h('div', { class:'row', style:{ marginTop:'4px', gap:'6px' } }, chipStatus(p.status), t ? h('span', { class:'chip' }, t.setor) : null, pendAbertas(p).length ? h('span', { class:'chip warn' }, plural(pendAbertas(p).length, 'pendência', 'pendências')) : null),
      h('div', { class:'pbub' },
        h('button', { onclick:() => fichaSheet(p) }, 'Ficha'),
        h('button', { onclick:() => { fecharPainel(); abrirRel(p); } }, 'Relatório'),
        h('button', { onclick:() => tramSheet(p) }, 'Tramitar'),
        h('button', { onclick:() => todosSigSheet() }, 'Signatários'))));
  } else if(p.avdoc){
    corpo.append(h('div', { class:'pcard' }, h('b', null, p.numint ? 'SEINFRA N. ' + p.numint : (TIPO_NOME[p.tipoAv] || 'Documento')), h('div', { class:'o' }, objetoProc(p)),
      h('div', { class:'pbub' }, h('button', { onclick:() => { const d = p.docs.find(x => x.kind === 'texto'); if(d) sigSheet(d); } }, 'Signatário'), h('button', { onclick:() => processoDeAvulso(p) }, 'Criar processo'))));
  } else corpo.append(h('p', { class:'muted', style:{ margin:'0 4px', fontSize:'13px' } }, 'Aqui ficam os PDFs e textos soltos. No ✎ de cada documento dá para mover para um processo.'));
  const F = M.fls, linha = p.docs.filter(d => d.linha), N = numeracaoLinha(p);
  corpo.append(h('div', { class:'row' }, h('span', { class:'lbl grow' }, p.avdoc ? 'Documento' : 'Linha do processo'), h('span', { class:'muted', style:{ fontSize:'12px' } }, F._total ? plural(F._total, 'folha', 'folhas') : '')));
  const lista = h('div');
  const cur = M.cur && M.cur.d && M.cur.d.id;
  linha.forEach(d => {
    const f = F[d.id], anexo = !!(d.pai && linha.some(x => x.id === d.pai));
    if(anexo && M.colap[d.pai]) return;
    const irm = anexo ? linha.filter(x => x.pai === d.pai) : linha.filter(x => !(x.pai && linha.some(y => y.id === x.pai)));
    const i = irm.indexOf(d), filhos = anexo ? [] : linha.filter(x => x.pai === d.id);
    lista.append(h('div', { class:'lrow' + (anexo ? ' anexo' : '') + (d.id === cur ? ' cur' : '') },
      h('span', { class:'nn' }, (N[d.id] ? N[d.id].n : ''), h('em', null, '···')),
      h('span', { class:'tx', onclick:() => { fecharPainel(); irParaDoc(d.id); } }, h('b', null, d.nome),
        h('span', null, (d.kind === 'pdf' ? 'PDF' : (TIPO_NOME[d.tipo] || 'Texto')) + (f ? ' · ' + (f.k === 0 ? 'sem páginas' : f.k > 1 ? 'fls. ' + f.ini + '–' + f.fim : 'fl. ' + f.ini) : '') + (filhos.length ? ' · ' + plural(filhos.length, 'anexo', 'anexos') : '') + (d.repo ? ' · repositório' : ''))),
      filhos.length ? h('button', { class:'tg', 'aria-label':M.colap[d.id] ? 'Mostrar anexos' : 'Esconder anexos', onclick:() => { M.colap[d.id] = !M.colap[d.id]; renderEsq(); renderPainel(); } }, M.colap[d.id] ? '▸' : '▾') : null,
      h('button', { class:'cb', 'aria-label':'Subir', html:I.up, disabled:i === 0, onclick:() => moverDoc(d, -1) }),
      h('button', { class:'cb', 'aria-label':'Descer', html:I.down, disabled:i === irm.length - 1, onclick:() => moverDoc(d, 1) }),
      h('button', { class:'cb', 'aria-label':'Opções', html:I.more, onclick:ev => menuDoc(d, ev.currentTarget) })));
  });
  if(!linha.length) lista.append(h('div', { class:'muted', style:{ padding:'8px 4px', fontSize:'13.5px' } }, 'Nenhum documento na linha ainda.'));
  corpo.append(lista);
  corpo.append(h('div', { class:'row' },
    p.avulsa ? null : h('button', { class:'btn acc sm grow', onclick:() => { fecharPainel(); novoDocumento({}); } }, h('span', { html:I.docplus }), 'Novo documento'),
    h('button', { class:'btn sm grow', onclick:() => incluirPdfNaMesa() }, h('span', { html:I.clip }), 'Incluir PDF')));
  if(!p.avulsa && !p.avdoc) corpo.append(h('div', { class:'row', style:{ gap:'6px' } }, h('span', { class:'muted', style:{ fontSize:'12.5px' } }, 'PDF entra em:'),
    h('div', { class:'seg grow' }, [['linha', 'Linha'], ['repo', 'Repositório'], ['ambos', 'Ambos']].map(o => h('button', { class:M.onde === o[0] ? 'on' : '', style:{ minHeight:'30px', fontSize:'12.5px' }, onclick:() => { M.onde = o[0]; renderEsq(); renderPainel(); } }, o[1])))));
  if(!p.avulsa && !p.avdoc){
    const repo = p.docs.filter(d => d.repo);
    corpo.append(h('div', { class:'row' }, h('span', { class:'lbl grow' }, 'Repositório do objeto'), repo.length ? h('button', { class:'btn sm soft', onclick:() => compartilharRepo(p) }, h('span', { html:I.folderShare }), 'Compartilhar pasta') : null));
    if(!repo.length) corpo.append(h('p', { class:'muted', style:{ margin:'0 4px', fontSize:'13px' } }, 'O repositório é a pasta que você disponibiliza para todo mundo. Marque “no repositório” no ✎ de um documento ou escolha “Repositório” ao incluir um PDF.'));
    repo.forEach(d => corpo.append(h('div', { class:'lrow' }, h('span', { class:'nn' }, h('em', null, '···')),
      h('span', { class:'tx', onclick:() => { if(d.linha){ fecharPainel(); irParaDoc(d.id); } else verDocSolto(d); } }, h('b', null, d.nome), h('span', null, (d.kind === 'pdf' ? 'PDF' : 'Texto') + (d.linha ? ' · também na linha' : ' · só no repositório'))),
      h('button', { class:'cb', 'aria-label':'Opções', html:I.more, onclick:() => menuDoc(d) }))));
  }
  const outros = procsReais().filter(x => x !== p).sort((a, b) => b.updated - a.updated).slice(0, 6);
  if(outros.length){
    corpo.append(h('span', { class:'lbl' }, 'Outros processos'));
    outros.forEach(q => corpo.append(h('div', { class:'lrow' }, h('span', { class:'tx', onclick:() => abrirMesa(q) }, h('b', null, q.ficha.objeto || tituloProc(q)), h('span', null, q.ficha.num ? 'nº ' + q.ficha.num : 'sem número')))));
  }
  corpo.append(h('div', { style:{ height:'60px' } }));
}
/* sobe/desce: o documento principal leva os anexos junto; anexo só troca de lugar com os irmãos */
function moverDoc(d, dir){
  const p = M.p, linha = p.docs.filter(x => x.linha);
  const ehAnexo = x => !!(x.pai && p.docs.some(y => y.id === x.pai));
  salvarTudo();
  if(ehAnexo(d)){
    const irm = p.docs.filter(x => x.pai === d.pai && x.linha), i = irm.indexOf(d), j = i + dir;
    if(j < 0 || j >= irm.length) return;
    const a = p.docs.indexOf(d), b = p.docs.indexOf(irm[j]); p.docs[a] = irm[j]; p.docs[b] = d;
  } else {
    const princ = linha.filter(x => !ehAnexo(x)), i = princ.indexOf(d), j = i + dir;
    if(j < 0 || j >= princ.length) return;
    const outro = princ[j];
    const bloco = x => [x].concat(p.docs.filter(y => y.pai === x.id));
    const A = bloco(d), B = bloco(outro), resto = p.docs.filter(x => !A.includes(x) && !B.includes(x));
    const primeiro = dir < 0 ? B[0] : A[0], pos = p.docs.indexOf(primeiro);
    const antes = p.docs.slice(0, pos).filter(x => resto.includes(x)), depois = p.docs.slice(pos).filter(x => resto.includes(x));
    p.docs.splice(0, p.docs.length, ...antes, ...(dir < 0 ? A.concat(B) : B.concat(A)), ...depois);
  }
  touch(p); saveDB(); renderMesa(true); renderPainel();
}
function editarDoc(d){
  if(d.kind === 'texto'){ fecharPainel(); irParaDoc(d.id); focarDoc(d.id); }
  else { irParaDoc(d.id); abrirPainel('dir', 'pag'); }
}
function incluirPdfNaMesa(){
  const p = M.p, onde = p.avulsa ? 'linha' : M.onde;
  escolherArquivos(async l => {
    salvarTudo();
    const novos = await incluirArquivos(p, l, onde, onde !== 'repo' && M.cur ? M.cur.d.id : null);
    if(!novos.length) return;
    if(onde !== 'repo') fecharPainel();
    renderMesa(true); if(M.painel) renderPainel();
    if(onde !== 'repo') irParaDoc(novos[0].id);
    if(p.avulsa && !M.fsel) setTimeout(() => entrarSelecao(false, 'pdf'), 150);
    toast(novos.length === 1 ? 'PDF incluído' + (onde === 'repo' ? ' no repositório.' : onde === 'ambos' ? ' na linha e no repositório.' : '.') : novos.length + ' PDFs incluídos.');
  });
}
async function verDocSolto(d){
  const b = busy('Abrindo…');
  try{ const bytes = await bytesDoc(d); b.end(); previa(bytes, safeName(d.nome, '.pdf')); }catch(e){ b.end(); toast('Não foi possível abrir.'); }
}

/* ---------- direita ---------- */
function renderDir(){
  const box = $('pRight'); box.replaceChildren();
  const tabs = h('div', { class:'tabs' }, [['pag', 'Página'], ['notas', 'Notas'], ['ficha', 'Ficha']].map(t => h('button', { class:M.rTab === t[0] ? 'on' : '', onclick:() => { M.rTab = t[0]; renderDir(); atualizarIcones(); } }, t[1])));
  const corpo = h('div', { class:'pbody' });
  box.append(cabPainel(M.p.avulsa ? 'Mesa avulsa' : (M.p.ficha.num || 'Processo')), tabs, corpo);
  if(M.rTab === 'notas') painelNotas(corpo);
  else if(M.rTab === 'ficha') painelFicha(corpo);
  else painelPagina(corpo);
}
const ab = (rot, ic, fn, o = {}) => h('button', { class:'ab' + (o.on ? ' on' : ''), disabled:o.off, onclick:fn }, h('i', { html:I[ic] || ic }), rot);
function painelPagina(corpo){
  const c = M.cur;
  if(!c){ corpo.append(h('div', { class:'empty' }, 'Abra um documento para ver as ações.')); return; }
  const d = c.d, p = M.p;
  corpo.append(h('div', { class:'pcard' }, h('b', null, d.nome), h('div', { class:'o' }, (d.kind === 'pdf' ? 'PDF' : 'Texto') + ' · folha ' + c.fl + (d.kind === 'pdf' ? ' · página ' + (vivas(d).indexOf(c.e) + 1) + ' de ' + vivas(d).length : ' · ' + plural(paginasDoc(d), 'página', 'páginas')))));
  const re = (fn) => () => { fn(); salvarTudo(); touch(p); saveDB(); renderMesa(true); renderDir(); };
  if(d.kind === 'pdf' && c.e){
    const e = c.e;
    corpo.append(h('span', { class:'lbl' }, 'Esta página'));
    corpo.append(h('div', { class:'agrid' },
      ab('Girar', 'rot', re(() => { e.r = ((e.r || 0) + 90) % 360; })),
      ab('Brasão aqui', h('img', { src:BRAS_SRC, alt:'', style:{ width:'22px' } }).outerHTML, re(() => { e.b = !e.b; }), { on:e.b }),
      ab('Retirar', 'trash', () => { e.d = true; salvarTudo(); saveDB(); renderMesa(true); renderDir(); toast('Página retirada.', { acao:'Desfazer', fn:() => { e.d = false; saveDB(); renderMesa(true); renderPainel(); } }); }),
      ab('Branca depois', 'blank', re(() => { d.pl.splice(d.pl.indexOf(e) + 1, 0, { s:-1, r:0, b:false, d:false }); })),
      ab('Dividir aqui', 'split', () => dividirDoc(d, e), { off:vivas(d).indexOf(e) === 0 }),
      ab('Extrair', 'dup', () => extrairSheet(d)),
      ab('Buscar', 'search', () => buscarNoProcesso()),
      ab('Ir à folha', 'hash', async () => { const n = await perguntar('Ir à folha', 'Número da folha', '', 'Ir', { tipo:'number' }); if(n && !irParaFolha(parseInt(n, 10))) toast('Folha ' + n + ' não existe neste processo.'); })));
  }
  corpo.append(h('span', { class:'lbl' }, 'Documento'));
  const modoB = d.kind === 'pdf' ? modoBrasPdf(d) : d.bras;
  const itens = [
    ab(modoB === 'todas' ? 'Brasão: todas' : modoB === 'primeira' ? 'Brasão: 1ª' : modoB === 'misto' ? 'Brasão: algumas' : 'Sem brasão', h('img', { src:BRAS_SRC, alt:'', style:{ width:'22px', opacity:modoB === 'nenhum' ? '.35' : '1' } }).outerHTML, re(() => {
      const prox = modoB === 'todas' ? 'primeira' : modoB === 'primeira' ? 'nenhum' : 'todas';
      if(d.kind === 'pdf'){ let prim = true; d.pl.forEach(z => { if(z.d){ z.b = false; return; } z.b = prox === 'todas' || (prox === 'primeira' && prim); prim = false; }); }
      else d.bras = prox;
    }), { on:modoB !== 'nenhum' })
  ];
  if(d.kind === 'pdf'){
    itens.push(ab('Girar tudo', 'rot', re(() => vivas(d).forEach(z => z.r = ((z.r || 0) + 90) % 360))));
    if(d.pl.some(z => z.d)) itens.push(ab('Restaurar retiradas', 'undo', re(() => d.pl.forEach(z => z.d = false))));
  } else {
    itens.push(ab('Signatário', 'sig', () => sigSheet(d)));
    itens.push(ab('Revisar tudo', 'sparkle', () => { fecharPainel(); revisarTudo(d); }));
    itens.push(ab('Word', 'word', () => baixarWord(d)));
    itens.push(ab('Copiar texto', 'copy', () => { const b = bodyDoDoc(d); copiarTexto(textoPuro(b), 'Texto copiado sem formatação.'); }));
  }
  itens.push(ab('Prévia PDF', 'eye', () => previaDoc(d)));
  itens.push(ab('Baixar PDF', 'dl', () => baixarDoc(d)));
  itens.push(ab('Repositório', 'folderShare', () => { d.repo = !d.repo; saveDB(); renderDir(); toast(d.repo ? 'Documento no repositório do objeto.' : 'Documento fora do repositório.'); }, { on:d.repo }));
  itens.push(ab('Mais', 'more', () => menuDoc(d)));
  corpo.append(h('div', { class:'agrid' }, itens));
  corpo.append(h('span', { class:'lbl' }, 'Processo'));
  corpo.append(h('div', { class:'agrid' },
    ab('Juntar em PDF', 'layers', () => compartilharSheet()),
    ab('Novo documento', 'docplus', () => { fecharPainel(); novoDocumento({ p, depois:d.id }); }),
    ab('Incluir PDF', 'clip', () => incluirPdfNaMesa()),
    ab('Editar botões', 'gear', () => { fecharPainel(); abrirEditor(); })));
}
function modoBrasPdf(d){
  const lv = vivas(d); if(!lv.length) return 'nenhum';
  const on = lv.filter(e => e.b).length;
  if(!on) return 'nenhum';
  if(on === lv.length && lv.length > 1) return 'todas';
  if(on === 1 && lv[0].b) return lv.length === 1 ? 'todas' : 'primeira';
  return 'misto';
}
function menuDoc(d, ancora){
  const p = M.p;
  menu(d.nome, [
    { t:'Renomear', ic:'pen', fn:async () => { const n = await perguntar('Renomear', 'Nome do documento', d.nome); if(n){ d.nome = n; saveDB(); renderMesa(true); renderPainel(); } } },
    { t:'Duplicar', ic:'dup', fn:() => { salvarTudo(); const c = Object.assign(clone(d), { id:uid(), nome:d.nome + ' (cópia)' }); p.docs.splice(p.docs.indexOf(d) + 1, 0, c); saveDB(); renderMesa(true); renderPainel(); } },
    { t:d.linha ? 'Tirar da linha do processo' : 'Colocar na linha do processo', sub:d.linha ? 'Continua no repositório, se estiver lá' : '', ic:'layers', fn:() => { d.linha = !d.linha; if(!d.linha && !d.repo) d.repo = true; saveDB(); renderMesa(true); renderPainel(); } },
    { t:d.repo ? 'Tirar do repositório' : 'Colocar no repositório', ic:'folderShare', fn:() => { d.repo = !d.repo; saveDB(); renderPainel(); } },
    { t:'Mover para outro processo', ic:'folder', fn:() => moverParaProcesso(d) },
    d.pai ? { t:'Deixar de ser anexo', ic:'layers', fn:() => { salvarTudo(); d.pai = null; ordenarAnexos(p); saveDB(); renderMesa(true); renderPainel(); } }
      : { t:'Tornar anexo de outro documento', sub:'Passa a andar junto com ele (1.1, 1.2…)', ic:'clip', fn:() => tornarAnexo(d) },
    { t:'Prévia do PDF', ic:'eye', fn:() => previaDoc(d) },
    { t:'Baixar PDF', ic:'dl', fn:() => baixarDoc(d) },
    d.kind === 'texto' ? { t:'Baixar Word', ic:'word', fn:() => baixarWord(d) } : null,
    '-',
    { t:'Excluir documento', ic:'trash', danger:true, fn:() => excluirDoc(d) }
  ], ancora);
}
async function tornarAnexo(d){
  const p = M.p, ops = p.docs.filter(x => x.linha && x !== d && !x.pai).map(x => [x.id, x.nome]);
  if(!ops.length) return toast('Não há outro documento para anexar.');
  const id = await escolher('Anexo de qual documento?', ops, null); if(!id) return;
  salvarTudo();
  p.docs.filter(x => x.pai === d.id).forEach(x => x.pai = id);
  d.pai = id; ordenarAnexos(p); touch(p); saveDB(); renderMesa(true); renderPainel(); toast('Agora é anexo.');
}
async function excluirDoc(d){
  if(!await confirmar('Excluir documento', '“' + d.nome + '” será apagado deste processo.', 'Excluir', true)) return;
  const p = M.p; salvarTudo();
  p.docs = p.docs.filter(x => x !== d);
  p.docs.forEach(x => { if(x.pai === d.id) x.pai = null; });
  if(d.kind === 'pdf' && !DB.procs.some(q => q.docs.some(x => x.fileId === d.fileId))) await apagarBytes(d.fileId);
  touch(p); saveDB(true); renderMesa(true); renderPainel(); toast('Documento excluído.');
}
async function moverParaProcesso(d){
  const ops = [['avulsa', 'Mesa avulsa']].concat(procsReais().sort((a, b) => b.updated - a.updated).map(q => [q.id, tituloProc(q), q.ficha.objeto]));
  const id = await escolher('Mover para', ops.filter(o => o[0] !== M.p.id), null);
  if(!id) return;
  const q = id === 'avulsa' ? procAvulsa() : procPorId(id); if(!q) return;
  salvarTudo();
  const fonte = clone(M.p.ficha);
  const junto = [d].concat(M.p.docs.filter(x => x.pai === d.id));
  M.p.docs = M.p.docs.filter(x => !junto.includes(x)); junto.forEach(x => q.docs.push(x)); if(d.pai) d.pai = null; touch(q); touch(M.p);
  if(d.kind === 'texto'){ replicarFicha(q, fonte, [d]); recontar(q); }
  saveDB(true); renderMesa(true); renderPainel();
  toast('Documento movido.', { acao:'Abrir', fn:() => abrirMesa(q, { doc:d.id }) });
}
function dividirDoc(d, e){
  const i = d.pl.indexOf(e); if(i <= 0) return;
  salvarTudo();
  const novo = Object.assign(clone(d), { id:uid(), nome:d.nome + ' (parte 2)', pl:d.pl.slice(i) });
  d.pl = d.pl.slice(0, i);
  M.p.docs.splice(M.p.docs.indexOf(d) + 1, 0, novo);
  saveDB(); renderMesa(true); renderDir(); toast('Documento dividido em dois.');
}
function faixaPaginas(txt, total){
  const out = new Set();
  String(txt || '').split(/[,;\s]+/).forEach(pt => { const m = pt.match(/^(\d+)(?:-(\d+))?$/); if(!m) return; let a = +m[1], b = m[2] ? +m[2] : a; if(a > b) [a, b] = [b, a]; for(let k = a; k <= b; k++) if(k >= 1 && k <= total) out.add(k); });
  return Array.from(out).sort((a, b) => a - b);
}
function extrairSheet(d){
  const lv = vivas(d), atual = M.cur && M.cur.e ? lv.indexOf(M.cur.e) + 1 : 1;
  const inp = h('input', { class:'inp', value:String(atual), placeholder:'Ex.: 1-3, 5' });
  sheet({ titulo:'Extrair páginas', corpo:[h('label', { class:'fld' }, h('span', null, 'Páginas deste PDF (1 a ' + lv.length + ')'), inp), h('p', { class:'muted', style:{ margin:0, fontSize:'13px' } }, 'Use vírgula e hífen: 1-3, 5, 8-10.')],
    botoes:[
      { t:'Baixar', fn:async () => { const ks = faixaPaginas(inp.value, lv.length); if(!ks.length){ toast('Informe as páginas.'); return false; } const bytes = await PDFGen.fileBytes({ bytes:await bytesDe(d.fileId), pl:ks.map(k => lv[k - 1]), name:d.nome }); offer(bytes, safeName(d.nome + ' (págs. ' + inp.value.replace(/\s/g, '') + ')', '.pdf')); } },
      { t:'Novo documento', v:'pri', fn:() => { const ks = faixaPaginas(inp.value, lv.length); if(!ks.length){ toast('Informe as páginas.'); return false; } salvarTudo(); const c = Object.assign(clone(d), { id:uid(), nome:d.nome + ' (págs. ' + inp.value.replace(/\s/g, '') + ')', pl:ks.map(k => clone(lv[k - 1])) }); M.p.docs.splice(M.p.docs.indexOf(d) + 1, 0, c); saveDB(); renderMesa(true); renderPainel(); toast('Páginas extraídas para um novo documento.'); } }
    ] });
}
/* ---------- saídas de um documento ---------- */
function htmlDoc(d){ const b = bodyDoDoc(d); return b ? b.innerHTML : d.html || ''; }
function textoPuro(b){
  if(!b) return '';
  const c = b.cloneNode(true);
  c.querySelectorAll('br').forEach(x => x.replaceWith('\n'));
  const linhas = [];
  c.childNodes.forEach(n => { if(n.nodeType === 1 && n.tagName === 'TABLE') n.querySelectorAll('tr').forEach(tr => linhas.push(Array.from(tr.children).map(x => x.textContent.trim()).join(' | '))); else if(n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) n.querySelectorAll('li').forEach((li, i) => linhas.push((n.tagName === 'OL' ? (i + 1) + '. ' : '• ') + li.textContent.trim())); else { const t = n.textContent.replace(/ /g, ' ').trim(); if(t) linhas.push(t); } });
  return linhas.join('\n\n');
}
const procDoDoc = (d, p) => p || (M.p && M.p.docs.includes(d) ? M.p : DB.procs.find(q => q.docs.includes(d))) || null;
/* nome do arquivo: documento + signatário (para trocar, gere de novo com outro signatário) */
function nomeArquivo(d, ext){
  const s = d.sig || {}, pes = d.kind === 'texto' && s.pessoa ? pessoaPorId(s.pessoa) : null;
  let nm = d.nome;
  if(pes){ const pt = titleCase(pes.nome).split(/\s+/).filter(w => !CONECTIVOS.has(w.toLowerCase())); nm += ' - ' + (pt.length > 1 ? pt[0] + ' ' + pt[pt.length - 1] : pt[0] || ''); }
  return safeName(nm, ext);
}
async function bytesDoc(d, p){
  if(d.kind === 'texto'){ const t = await PDFGen.texto(htmlDoc(d), { doc:d, proc:procDoDoc(d, p), title:d.nome }); return t.bytes; }
  return PDFGen.fileBytes({ bytes:await bytesDe(d.fileId), pl:d.pl, name:d.nome });
}
async function previaDoc(d, p){ if(!precisaLibs()) return; const b = busy('Gerando prévia…'); try{ const bytes = await bytesDoc(d, p); b.end(); previa(bytes, nomeArquivo(d, '.pdf')); }catch(e){ b.end(); console.error(e); toast(e && e.message === 'vazio' ? 'O documento está vazio.' : 'Não foi possível gerar o PDF.'); } }
async function baixarDoc(d, p){ if(!precisaLibs()) return; const b = busy('Gerando PDF…'); try{ const bytes = await bytesDoc(d, p); b.end(); await offer(bytes, nomeArquivo(d, '.pdf')); aposExportar(d, p); }catch(e){ b.end(); console.error(e); toast(e && e.message === 'vazio' ? 'O documento está vazio.' : 'Não foi possível gerar o PDF.'); } }
async function baixarWord(d, p){ if(!precisaLibs()) return; const b = busy('Gerando Word…'); try{ const blob = await buildDocx(htmlDoc(d), d, procDoDoc(d, p)); b.end(); await offer(blob, nomeArquivo(d, '.docx')); aposExportar(d, p); }catch(e){ b.end(); console.error(e); toast('Não foi possível gerar o Word.'); } }
/* CI avulsa criada de dentro de um processo: depois de exportar, volta para o processo */
function aposExportar(d, p){
  const q = procDoDoc(d, p);
  if(q && q.avdoc && VIEW === 'mesa' && M.p === q && M.voltar && procPorId(M.voltar)) setTimeout(() => { if(!SHEETS.length) sairMesa(); }, 400);
}

/* ---------- compartilhar / gerar o processo ---------- */
function compartilharSheet(){
  if(!precisaLibs()) return;
  salvarTudo();
  const p = M.p, d = M.cur && M.cur.d, linha = p.docs.filter(x => x.linha);
  const num = h('input', { type:'checkbox', checked:settings.numerar });
  const ini = h('input', { class:'inp', inputmode:'numeric', value:String(p.fls0 || settings.inicial || 1), style:{ width:'90px' } });
  const dei = h('select', { class:'sel' }, [['esq', 'Vira para a esquerda (padrão)'], ['dir', 'Vira para a direita']].map(o => h('option', { value:o[0], selected:settings.deitada === o[0] }, o[1])));
  const ver = h('input', { type:'checkbox' });
  const opt = () => { settings.numerar = num.checked; settings.deitada = dei.value; saveSettings(); return { carimbo:'nenhum', numerar:num.checked, inicial:parseInt(ini.value, 10) || 1, deitada:dei.value, titulo:tituloProc(p) }; };
  const nomeProc = safeName((p.avulsa ? 'Documentos' : tituloProc(p)) + (p.ficha.objeto && !p.avulsa ? ' – ' + p.ficha.objeto.slice(0, 50) : ''), '.pdf');
  const juntar = async lista => {
    if(!lista.length) return toast('Nada para juntar.');
    const o = opt(), b = busy('Juntando…');
    try{
      const faltam = [];
      const items = await itensDe(lista, faltam);
      const r = await PDFGen.merge(items, o, t => b.txt(t));
      b.end();
      const fora = faltam.concat(r.falhas);
      if(fora.length) toast('Atenção: não entraram ' + fora.join(', ') + '. A numeração do PDF não bate com a mesa.', { ms:8000 });
      if(ver.checked) previa(r.bytes, nomeProc); else offer(r.bytes, nomeProc);
    }catch(e){ b.end(); console.error(e); toast('Não foi possível juntar: ' + (e.message || e)); }
  };
  const corpo = [h('label', { class:'opt' }, ver, h('span', null, 'Ver a prévia antes de compartilhar'))];
  if(d) corpo.push(h('span', { class:'lbl' }, 'Este documento · ' + d.nome), h('div', { class:'mgrid' },
    h('button', { class:'mopt', onclick:() => { s.fechar(); ver.checked ? previaDoc(d) : baixarDoc(d); } }, h('b', null, 'PDF'), h('span', null, d.kind === 'texto' ? 'Com brasão e o padrão do texto pronto' : 'Com os giros, retiradas e brasões que você fez')),
    d.kind === 'texto' ? h('button', { class:'mopt', onclick:() => { s.fechar(); baixarWord(d); } }, h('b', null, 'Word'), h('span', null, 'Arquivo .docx editável')) : null,
    d.kind === 'texto' ? h('button', { class:'mopt', onclick:() => { s.fechar(); copiarTexto(textoPuro(bodyDoDoc(d)), 'Texto puro copiado. Cole no blog ou no Gmail.'); } }, h('b', null, 'Texto puro'), h('span', null, 'Copia sem formatação, para blog e Gmail')) : null));
  corpo.push(h('span', { class:'lbl' }, 'Processo inteiro · ' + plural(linha.length, 'documento', 'documentos')));
  corpo.push(h('div', { class:'fgrp' }, h('label', { class:'fld' }, h('span', null, 'Folha inicial'), ini),
    h('label', { class:'opt w2', style:{ gridColumn:'1/-1' } }, num, h('span', null, 'Numerar as folhas')), h('label', { class:'fld w2', style:{ gridColumn:'1/-1' } }, h('span', null, 'Planilha deitada na impressão (só o número gira)'), dei)));
  corpo.push(h('div', { class:'mgrid' },
    h('button', { class:'mopt', onclick:() => { s.fechar(); juntar(linha); } }, h('b', null, 'Juntar em um PDF'), h('span', null, 'Toda a linha do processo, na ordem')),
    h('button', { class:'mopt', onclick:() => { s.fechar(); escolherParaUnir(p, juntar); } }, h('b', null, 'Unir documentos'), h('span', null, 'Escolher quais entram')),
    h('button', { class:'mopt', onclick:async () => { s.fechar(); const o = opt(), b = busy('Preparando…'); try{ const faltam = []; const blob = await PDFGen.separate(await itensDe(linha, faltam), o, t => b.txt(t)); if(faltam.length) toast('Não entraram: ' + faltam.join(', '), { ms:7000 }); b.end(); offer(blob, safeName(tituloProc(p) + ' – separados', '.zip')); }catch(e){ b.end(); toast('Não foi possível gerar.'); } } }, h('b', null, 'PDFs separados'), h('span', null, 'Um arquivo por documento, num ZIP, com numeração seguida')),
    !p.avulsa ? h('button', { class:'mopt', onclick:() => { s.fechar(); compartilharRepo(p); } }, h('b', null, 'Pasta do repositório'), h('span', null, 'ZIP com os documentos do repositório')) : null));
  const s = sheet({ titulo:'Compartilhar', cheio:true, corpo });
}
function escolherParaUnir(p, juntar){
  const docs = p.docs.filter(d => d.linha || d.repo);
  const cks = docs.map(d => h('input', { type:'checkbox', checked:d.linha }));
  sheet({ titulo:'Unir documentos', cheio:true, corpo:docs.map((d, i) => h('label', { class:'zitem' }, cks[i], h('span', { class:'grow' }, d.nome, h('small', { class:'muted', style:{ display:'block', fontSize:'12px' } }, (d.kind === 'pdf' ? 'PDF' : 'Texto') + (d.linha ? '' : ' · só no repositório'))))),
    botoes:[{ t:'Cancelar', v:'ghost' }, { t:'Juntar marcados', v:'pri', fn:() => juntar(docs.filter((_, i) => cks[i].checked)) }] });
}
async function itensDe(docs, faltam){
  const out = [];
  for(const d of docs){
    if(d.kind === 'texto') out.push({ kind:'texto', html:htmlDoc(d), bras:d.bras, doc:d, proc:M.p, name:nomeArquivo(d, '') });
    else {
      const bytes = await bytesDe(d.fileId);
      if(bytes && vivas(d).length) out.push({ kind:'file', name:d.nome, f:{ bytes, pl:d.pl, name:d.nome } });
      else if(faltam) faltam.push(d.nome + (bytes ? ' (sem páginas)' : ' (arquivo não encontrado)'));
    }
  }
  return out;
}
async function compartilharRepo(p){
  if(!precisaLibs()) return;
  const repo = p.docs.filter(d => d.repo);
  if(!repo.length) return toast('O repositório está vazio.');
  const b = busy('Montando a pasta…');
  try{
    const zip = new JSZip(), pasta = safeName(tituloProc(p) + (p.ficha.objeto ? ' – ' + p.ficha.objeto.slice(0, 40) : ''), '');
    let i = 1; const falhas = [];
    for(const d of repo){ b.txt('Preparando ' + d.nome + '…'); try{ const bytes = await bytesDoc(d); zip.file(pasta + '/' + String(i++).padStart(2, '0') + ' ' + safeName(d.nome, '.pdf'), bytes); }catch(e){ falhas.push(d.nome); } }
    if(i === 1){ b.end(); return toast('Nenhum documento do repositório pôde ser gerado.'); }
    const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{ level:6 } });
    b.end(); if(falhas.length) toast('Não entraram: ' + falhas.join(', '), { ms:7000 }); offer(blob, safeName(pasta, '.zip'));
  }catch(e){ b.end(); toast('Não foi possível montar a pasta.'); }
}

/* ---------- notas, pendências e definições ---------- */
const TIPO_NOTA = { pend:'Pendência', def:'Definição', nota:'Nota' };
M.tipoNota = 'pend';
function painelNotas(corpo){
  const p = M.p;
  const ta = h('textarea', { placeholder:'Anote uma pendência, uma definição de reunião ou um lembrete… (dá para ditar pelo microfone do teclado)', rows:'3' });
  const resp = h('input', { class:'inp', placeholder:'Responsável', list:'dlResp', style:{ minHeight:'38px', padding:'6px 10px' } });
  const prazo = h('input', { class:'inp', type:'date', style:{ minHeight:'38px', padding:'6px 10px' } });
  const liga = h('input', { type:'checkbox', checked:true });
  const nomes = Array.from(new Set(DB.procs.flatMap(q => q.notas.map(n => n.resp)).filter(Boolean).concat(SETORES, settings.signatarios.map(s => s.nome))));
  const tipos = h('div', { class:'seg' }, Object.keys(TIPO_NOTA).map(k => h('button', { class:M.tipoNota === k ? 'on' : '', style:{ minHeight:'30px', fontSize:'13px' }, onclick:() => { M.tipoNota = k; renderDir(); } }, TIPO_NOTA[k])));
  const c = M.cur;
  const add = () => {
    const t = ta.value.trim(); if(!t) return ta.focus();
    p.notas.push({ id:uid(), tipo:M.tipoNota, t, resp:resp.value.trim(), prazo:prazo.value, ok:false, criado:Date.now(), doc:liga.checked && c ? c.d.id : '', fl:liga.checked && c ? c.fl : '' });
    touch(p); saveDB(true); renderDir(); toast(TIPO_NOTA[M.tipoNota] + ' anotada.');
  };
  corpo.append(h('div', { class:'nadd' }, tipos, ta, M.tipoNota !== 'nota' ? h('div', { class:'row', style:{ flexWrap:'nowrap' } }, resp, prazo) : null,
    h('datalist', { id:'dlResp' }, nomes.map(n => h('option', { value:n }))),
    h('div', { class:'row' }, c ? h('label', { class:'row grow', style:{ gap:'6px', fontSize:'12.5px', color:'var(--muted)' } }, liga, 'Ligar à folha ' + c.fl + ' · ' + c.d.nome.slice(0, 28)) : h('span', { class:'grow' }), h('button', { class:'btn acc sm', onclick:add }, 'Anotar'))));
  const grupos = [['pend', 'Pendências', n => n.tipo === 'pend' && !n.ok], ['def', 'Definições', n => n.tipo === 'def'], ['nota', 'Notas', n => n.tipo === 'nota'], ['ok', 'Pendências resolvidas', n => n.tipo === 'pend' && n.ok]];
  let algum = false;
  for(const [k, t, f] of grupos){
    const ns = p.notas.filter(f); if(!ns.length) continue; algum = true;
    const lista = h('div', null, ns.map(n => itemNota(p, n)));
    if(k === 'ok') corpo.append(h('details', null, h('summary', { class:'lbl', style:{ cursor:'pointer' } }, t + ' (' + ns.length + ')'), lista));
    else corpo.append(h('span', { class:'lbl' }, t + ' (' + ns.length + ')'), lista);
  }
  if(!algum) corpo.append(h('div', { class:'empty', style:{ padding:'16px' } }, 'Nada anotado ainda. O que você anotar aqui entra no relatório do processo.'));
  corpo.append(h('button', { class:'btn sm soft', onclick:() => { fecharPainel(); abrirRel(p); } }, h('span', { html:I.report }), 'Ver no relatório'));
}
function itemNota(p, n){
  const venc = n.prazo && !n.ok && n.prazo < hojeISO();
  const d = n.doc ? p.docs.find(x => x.id === n.doc) : null;
  const meta = [];
  if(n.resp) meta.push(h('span', null, n.resp));
  if(n.prazo) meta.push(h('span', { style:venc ? { color:'var(--danger)', fontWeight:'600' } : null }, (venc ? 'venceu ' : 'até ') + dataBR(n.prazo)));
  if(d || n.fl) meta.push(h('a', { href:'#', onclick:e => { e.preventDefault(); if(VIEW === 'mesa' && M.p === p){ fecharPainel(); if(n.fl && irParaFolha(+n.fl)) return; if(d) irParaDoc(d.id); } else abrirMesa(p, { doc:d && d.id }); } }, (n.fl ? 'fls. ' + n.fl : '') + (d ? ' · ' + d.nome.slice(0, 26) : '')));
  meta.push(h('span', null, dataCurta(n.criado)));
  const ck = n.tipo === 'pend' ? h('input', { type:'checkbox', checked:n.ok, 'aria-label':'Resolvida', onchange:e => { n.ok = e.target.checked; n.feito = n.ok ? Date.now() : null; touch(p); saveDB(); if(VIEW === 'mesa') renderDir(); else renderRel(); } }) : h('span', { class:'tipo ' + n.tipo });
  return h('div', { class:'nitem' + (n.ok ? ' ok' : '') }, ck, h('div', { class:'nt', onclick:() => editarNota(p, n) }, h('span', null, n.t), h('small', null, meta)));
}
function editarNota(p, n){
  const ta = h('textarea', { class:'txa' }, n.t);
  const tipo = h('select', { class:'sel' }, Object.keys(TIPO_NOTA).map(k => h('option', { value:k, selected:n.tipo === k }, TIPO_NOTA[k])));
  const resp = h('input', { class:'inp', value:n.resp || '' }), prazo = h('input', { class:'inp', type:'date', value:n.prazo || '' });
  const rer = () => { if(VIEW === 'mesa' && M.painel === 'dir') renderDir(); if(VIEW === 'rel') renderRel(); };
  sheet({ titulo:TIPO_NOTA[n.tipo], corpo:[ta, h('div', { class:'fgrp' }, h('label', { class:'fld' }, h('span', null, 'Tipo'), tipo), h('label', { class:'fld' }, h('span', null, 'Prazo'), prazo), h('label', { class:'fld w2' }, h('span', null, 'Responsável'), resp))],
    botoes:[{ t:'Apagar', v:'danger', fn:() => { p.notas = p.notas.filter(x => x !== n); saveDB(); rer(); } }, { t:'Salvar', v:'pri', fn:() => { n.t = ta.value.trim() || n.t; n.tipo = tipo.value; n.resp = resp.value.trim(); n.prazo = prazo.value; touch(p); saveDB(); rer(); } }] });
}

/* ---------- ficha resumida ---------- */
function painelFicha(corpo){
  const p = M.p;
  if(p.avulsa){ corpo.append(h('div', { class:'empty' }, 'A mesa avulsa não tem ficha. Mova os documentos para um processo para usar a ficha.')); return; }
  const kv = h('dl', { class:'kv' });
  FICHA.forEach(([k, rot]) => { const v = k === 'objeto' ? '' : fichaValor(p, k); if(v) kv.append(h('dt', null, rot), h('dd', null, v)); });
  (p.ficha.extras || []).forEach(e => { if(e.v) kv.append(h('dt', null, e.k), h('dd', null, e.v)); });
  const t = tramAtual(p);
  corpo.append(h('div', { class:'pcard' }, h('b', null, tituloProc(p)), h('div', { class:'o' }, objetoProc(p)), h('div', { class:'row', style:{ marginTop:'4px' } }, chipStatus(p.status))));
  corpo.append(h('span', { class:'lbl' }, 'Onde está'));
  corpo.append(t ? h('div', { class:'rbox' }, h('b', null, t.setor), h('div', { class:'muted', style:{ fontSize:'13px' } }, (t.acao ? t.acao + ' · ' : '') + 'chegou em ' + dataBR(t.chegada) + (t.saida ? ' · saiu em ' + dataBR(t.saida) : ''))) : h('p', { class:'muted', style:{ margin:0 } }, 'Sem tramitação registrada.'));
  corpo.append(h('button', { class:'btn sm', onclick:() => tramSheet(p) }, h('span', { html:I.route }), 'Registrar tramitação'));
  corpo.append(h('span', { class:'lbl' }, 'Ficha central'));
  corpo.append(kv.children.length ? h('div', { class:'rbox' }, kv) : h('p', { class:'muted', style:{ margin:0 } }, 'Ficha ainda vazia.'));
  corpo.append(h('div', { class:'row' }, h('button', { class:'btn sm pri grow', onclick:() => fichaSheet(p) }, h('span', { html:I.pen }), 'Editar ficha'), h('button', { class:'btn sm grow', onclick:() => { fecharPainel(); abrirRel(p); } }, h('span', { html:I.report }), 'Relatório')));
}

/* =====================================================================
   Tabela: criar, preencher e importar
   ===================================================================== */
const TAB = { dados:[['', '', ''], ['', '', ''], ['', '', '']], r:3, c:3, hdr:true, range:null };
function abrirTabela(){
  const s0 = curSel();
  TAB.range = s0 ? s0.getRangeAt(0).cloneRange() : null;
  const st = h('div', { class:'muted', style:{ fontSize:'13px', minHeight:'16px' } }, TAB.range ? '' : 'Dica: toque no texto onde a tabela vai entrar antes de abrir. Sem isso ela entra no fim do documento na tela.');
  const grid = h('div', { class:'tgrid' });
  const rv = h('b'), cv = h('b');
  const hdr = h('input', { type:'checkbox', checked:TAB.hdr });
  const fit = () => { while(TAB.dados.length < TAB.r) TAB.dados.push([]); TAB.dados.forEach(r => { while(r.length < TAB.c) r.push(''); }); };
  const desenhar = () => {
    fit(); rv.textContent = TAB.r; cv.textContent = TAB.c; TAB.hdr = hdr.checked;
    const t = h('table');
    for(let i = 0; i < TAB.r; i++){
      const tr = h('tr', { class:TAB.hdr && i === 0 ? 'h' : '' });
      for(let j = 0; j < TAB.c; j++){ const inp = h('input', { value:TAB.dados[i][j] || '', placeholder:TAB.hdr && i === 0 ? 'Título ' + (j + 1) : '', 'aria-label':'Linha ' + (i + 1) + ', coluna ' + (j + 1) }); inp.oninput = () => { TAB.dados[i][j] = inp.value; }; tr.append(h('td', null, inp)); }
      t.append(tr);
    }
    grid.replaceChildren(t);
  };
  hdr.onchange = desenhar;
  const stp = (rot, el, f) => h('span', { class:'stp' }, rot, h('button', { class:'ib sm round', onclick:() => { f(-1); desenhar(); } }, '−'), el, h('button', { class:'ib sm round', onclick:() => { f(1); desenhar(); } }, '+'));
  const colar = h('textarea', { class:'txa', style:{ minHeight:'54px' }, placeholder:'Segure aqui e toque em Colar (Excel, Planilhas, Word, PDF ou texto)' });
  const carregar = (rows, de) => {
    if(!rows || !rows.length){ st.textContent = 'Não encontrei uma tabela no que foi colado.'; return; }
    let mc = 0; rows.forEach(r => mc = Math.max(mc, r.length));
    TAB.dados = rows.map(r => r.slice()); TAB.r = clamp(rows.length, 1, 60); TAB.c = clamp(mc, 1, 12); desenhar();
    st.textContent = 'Tabela importada ' + de + ': ' + TAB.r + ' linhas × ' + TAB.c + ' colunas. Confira e toque em Inserir.';
  };
  colar.addEventListener('paste', ev => { const cd = ev.clipboardData; if(!cd) return; ev.preventDefault(); const html = cd.getData('text/html'); let rows = html ? lerTabelaHTML(html) : null; if(!rows) rows = lerTabelaTexto(cd.getData('text/plain') || ''); carregar(rows, 'do que você colou'); colar.value = ''; });
  const doClip = () => {
    const falha = () => { st.textContent = PWA ? 'O celular não liberou o que você copiou. Segure no campo acima e toque em Colar.' : 'Aqui no Claude o app não pode ler o que você copiou. Segure no campo acima e toque em Colar. No app instalado este botão puxa direto.'; };
    try{
      if(navigator.clipboard && navigator.clipboard.read) navigator.clipboard.read().then(async items => { const it = items[0]; if(it && it.types.includes('text/html')){ carregar(lerTabelaHTML(await (await it.getType('text/html')).text()), 'da área de transferência'); return; } carregar(lerTabelaTexto(await navigator.clipboard.readText()), 'da área de transferência'); }).catch(falha);
      else falha();
    }catch(e){ falha(); }
  };
  desenhar();
  sheet({ titulo:'Tabela', cheio:true, corpo:[
    h('div', { class:'row' }, stp('Linhas', rv, d => TAB.r = clamp(TAB.r + d, 1, 60)), stp('Colunas', cv, d => TAB.c = clamp(TAB.c + d, 1, 12))),
    h('label', { class:'opt' }, hdr, h('span', null, '1ª linha é o cabeçalho')), grid,
    h('span', { class:'lbl' }, 'Importar tabela copiada'), colar,
    h('div', { class:'row' }, h('button', { class:'btn sm', onclick:doClip }, h('span', { html:I.paste }), 'Importar do que copiei'), h('button', { class:'btn sm ghost', onclick:() => { TAB.dados = []; desenhar(); } }, 'Limpar')), st],
    botoes:[{ t:'Cancelar', v:'ghost' }, { t:'Inserir no texto', v:'pri', fn:inserirTabela }] });
}
function lerTabelaHTML(html){ const d = new DOMParser().parseFromString(html, 'text/html'), t = d.querySelector('table'); if(!t) return null; const rows = []; t.querySelectorAll('tr').forEach(tr => { const r = []; tr.querySelectorAll('th,td').forEach(c => r.push(c.textContent.replace(/\s+/g, ' ').trim())); if(r.length) rows.push(r); }); return rows.length ? rows : null; }
function lerTabelaTexto(t){
  let ls = String(t || '').replace(/\r/g, '').split('\n').filter(l => l.trim()); if(!ls.length) return null;
  if(ls.every(l => l.trim().charAt(0) === '|')){ ls = ls.filter(l => !/^\s*\|?\s*:?-{2,}/.test(l)); return ls.map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())); }
  const sep = ls[0].includes('\t') ? '\t' : ls[0].includes(';') ? ';' : null;
  if(!sep) return ls.map(l => l.trim().split(/\s{2,}/));
  return ls.map(l => l.split(sep).map(c => c.trim()));
}
function inserirTabela(){
  const num = v => /\d/.test(v) && /^[-+R$\s\d.,%()]+$/.test(v);
  let html = '<table class="tbl"><tbody>';
  for(let i = 0; i < TAB.r; i++){
    html += '<tr>';
    for(let j = 0; j < TAB.c; j++){ const v = (TAB.dados[i] && TAB.dados[i][j]) || '', th = TAB.hdr && i === 0; html += '<' + (th ? 'th' : 'td') + (!th && num(v) ? ' class="n"' : '') + '>' + (v ? esc(v) : '<br>') + '</' + (th ? 'th' : 'td') + '>'; }
    html += '</tr>';
  }
  html += '</tbody></table>';
  let body = null, blk = null;
  if(TAB.range){ const n = TAB.range.startContainer, el = n.nodeType === 1 ? n : n.parentElement; body = el && el.closest('.body'); blk = el && el.closest('.body > *'); }
  if(!body){ body = bodyDoDoc(M.cur && M.cur.d) || pagesEl.querySelector('.body'); if(!body){ toast('Não há texto aberto para receber a tabela.'); return false; } blk = body.lastElementChild; }
  if(blk && blk.parentElement === body){ blk.insertAdjacentHTML('afterend', html + '<p><br></p>'); }
  else body.insertAdjacentHTML('beforeend', html + '<p><br></p>');
  body.dispatchEvent(new Event('input'));
  toast('Tabela inserida.');
}

/* =====================================================================
   Revisão de português com IA
   ===================================================================== */
const MARCA_MUD = '---MUDANÇAS---';
function abrirRevisao(){
  pararRolagem();
  const s0 = curSel(); let range = null, texto = '';
  if(s0 && !s0.isCollapsed){ range = s0.getRangeAt(0).cloneRange(); texto = s0.toString(); }
  else {
    /* sem seleção: revisa o texto inteiro, parágrafo por parágrafo */
    const b = curBody(), d = b ? docById(b.parentElement.dataset.doc) : (M.cur && M.cur.d);
    if(d && d.kind === 'texto') return revisarTudo(d);
    return toast('Vá até um texto para revisar.');
  }
  if(!range || !texto.trim()) return toast('Selecione um trecho antes de revisar.');
  const body = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement).closest('.body');
  /* seleção com vários parágrafos: revisa e devolve parágrafo por parágrafo, sem perder títulos e tabelas */
  const blocos = body ? Array.from(body.querySelectorAll('p,h1,h2,h3,li,td,th')).filter(b => !b.querySelector('p,li,td,th') && b.textContent.trim() && range.intersectsNode(b)) : [];
  const multi = blocos.length > 1;
  if(multi) texto = blocos.map(b => b.innerText.replace(/\s*\n\s*/g, ' ').trim()).join('\n\n');
  const orig = texto.trim();
  const out = h('div', { id:'rvOut', contenteditable:'true', spellcheck:'true' }, orig);
  const st = h('div', { class:'muted', style:{ fontSize:'13px', minHeight:'18px' } });
  const mud = h('details', { hidden:true }, h('summary', { style:{ cursor:'pointer', fontWeight:'600' } }, 'O que mudou'), h('ul', { style:{ margin:'6px 0 0', paddingLeft:'18px' } }));
  const msgs = h('div', { style:{ display:'flex', flexDirection:'column', gap:'8px' } });
  const pedido = h('textarea', { class:'txa', style:{ minHeight:'48px' }, placeholder:'Peça um ajuste: deixe mais curto, acrescente a base legal…' });
  const conversa = h('div', { hidden:true, style:{ display:'flex', flexDirection:'column', gap:'8px' } }, msgs, h('div', { class:'row', style:{ flexWrap:'nowrap', alignItems:'flex-end' } }, pedido, h('button', { class:'btn acc', onclick:enviar }, 'Enviar')));
  let ctl = null, turns = [];
  const split = t => { const i = t.indexOf(MARCA_MUD); return i < 0 ? { txt:t, mud:'' } : { txt:t.slice(0, i), mud:t.slice(i + MARCA_MUD.length) }; };
  const contexto = () => 'Estou desenvolvendo um trecho de documento oficial da Prefeitura de Ilhéus.\n\nOriginal:\n' + orig.slice(0, 2500) + '\n\nVersão revisada:\n' + out.innerText.slice(0, 2500) + '\n\nQuero continuar desenvolvendo este texto.';
  const levar = (url, qParam) => h('a', { class:'btn sm', href:url, target:'_blank', rel:'noopener', onclick:function(){ if(qParam) this.href = url + '?q=' + encodeURIComponent(contexto()); copiarTexto(out.innerText, 'Texto copiado. Se preferir uma conversa que você já tem, é só colar lá.'); } }, url.includes('gemini') ? 'Levar ao Gemini ↗' : 'Levar ao Claude ↗');
  const s = sheet({ titulo:'Revisão de português', cheio:true, aoFechar:() => { if(ctl) ctl.abort(); }, corpo:[st, out, mud,
    h('div', { class:'row' }, h('button', { class:'btn sm', onclick:() => copiarTexto(out.innerText, 'Texto copiado.') }, h('span', { html:I.copy }), 'Copiar'), h('button', { class:'btn sm', onclick:() => { out.focus(); selecionarNo(out); } }, 'Selecionar tudo'),
      h('button', { class:'btn sm', onclick:() => { conversa.hidden = !conversa.hidden; if(!conversa.hidden) pedido.focus(); } }, h('span', { html:I.sparkle }), 'Desenvolver aqui')),
    h('div', { class:'row' }, levar('https://claude.ai/new', true), levar('https://gemini.google.com/app', false)), conversa],
    botoes:[{ t:'Parar', v:'ghost', fica:true, fn:() => { if(ctl) ctl.abort(); } }, { t:'Substituir no documento', v:'pri', fn:() => {
      const t = out.innerText.replace(/\n+$/, '');
      if(multi){
        const novos = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
        if(novos.length === blocos.length){ blocos.forEach((b, i) => { if(b.innerText.replace(/\s*\n\s*/g, ' ').trim() !== novos[i]) b.textContent = novos[i]; }); }
        else {
          const r2 = document.createRange(); r2.setStartBefore(blocos[0].closest('.body > *') || blocos[0]); r2.setEndAfter(blocos[blocos.length - 1].closest('.body > *') || blocos[blocos.length - 1]);
          r2.deleteContents(); const frag = document.createDocumentFragment(); novos.forEach(x => frag.append(h('p', null, x))); r2.insertNode(frag);
          toast('A revisão mudou a quantidade de parágrafos; o trecho entrou como parágrafos simples.', { ms:6000 });
        }
        body.dispatchEvent(new Event('input')); toast('Trecho revisado substituído.'); return;
      }
      if(body) body.focus();
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      let ok = false; try{ ok = document.execCommand('insertText', false, t); }catch(e){}
      if(!ok){ range.deleteContents(); range.insertNode(document.createTextNode(t)); }
      if(body) body.dispatchEvent(new Event('input'));
      toast('Trecho substituído.');
    } }] });
  (async () => {
    st.textContent = 'Revisando…';
    ctl = new AbortController();
    try{
      const r = await iaPedir([{ role:'user', content:(settings.ia.prompt || REV_PROMPT) + '\n\nTEXTO:\n' + orig }], { signal:ctl.signal, onText:t => { st.textContent = 'Escrevendo…'; out.textContent = split(t).txt.trim() || orig; } });
      const pt = split(r); out.textContent = pt.txt.trim() || orig;
      const itens = pt.mud.split('\n').map(l => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
      const ul = mud.querySelector('ul'); ul.replaceChildren(...itens.map(t => h('li', null, t))); mud.hidden = !itens.length;
      st.textContent = 'Pronto. Dá para editar aqui dentro antes de usar.';
    }catch(e){ st.textContent = iaErro(e); if(e && e.text) out.textContent = split(e.text).txt.trim() || orig; }
  })();
  async function enviar(){
    const q = pedido.value.trim(); if(!q) return; pedido.value = '';
    turns.push({ role:'user', content:q }); msgs.append(h('div', { class:'msg u' }, q));
    const bolha = h('div', { class:'msg a' }, 'Pensando…'); msgs.append(bolha);
    ctl = new AbortController();
    const regras = 'Você está me ajudando a desenvolver um trecho de documento oficial (nota técnica, despacho, CI, ofício) da Secretaria de Infraestrutura e Defesa Civil de Ilhéus. Português do Brasil, formal e impessoal. Nunca use a palavra "tratativa(s)". Quando eu pedir uma nova versão, responda só com o texto da nova versão, sem comentários.\n\nTexto original:\n' + orig.slice(0, 6000) + '\n\nVersão atual:\n' + out.innerText.slice(0, 6000);
    try{
      const r = await iaPedir([{ role:'user', content:regras }].concat(turns.slice(-12)), { forte:true, cache:false, signal:ctl.signal, onText:t => { bolha.textContent = t; } });
      turns.push({ role:'assistant', content:r }); bolha.textContent = r;
      bolha.append(h('div', null, h('button', { class:'btn sm soft', style:{ marginTop:'6px' }, onclick:() => { out.textContent = r.trim(); st.textContent = 'Caixa atualizada com esta versão.'; } }, 'Usar esta versão')));
    }catch(e){ turns.pop(); bolha.textContent = iaErro(e); }
  }
}

/* =====================================================================
   Editor dos botões da mesa (códigos, posição, função)
   ===================================================================== */
const ACOES = [['', 'Nenhuma (só desenho)'], ['home', 'Voltar ao início'], ['selfolhas', 'Selecionar folhas (PDF, imprimir, compartilhar)'], ['signatario', 'Signatário do documento'], ['revisar', 'Revisar texto com IA'], ['palavra', 'Selecionar palavra'], ['paragrafo', 'Selecionar parágrafo'], ['tudo', 'Selecionar texto inteiro'],
  ['copiar', 'Copiar'], ['colar', 'Colar'], ['selecionar', 'Modo selecionar (liga/desliga)'], ['esq', '◀ Palavra anterior (ou seleção)'], ['dir', '▶ Próxima palavra (ou seleção)'], ['marca', 'Marca-texto'],
  ['tabela', 'Criar ou importar tabela'], ['formatar', 'Formatar texto (Aa)'], ['cima', '▲ Parágrafo anterior (ou seleção)'], ['baixo', '▼ Próximo parágrafo (ou seleção)'], ['proxima', 'Próxima folha'], ['anterior', 'Folha anterior'], ['zoomMais', 'Aumentar zoom (lupa +)'], ['zoomMenos', 'Diminuir zoom (lupa −)'], ['rolar', 'Rolar sozinho (tipo PJe)'], ['zoom88', 'Voltar ao zoom padrão'],
  ['notas', 'Notas e pendências'], ['compartilhar', 'Compartilhar e gerar PDF'], ['novodoc', 'Novo documento'], ['incluirpdf', 'Incluir PDF'], ['ficha', 'Ficha central'], ['relatorio', 'Relatório do processo'],
  ['buscar', 'Buscar no processo'], ['teclado', 'Abrir o teclado para digitar'], ['abaEsq', 'Abrir aba esquerda'], ['abaDir', 'Abrir aba direita']];
const acaoNome = k => (ACOES.find(a => a[0] === k) || [, ''])[1];
const ED = { sel:null, drag:null, undo:[], pos:'t' };
function salvarLay(){ settings.lay = M.lay; saveSettings(); }
function abrirEditor(){ if(M.deitado) return toast('Para editar os botões, volte o celular para a vertical.'); M.editing = true; ED.sel = null; screenEl.classList.add('editing'); renderLay(); renderTools(); }
function fecharEditor(){ M.editing = false; ED.sel = null; screenEl.classList.remove('editing'); $('tools').hidden = true; salvarLay(); renderLay(); }
function edPush(){ ED.undo.push(JSON.stringify(M.lay)); if(ED.undo.length > 60) ED.undo.shift(); }
function editorPointerDown(ev, n){
  if(ev.target.closest('.abaBtn') || ev.target.closest('.panel')) return;
  if(!n){ if(ED.sel){ ED.sel = null; renderLay(); renderTools(); } return; }
  ev.preventDefault();
  const e = lay().els.find(x => x.id === n.dataset.id); if(!e) return;
  if(ED.sel !== e.id){ ED.sel = e.id; renderLay(); renderTools(); }
  const node = $('L-tela').querySelector('[data-id="' + e.id + '"]');
  ED.drag = { id:e.id, knob:!!ev.target.closest('.knob'), sx:ev.clientX, sy:ev.clientY, o:clone(e), W:screenEl.clientWidth, H:screenEl.clientHeight, node, antes:JSON.stringify(M.lay), mov:false, pid:ev.pointerId };
  try{ screenEl.setPointerCapture(ev.pointerId); }catch(err){}
}
function editorPointerMove(ev){
  const g = ED.drag; if(!g || ev.pointerId !== g.pid) return;
  const dx = ev.clientX - g.sx, dy = ev.clientY - g.sy;
  if(!g.mov && Math.abs(dx) + Math.abs(dy) < 4) return;
  g.mov = true;
  const e = lay().els.find(x => x.id === g.id), o = g.o;
  if(!g.knob){
    e.x = Math.round(clamp(o.x + dx / faixaBotoes(g.W) * 1000, 0, 1000)) / 10;
    const yAbs = clamp(layY(o, g.H) + dy, 0, g.H);
    if(yAbs > g.H / 2){ e.ay = 'bottom'; e.dy = Math.round(g.H - yAbs); } else { e.ay = 'top'; e.dy = Math.round(yAbs); }
  } else if(e.type === 'icone') e.size = clamp(Math.round(o.size + (dx + dy)), 16, 140);
  else { e.w = Math.round(clamp(o.w + dx * 2 / faixaBotoes(g.W) * 100, 3, 100) * 10) / 10; e.h = clamp(Math.round(o.h + dy * 2), 2, 400); }
  aplicarEl(g.node, e);
}
function editorPointerUp(ev){ const g = ED.drag; if(!g || (ev && ev.pointerId !== g.pid)) return; if(g.mov){ ED.undo.push(g.antes); renderTools(); } ED.drag = null; }
function proxCodigo(y){ const H = screenEl.clientHeight, p = y < H * .15 ? 'T' : y > H * .8 ? 'R' : 'F'; let mx = 0; lay().els.forEach(e => { const m = /^([A-Z]+)(\d+)$/.exec(e.code || ''); if(m && m[1] === p) mx = Math.max(mx, +m[2]); }); return p + (mx + 1); }
function renderTools(){
  const t = $('tools'), L = lay();
  t.hidden = !M.editing; t.className = ED.pos;
  if(!M.editing) return;
  const e = ED.sel ? L.els.find(x => x.id === ED.sel) : null;
  const B = (rot, fn, on, cls) => h('button', { class:'btn sm ' + (on ? 'pri' : cls || ''), onclick:fn }, rot);
  const rng = (rot, k, min, max, un) => { const i = h('input', { type:'range', min, max, value:L[k] }), v = h('em', null, L[k] + un); let p0 = false; i.oninput = () => { if(!p0){ edPush(); p0 = true; } L[k] = +i.value; v.textContent = i.value + un; aplicarBarras(); renderLay(); }; i.onchange = () => { p0 = false; }; return h('label', { class:'rg' }, h('span', null, rot), i, v); };
  const corpo = h('div', { class:'bd' });
  if(e){
    const tipo = e.type === 'icone' ? 'Botão' : e.type === 'titulo' ? 'Título' : e.type === 'traco' ? 'Tracinho' : 'Texto';
    const code = h('input', { class:'inp', style:{ width:'70px', minHeight:'36px', fontWeight:'700', textTransform:'uppercase' }, value:e.code });
    code.oninput = () => { e.code = code.value.toUpperCase(); renderLay(); };
    const linha = [h('span', { class:'lbl', style:{ width:'100%' } }, 'Selecionado · ' + tipo), code];
    if(e.type === 'icone'){
      const rot = h('input', { class:'inp grow', style:{ minHeight:'36px' }, value:e.rot || '', placeholder:'Letra ou nome curto' }); rot.oninput = () => { e.rot = rot.value; renderLay(); };
      const acs = h('select', { class:'sel', style:{ minHeight:'38px' } }, ACOES.map(a => h('option', { value:a[0], selected:e.acao === a[0] }, a[1]))); acs.onchange = () => { edPush(); e.acao = acs.value; renderLay(); };
      const nota = h('input', { class:'inp', style:{ minHeight:'36px' }, value:e.nota || '', placeholder:'Anotação livre (como abre, como fecha…)' }); nota.oninput = () => { e.nota = nota.value; };
      linha.push(rot);
      const ICP = { home:'home', notas:'note', compartilhar:'share', buscar:'search', incluirpdf:'clip', novodoc:'docplus', ficha:'pen', relatorio:'report', revisar:'sparkle', copiar:'copy', colar:'paste' };
      corpo.append(h('div', { class:'row' }, linha), acs, nota,
        h('div', { class:'row' }, B('Bolinha', () => { edPush(); e.shape = 'bola'; L.iconMode = 'misto'; renderLay(); renderTools(); }, e.shape === 'bola'), B('Quadradinho', () => { edPush(); e.shape = 'quad'; L.iconMode = 'misto'; renderLay(); renderTools(); }, e.shape === 'quad'),
          ['branco', 'preto', 'vidro'].map(c => B(c[0].toUpperCase() + c.slice(1), () => { edPush(); e.cor = c; renderLay(); renderTools(); }, e.cor === c)),
          B('Menor', () => { edPush(); e.size = clamp(e.size - 4, 16, 140); renderLay(); }), B('Maior', () => { edPush(); e.size = clamp(e.size + 4, 16, 140); renderLay(); }),
          e.ic ? B('Mostrar letra/nome', () => { edPush(); e.ic = ''; renderLay(); renderTools(); }) : ICP[e.acao] ? B('Mostrar ícone', () => { edPush(); e.ic = ICP[e.acao]; renderLay(); renderTools(); }) : null));
    } else {
      if(e.type === 'texto'){ const tx = h('input', { class:'inp grow', style:{ minHeight:'36px' }, value:e.text || '' }); tx.oninput = () => { e.text = tx.value; renderLay(); }; linha.push(tx); }
      corpo.append(h('div', { class:'row' }, linha), h('div', { class:'row' }, B('Mais estreito', () => { edPush(); e.w = clamp(e.w - 4, 3, 100); renderLay(); }), B('Mais largo', () => { edPush(); e.w = clamp(e.w + 4, 3, 100); renderLay(); }),
        e.type === 'texto' ? [B('Sem borda', () => { e.box = 'nenhuma'; renderLay(); }), B('Tracejado', () => { e.box = 'linha'; renderLay(); }), B('Caixinha', () => { e.box = 'caixa'; renderLay(); }), B(e.neg ? 'Tirar negrito' : 'Negrito', () => { e.neg = !e.neg; renderLay(); renderTools(); })] : null));
    }
    corpo.append(h('div', { class:'row' }, B('Duplicar', () => { edPush(); const c = Object.assign(clone(e), { id:uid(), x:clamp(e.x + 6, 0, 100) }); c.code = proxCodigo(layY(c, screenEl.clientHeight)); L.els.push(c); ED.sel = c.id; renderLay(); renderTools(); }),
      e.type !== 'titulo' ? B('Apagar', () => { edPush(); L.els = L.els.filter(x => x !== e); ED.sel = null; renderLay(); renderTools(); }, false, 'danger') : null));
  } else corpo.append(h('p', { class:'muted', style:{ margin:0 } }, 'Toque num botão para mudar. Arraste para mover; puxe a bolinha azul para mudar o tamanho. Escolha a função de cada botão na lista. Toque em Pronto para usar.'));
  const add = k => { edPush(); const H = screenEl.clientHeight, y = H * .45; const e2 = { id:uid(), x:50, ay:'top', dy:Math.round(y) }; if(k === 'bola' || k === 'quad') Object.assign(e2, { type:'icone', shape:k, size:38, cor:'branco', rot:'', acao:'', nota:'' }); else if(k === 'traco') Object.assign(e2, { type:'traco', w:12, h:3 }); else Object.assign(e2, { type:'texto', w:40, h:28, text:'Texto', box:'nenhuma' }); e2.code = proxCodigo(y); L.els.push(e2); ED.sel = e2.id; renderLay(); renderTools(); };
  corpo.append(h('span', { class:'lbl' }, 'Adicionar'), h('div', { class:'row' }, B('● Bolinha', () => add('bola')), B('■ Quadradinho', () => add('quad')), B('— Tracinho', () => add('traco')), B('T Texto', () => add('texto'))));
  corpo.append(h('span', { class:'lbl' }, 'Todos os botões'), h('div', { class:'row' }, B('Tudo bolinha', () => { edPush(); L.iconMode = 'bola'; renderLay(); renderTools(); }, L.iconMode === 'bola'), B('Tudo quadradinho', () => { edPush(); L.iconMode = 'quad'; renderLay(); renderTools(); }, L.iconMode === 'quad'), B('Cada um do seu jeito', () => { edPush(); L.iconMode = 'misto'; renderLay(); renderTools(); }, L.iconMode === 'misto')));
  corpo.append(h('div', { class:'row' }, B('Letras e nomes', () => { L.labelMode = 'nome'; renderLay(); renderTools(); }, L.labelMode === 'nome'), B('Códigos', () => { L.labelMode = 'codigo'; renderLay(); renderTools(); }, L.labelMode === 'codigo'), B('Nada', () => { L.labelMode = 'nada'; renderLay(); renderTools(); }, L.labelMode === 'nada')));
  corpo.append(h('details', null, h('summary', { style:{ fontWeight:'600', cursor:'pointer' } }, 'Barras, abas e rolagem'), h('div', { style:{ display:'flex', flexDirection:'column', gap:'8px', marginTop:'8px' } },
    rng('Barra de cima', 'topH', 0, 140, 'px'), rng('Barra de baixo', 'botH', 0, 220, 'px'), rng('Botões das abas: altura acima da barra', 'abaY', 0, 400, 'px'),
    rng('Largura aba esquerda', 'leftW', 40, 100, '%'), rng('Largura aba direita', 'rightW', 40, 100, '%'), rng('Velocidade da rolagem', 'speed', 5, 400, ' px/s'))));
  corpo.append(h('div', { class:'row' }, B('Copiar lista de códigos', () => copiarTexto(listaCodigos(), 'Lista copiada. Cole no chat ou no Gemini.')), B('Voltar ao padrão', async () => { if(await confirmar('Voltar ao padrão', 'Os botões voltam para o desenho original.', 'Voltar')){ edPush(); M.lay = layPadrao(); aplicarBarras(); renderLay(); renderTools(); } }, false, 'danger')));
  t.replaceChildren(h('div', { class:'hd' }, h('b', null, 'Editar botões'), h('button', { class:'btn sm', onclick:() => { if(!ED.undo.length) return toast('Nada para desfazer.'); M.lay = JSON.parse(ED.undo.pop()); ED.sel = null; aplicarBarras(); renderLay(); renderTools(); } }, 'Desfazer'),
    h('button', { class:'btn sm', onclick:() => { ED.pos = ED.pos === 'b' ? 't' : 'b'; renderTools(); } }, ED.pos === 'b' ? 'Subir painel' : 'Descer painel'), h('button', { class:'btn sm acc', onclick:fecharEditor }, 'Pronto')), corpo);
}
function listaCodigos(){
  const L = lay(), H = screenEl.clientHeight, W = screenEl.clientWidth;
  const out = ['PANDA · BOTÕES DA MESA', 'Tela: ' + W + ' × ' + H + ' px · Barra de cima ' + L.topH + ' px · Barra de baixo ' + L.botH + ' px', 'Aba esquerda ' + L.leftW + '% · Aba direita ' + L.rightW + '% · Botões das abas ' + (L.abaY == null ? 12 : L.abaY) + ' px acima da barra', ''];
  L.els.slice().sort((a, b) => layY(a, H) - layY(b, H) || a.x - b.x).forEach(e => out.push(e.code + ' · ' + (e.type === 'icone' ? (e.rot ? '“' + e.rot + '” ' : '') + (e.cor || '') + ' ' + e.size + 'px' : e.type) + ' · x ' + Math.round(e.x) + '% · ' + (e.ay === 'bottom' ? e.dy + ' px do rodapé' : e.dy + ' px do topo') + (e.acao ? ' · ' + acaoNome(e.acao) : '') + (e.nota ? ' · ' + e.nota : '')));
  return out.join('\n');
}

/* ===== fz_mesa2.js ===== */
/* =====================================================================
   Mesa (Panda v1): fecho e tarja na folha, cursor fixo, navegação por
   palavra, frase e parágrafo, folha nova, seleção de folhas, tela de PDF,
   signatário e revisão do texto inteiro
   ===================================================================== */

/* ---------- fecho, data do ofício, notas e tarja na tela ---------- */
function runsHTML(runs){
  return (runs || []).map(r => { let t = esc(r.t || ''); if(r.i) t = '<i>' + t + '</i>'; if(r.b) t = '<b>' + t + '</b>'; return t; }).join('');
}
function fechoEl(d){
  if(!fechoAtivo(d)) return h('div', { class:'fecho sem' });
  const s = d.sig || {}, pes = s.pessoa ? pessoaPorId(s.pessoa) : null;
  const box = h('div', { class:'fecho', title:'Toque para escolher o signatário' });
  box.addEventListener('click', () => { if(!M.fsel) sigSheet(d); });
  if(!docTemDataNoTopo(d)) box.append(h('div', { class:'loc', html:runsHTML(runsDataTopo(d)) }));
  box.append(h('div', { class:'n1' + (pes ? '' : ' vazio') }, pes ? titleCase(pes.nome) : '[Signatário: toque para escolher]'));
  if(pes && pes.cargo) box.append(h('div', { class:'n2' }, pes.cargo));
  return box;
}
function tarjaEl(d){
  const runs = tarjaRuns(d, M.p);
  return h('div', { class:'tarjaV', hidden:!runs, html:runs ? runsHTML(runs) : '' });
}
/* data do ofício no topo, recuo dos parágrafos numerados e restos da folha provisória */
function prepararCorpo(body, d){
  body.querySelectorAll('p.dt').forEach(p => { p.setAttribute('contenteditable', 'false'); const hh = runsHTML(runsDataTopo(d)); if(p.innerHTML !== hh) p.innerHTML = hh; });
  body.querySelectorAll(':scope > p').forEach(p => {
    if(p.classList.contains('bl') || p.classList.contains('id') || p.classList.contains('dt') || p.classList.contains('alin')) return;
    const ni = semRecuo(p.textContent);
    if(ni !== p.classList.contains('ni')) p.classList.toggle('ni', ni);
  });
  if(!body.contains(document.activeElement) && !body.matches(':focus')) body.querySelectorAll('p.tmpP').forEach(p => { if(!p.textContent.trim()){ const hr = p.previousElementSibling; if(hr && hr.matches('hr.tmp')) hr.remove(); p.remove(); } });
}
function mostrarNotas(pg, notas){
  const box = pg.querySelector('.notasV'); if(!box) return;
  box.replaceChildren(...(notas || []).map((t, i) => h('div', null, h('sup', null, String(i + 1)), ' ', t)));
  box.hidden = !(notas && notas.length);
}
/* signatário mudou: redesenha só o que depende dele */
function atualizarFecho(d){
  const pg = paginaEl(d.id); if(!pg) return;
  const f = pg.querySelector('.fecho'); if(f) f.replaceWith(fechoEl(d));
  const t = pg.querySelector('.tarjaV'); if(t) t.replaceWith(tarjaEl(d));
  prepararCorpo(pg.querySelector('.body'), d);
  diagramar(d);
}

/* ---------- cursor fixo (sem piscar) com bolinha vermelha ---------- */
function caretEl(){ let c = $('caret'); if(!c || !pagesEl.contains(c)){ if(c) c.remove(); c = h('div', { id:'caret', 'aria-hidden':'true' }); pagesEl.append(c); } return c; }
function esconderCaret(){ const c = $('caret'); if(c) c.hidden = true; }
function rectDoCursor(s){
  let n = s.focusNode, o = s.focusOffset;
  if(n.nodeType === 1){
    const ch = n.childNodes[o] || null, ant = n.childNodes[o - 1] || null;
    if(ch && ch.nodeType === 3){ n = ch; o = 0; }
    else if(ant && ant.nodeType === 3){ n = ant; o = ant.data.length; }
  }
  if(n.nodeType === 3 && n.data.length){
    const r = document.createRange();
    r.setStart(n, Math.min(o, n.data.length)); r.collapse(true);
    const rs = r.getClientRects(); let rc = rs.length ? rs[rs.length - 1] : null;
    if(!rc || (!rc.height && !rc.top)){ const r2 = document.createRange(); const a = Math.max(0, o - 1); r2.setStart(n, a); r2.setEnd(n, Math.min(n.data.length, a + 1)); const q = r2.getClientRects(); if(q.length){ const x = q[q.length - 1]; rc = { left:o > 0 ? x.right : x.left, top:x.top, height:x.height }; } }
    if(rc && rc.height) return rc;
  }
  const el = (n.nodeType === 1 ? n : n.parentElement), blk = el.closest('p,li,h1,h2,h3,h4,td,th,blockquote') || el;
  const b = blk.getBoundingClientRect(), cs = getComputedStyle(blk), fs = parseFloat(cs.fontSize) || 12;
  let left = b.left + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.textIndent) || 0);
  if(cs.textAlign === 'center') left = b.left + b.width / 2; else if(cs.textAlign === 'right') left = b.right - (parseFloat(cs.paddingRight) || 0);
  return { left, top:b.top + (parseFloat(cs.paddingTop) || 0), height:fs * 1.15 };
}
function atualizarCaret(){
  if(VIEW !== 'mesa' || !M.p) return esconderCaret();
  const s = window.getSelection();
  if(M.fsel || !s || !s.rangeCount || !s.isCollapsed || !s.focusNode) return esconderCaret();
  const el = s.focusNode.nodeType === 1 ? s.focusNode : s.focusNode.parentElement;
  if(!el || !el.closest('#pages .body')) return esconderCaret();
  let rc; try{ rc = rectDoCursor(s); }catch(e){ return esconderCaret(); }
  const c = caretEl(), p0 = pagesEl.getBoundingClientRect();
  c.style.left = Math.round(rc.left - p0.left - 1) + 'px'; c.style.top = Math.round(rc.top - p0.top) + 'px'; c.style.height = Math.max(8, Math.round(rc.height)) + 'px';
  c.hidden = false;
}
let _caretRaf = 0;
document.addEventListener('selectionchange', () => {
  if(_caretRaf) return;
  _caretRaf = requestAnimationFrame(() => { _caretRaf = 0; atualizarCaret(); limparFolhaTmp(false); });
});

/* ---------- mapa do texto: posições lineares para andar por palavra e frase ---------- */
const BLOCOS = 'p,li,h1,h2,h3,h4,td,th';
function mapaTexto(body){
  const segs = []; let str = '', ultBlk = null;
  const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, { acceptNode:n => n.parentElement.closest('sup.nr,p.dt,.naoimp') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let t;
  while((t = w.nextNode())){
    const blk = t.parentElement.closest(BLOCOS) || t.parentElement;
    if(ultBlk && blk !== ultBlk){ str += '\n'; }
    ultBlk = blk;
    segs.push({ node:t, start:str.length, len:t.data.length, blk });
    str += t.data;
  }
  return { str, segs, body };
}
function posDeDom(M_, node, off){
  const { segs } = M_;
  for(const sg of segs) if(sg.node === node) return sg.start + Math.min(off, sg.len);
  const r = document.createRange();
  try{ r.setStart(node, off); }catch(e){ return 0; }
  for(const sg of segs){ if(r.comparePoint(sg.node, 0) >= 0) return sg.start; }
  const u = segs[segs.length - 1]; return u ? u.start + u.len : 0;
}
function domDePos(M_, i){
  const { segs } = M_;
  if(!segs.length) return { node:M_.body, off:0 };
  let ant = null;
  for(const sg of segs){ if(i >= sg.start && i < sg.start + sg.len) return { node:sg.node, off:i - sg.start }; if(i < sg.start) return ant ? { node:ant.node, off:ant.len } : { node:sg.node, off:0 }; ant = sg; }
  const u = segs[segs.length - 1]; return { node:u.node, off:u.len };
}
const ESP = c => c == null || /[\s ]/.test(c);
function inicioProxPalavra(S, i){ const L = S.length; while(i < L && !ESP(S[i])) i++; while(i < L && ESP(S[i])) i++; return i; }
function fimProxPalavra(S, i){ const L = S.length; while(i < L && ESP(S[i])) i++; while(i < L && !ESP(S[i])) i++; return i; }
function inicioPalavraAnt(S, i){ i--; while(i >= 0 && ESP(S[i])) i--; while(i > 0 && !ESP(S[i - 1])) i--; return Math.max(0, i); }
/* frase: termina só em . ? ! : (vírgula, parênteses, travessão e números não contam; abreviações também não) */
const ABREV = new Set(['sr', 'sra', 'srs', 'dr', 'dra', 'art', 'arts', 'inc', 'incs', 'n', 'nº', 'no', 'fls', 'fl', 'p', 'pp', 'pág', 'págs', 'ex', 'exa', 'exmo', 'exma', 'etc', 'obs', 'prof', 'profa', 'eng', 'av', 'r', 'tel', 'cf', 'id', 'ib', 'op', 'cit', 'séc', 'v', 'vs', 'ltda', 'sa', 'cia', 'min', 'máx', 'aprox', 'ref', 'proc', 'adm', 'sec', 'mun', 'gov', 'jr', 'lc', 'ss', 'inc', 'al', 'dec', 'res', 'port', 'arq', 'cód', 'nº.', 'item', 'itens', 'anexo']);
function fimDeFrase(S, i){
  const ch = S[i];
  if(!'.?!:'.includes(ch)) return false;
  const nx = S[i + 1];
  if(!(nx == null || ESP(nx) || /["”')\]]/.test(nx))) return false;
  if(ch === '.'){
    let k = i - 1, w = ''; while(k >= 0 && /[\p{L}º°ª]/u.test(S[k])){ w = S[k] + w; k--; }
    if(w && (ABREV.has(w.toLowerCase()) || (w.length === 1 && /[A-ZÀ-Ý]/.test(w)))) return false;
    let m = i + 1; while(m < S.length && (S[m] === ' ' || S[m] === ' ')) m++;
    if(m < S.length && /[a-zà-ÿ]/.test(S[m])) return false;
  }
  return true;
}
function fimDaFrase(S, i){
  const L = S.length;
  while(i < L && ESP(S[i]) && S[i] !== '\n') i++;
  for(; i < L; i++){
    if(S[i] === '\n') return i;
    if(fimDeFrase(S, i)){ let e = i + 1; while(e < L && /["”')\]]/.test(S[e])) e++; return e; }
  }
  return L;
}
function inicioDaFrase(S, i){
  let k = i - 1;
  while(k >= 0 && ESP(S[k]) && S[k] !== '\n') k--;
  if(k >= 0 && (S[k] === '\n' || fimDeFrase(S, k) || /["”')\]]/.test(S[k]))) k--;   // já está no início: volta para a frase anterior
  for(; k >= 0; k--){ if(S[k] === '\n' || fimDeFrase(S, k)) break; }
  let st = k + 1; while(st < S.length && ESP(S[st])) st++;
  return st;
}

/* ---------- ◀ ▶ : palavra a palavra (S ligado: seleciona; dois toques: até o fim ou início da frase) ---------- */
const NAV = { ult:null };
function navPalavra(dir){
  const s = selComFoco(); if(!s) return toast('Toque no texto primeiro.');
  const body = curBody(); if(!body) return;
  const agora = Date.now(), dup = M.selMode && NAV.ult && NAV.ult.dir === dir && agora - NAV.ult.t < 360 && NAV.ult.body === body;
  const antes = guardarSel();
  const T = mapaTexto(body), S = T.str;
  if(dup){ voltarSel(NAV.ult.antes); NAV.ult = null; }
  const s2 = window.getSelection();
  const f = posDeDom(T, s2.focusNode, s2.focusOffset), a = posDeDom(T, s2.anchorNode, s2.anchorOffset);
  let nf;
  if(dup) nf = dir > 0 ? fimDaFrase(S, f) : inicioDaFrase(S, f);
  else if(M.selMode) nf = dir > 0 ? fimProxPalavra(S, f) : inicioPalavraAnt(S, f);
  else {
    nf = dir > 0 ? inicioProxPalavra(S, f) : inicioPalavraAnt(S, f);
    if(dir > 0 && nf >= S.length && f >= S.length - 1 || dir < 0 && f === 0){ pularDeDocumento(dir > 0 ? 'forward' : 'backward'); verFoco(); return; }
  }
  if(M.selMode){
    if(nf > a) while(nf > a && ESP(S[nf - 1])) nf--;
    else if(nf < a) while(nf < a && ESP(S[nf])) nf++;
    const an = domDePos(T, a), fo = domDePos(T, nf);
    try{ s2.setBaseAndExtent(an.node, an.off, fo.node, fo.off); }catch(e){}
    if(!dup) NAV.ult = { dir, t:agora, antes, body };
  } else {
    const fo = domDePos(T, nf);
    try{ s2.collapse(fo.node, fo.off); }catch(e){}
  }
  verFoco(); atualizarCaret();
}

/* ---------- ▲ ▼ : parágrafo a parágrafo (S ligado: estende até o fim do parágrafo) ---------- */
function blocosDe(body){ return Array.from(body.querySelectorAll(BLOCOS)).filter(b => !b.querySelector(BLOCOS) && !b.matches('p.dt') && !b.closest('p.dt')); }
function primeiroPonto(b){ const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); const t = w.nextNode(); return t ? { node:t, off:0 } : { node:b, off:0 }; }
function ultimoPonto(b){ const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let t, u = null; while((t = w.nextNode())) u = t; if(!u) return { node:b, off:b.childNodes.length && b.lastChild.nodeName === 'BR' ? b.childNodes.length - 1 : b.childNodes.length }; let o = u.data.length; while(o > 0 && /\s/.test(u.data[o - 1])) o--; return { node:u, off:o }; }
function blocoDoPonto(bls, node, off){
  const el = node.nodeType === 1 ? node : node.parentElement;
  const b = el.closest(BLOCOS); if(b && bls.includes(b)) return b;
  const r = document.createRange(); try{ r.setStart(node, off); }catch(e){ return bls[0]; }
  for(const x of bls) if(r.comparePoint(x, 0) >= 0) return x;
  return bls[bls.length - 1];
}
const vazioEntre = (n1, o1, n2, o2) => { const r = document.createRange(); try{ r.setStart(n1, o1); r.setEnd(n2, o2); }catch(e){ return true; } return !r.toString().trim(); };
function navParagrafo(dir){
  const s = selComFoco(); if(!s) return toast('Toque no texto primeiro.');
  const body = curBody(); if(!body) return;
  const bls = blocosDe(body); if(!bls.length) return;
  const B = blocoDoPonto(bls, s.focusNode, s.focusOffset), i = bls.indexOf(B);
  const ini = primeiroPonto(B), fim = ultimoPonto(B);
  if(M.selMode){
    let alvo;
    if(dir > 0){ alvo = vazioEntre(s.focusNode, s.focusOffset, fim.node, fim.off) && bls[i + 1] ? ultimoPonto(bls[i + 1]) : fim; }
    else { alvo = vazioEntre(ini.node, ini.off, s.focusNode, s.focusOffset) && bls[i - 1] ? primeiroPonto(bls[i - 1]) : ini; }
    try{ s.extend(alvo.node, alvo.off); }catch(e){}
    verFoco(); atualizarCaret(); return;
  }
  if(dir > 0){
    if(B.classList.contains('tmpP') && !B.textContent.trim()){ limparFolhaTmp(true); return pularDeDocumento('forward'); }
    if(!bls[i + 1]) return abrirFolhaTmp(body);
    const p = primeiroPonto(bls[i + 1]); s.collapse(p.node, p.off);
  } else {
    if(B.classList.contains('tmpP') && !B.textContent.trim()){
      limparFolhaTmp(true);
      const b2 = blocosDe(body), u = b2[b2.length - 1]; if(u){ const p = ultimoPonto(u); s.collapse(p.node, p.off); }
      verFoco(); atualizarCaret(); diagramar(docById(body.parentElement.dataset.doc)); return;
    }
    const noInicio = vazioEntre(ini.node, ini.off, s.focusNode, s.focusOffset) && s.isCollapsed;
    if(!noInicio){ s.collapse(ini.node, ini.off); }
    else if(bls[i - 1]){ const p = primeiroPonto(bls[i - 1]); s.collapse(p.node, p.off); }
    else { pularDeDocumento('backward'); const b2 = curBody(); if(b2){ const l = blocosDe(b2); if(l.length){ const p = primeiroPonto(l[l.length - 1]); window.getSelection().collapse(p.node, p.off); } } }
  }
  verFoco(); atualizarCaret();
}

/* ---------- folha nova no fim do documento (some se ficar vazia) ---------- */
function abrirFolhaTmp(body, depoisDe){
  limparFolhaTmp(true);
  const hr = h('hr', { class:'qp tmp' }), p = h('p', { class:'tmpP' }, h('br'));
  if(depoisDe && depoisDe.parentElement === body) depoisDe.after(hr, p); else body.append(hr, p);
  const s = window.getSelection(); s.collapse(p, 0);
  const pg = body.parentElement, d = docById(pg.dataset.doc);
  const chip = h('button', { class:'tmpNovo', onclick:ev => { ev.preventDefault(); limparFolhaTmp(true); novoDocumento({}); } }, '+ Novo documento');
  chip.addEventListener('pointerdown', ev => ev.preventDefault());
  pg.append(chip);
  const pos = () => { if(chip.isConnected && hr.isConnected) chip.style.top = Math.round(hr.offsetTop - 13) + 'px'; };
  pos(); setTimeout(pos, 60);
  if(d) diagramar(d).then(pos);
  verFoco(); atualizarCaret();
  toast('Folha nova. Se você não escrever nada, ela some.', { ms:2200 });
}
function limparFolhaTmp(forcar){
  const tmp = pagesEl.querySelectorAll('p.tmpP'); if(!tmp.length){ pagesEl.querySelectorAll('.tmpNovo').forEach(c => c.remove()); return; }
  const s = window.getSelection(), fn = s && s.focusNode;
  tmp.forEach(p => {
    const hr = p.previousElementSibling && p.previousElementSibling.matches('hr.tmp') ? p.previousElementSibling : null;
    const vazio = !p.textContent.trim(), dentro = fn && p.contains(fn);
    if(!vazio){ p.classList.remove('tmpP'); if(hr) hr.classList.remove('tmp'); const c = p.closest('.page').querySelector('.tmpNovo'); if(c) c.remove(); return; }
    if(forcar || !dentro){
      const pg = p.closest('.page'); if(hr) hr.remove(); p.remove();
      if(pg){ const c = pg.querySelector('.tmpNovo'); if(c) c.remove(); const d = docById(pg.dataset.doc); if(d) diagramar(d); }
    }
  });
}
/* "Nova página" da caixa de novo documento: folha nova logo depois do parágrafo atual */
function novaPaginaNaMesa(){
  const s = curSel(); let body = curBody();
  if(!body){ body = bodyDoDoc(M.cur && M.cur.d); }
  if(!body) return toast('Vá até um texto para abrir uma folha nova.');
  body.focus({ preventScroll:true });
  let blk = null;
  if(s){ const n = s.focusNode, el = n.nodeType === 1 ? n : n.parentElement; blk = el.closest('.body > *'); }
  abrirFolhaTmp(body, blk);
}

/* =====================================================================
   Seleção de folhas (processo) e tela de PDF (mesa avulsa)
   ===================================================================== */
function folhasTela(){
  const out = [], F = M.fls || {};
  pagesEl.querySelectorAll('.page').forEach(pg => {
    const d = docById(pg.dataset.doc); if(!d) return;
    const f = F[d.id] || { ini:1 };
    if(pg.classList.contains('pdf')){
      const idx = +pg.dataset.i, e = d.pl[idx], k = vivas(d).indexOf(e);
      out.push({ key:d.id + ':' + idx, d, pg, top:0, h:pg.offsetHeight, fl:f.ini + k, e });
    } else if(pg.classList.contains('txt')){
      const tops = [0].concat(Array.from(pg.querySelectorAll('.brk')).map(b => b.offsetTop));
      tops.forEach((t, j) => out.push({ key:d.id + '#' + j, d, pg, top:t, h:(tops[j + 1] != null ? tops[j + 1] : pg.offsetHeight) - t, fl:f.ini + j, j }));
    }
  });
  return out;
}
function entrarSelecao(tudo, modo){
  if(!M.p) return;
  salvarTudo(); fecharTeclado(); fecharPainel(true); pararRolagem(); $('fmt').hidden = true;
  const s = window.getSelection(); if(s) s.removeAllRanges();
  M.fsel = { modo:modo || (M.p.avulsa ? 'pdf' : 'folhas'), sel:new Set(), ult:null, escopo:'pagina' };
  if(tudo) folhasTela().forEach(f => M.fsel.sel.add(f.key));
  if(M.fsel.sel.size) M.fsel.escopo = 'sel';
  screenEl.classList.add('modoSel');
  pintarSelecao(); atualizarIcones(); esconderCaret();
  if(!tudo && M.fsel.modo === 'folhas') toast('Toque nas folhas para marcar. Toque no nome do documento para marcar ele inteiro; segure para marcar um intervalo.', { ms:3800 });
}
function sairSelecao(silencioso){
  if(!M.fsel) return;
  M.fsel = null; screenEl.classList.remove('modoSel');
  pagesEl.querySelectorAll('.fsel').forEach(x => x.remove());
  $('selBar').hidden = true; $('selBar').replaceChildren(); pagesEl.style.paddingBottom = '';
  aplicarBarras();
  if(!silencioso){ atualizarIcones(); mapaPaginas(); }
}
function pintarSelecao(){
  if(!M.fsel) return;
  pagesEl.querySelectorAll('.fsel').forEach(x => x.remove());
  const lista = folhasTela(), vivos = new Set(lista.map(f => f.key));
  M.fsel.sel.forEach(k => { if(!vivos.has(k)) M.fsel.sel.delete(k); });
  lista.forEach(f => {
    const ov = h('div', { class:'fsel' + (M.fsel.sel.has(f.key) ? ' on' : ''), style:{ top:f.top + 'px', height:Math.max(20, f.h) + 'px' }, dataset:{ k:f.key } }, h('i'));
    f.pg.append(ov);
  });
  renderSelBar();
}
function marcarFolhas(keys, on){ keys.forEach(k => on ? M.fsel.sel.add(k) : M.fsel.sel.delete(k)); if(M.fsel.sel.size) M.fsel.escopo = 'sel'; pagesEl.querySelectorAll('.fsel').forEach(o => o.classList.toggle('on', M.fsel.sel.has(o.dataset.k))); renderSelBar(); }
(function(){
  let t = null, longo = false, alvo = null;
  pagesEl.addEventListener('pointerdown', ev => {
    if(!M.fsel) return;
    const ov = ev.target.closest('.fsel'); if(!ov) return;
    alvo = ov; longo = false; clearTimeout(t);
    t = setTimeout(() => {
      longo = true;
      const lista = folhasTela().map(f => f.key), a = M.fsel.ult != null ? lista.indexOf(M.fsel.ult) : -1, b = lista.indexOf(ov.dataset.k);
      if(a < 0 || b < 0){ marcarFolhas([ov.dataset.k], true); M.fsel.ult = ov.dataset.k; return; }
      marcarFolhas(lista.slice(Math.min(a, b), Math.max(a, b) + 1), true);
      if(navigator.vibrate) try{ navigator.vibrate(18); }catch(e){}
      toast('Intervalo marcado.', { ms:1100 });
    }, 520);
  });
  const fim = () => clearTimeout(t);
  pagesEl.addEventListener('pointerup', fim); pagesEl.addEventListener('pointercancel', fim);
  pagesEl.addEventListener('scroll', fim, true);
  docEl.addEventListener('scroll', fim, { passive:true });
  pagesEl.addEventListener('click', ev => {
    if(!M.fsel) return;
    const lab = ev.target.closest('.dlabel');
    if(lab){ const ks = folhasTela().filter(f => f.d.id === lab.dataset.lab).map(f => f.key); const todos = ks.every(k => M.fsel.sel.has(k)); marcarFolhas(ks, !todos); return; }
    const ov = ev.target.closest('.fsel'); if(!ov) return;
    ev.preventDefault();
    if(longo){ longo = false; return; }
    const k = ov.dataset.k; marcarFolhas([k], !M.fsel.sel.has(k)); M.fsel.ult = k;
  });
})();
function selecionadas(){ const S = M.fsel.sel; return folhasTela().filter(f => S.has(f.key)); }
/* folhas que a ferramenta vai usar (tela de PDF: só a página / selecionadas / arquivo todo) */
function alvos(){
  const F = M.fsel;
  if(F.modo === 'folhas' || F.escopo === 'sel'){ const l = selecionadas(); if(!l.length) toast('Marque as folhas primeiro.'); return l; }
  const lista = folhasTela(), c = M.cur;
  if(!c) return [];
  if(F.escopo === 'tudo') return lista.filter(f => f.d === c.d);
  const y = docEl.scrollTop + docEl.clientHeight * 0.33;
  let atual = null; for(const f of lista){ if(f.pg.offsetTop + f.top <= y) atual = f; }
  return atual ? [atual] : lista.slice(0, 1);
}
function renderSelBar(){
  const F = M.fsel, bar = $('selBar'); if(!F) return;
  const n = F.sel.size, pdfM = F.modo === 'pdf';
  const tb = (rot, ic, fn, cls) => h('button', { class:'tbtn' + (cls ? ' ' + cls : ''), onclick:fn }, h('i', { html:I[ic] || ic }), rot);
  const lin = h('div', { class:'l' }, h('b', null, n ? plural(n, 'marcada', 'marcadas') : pdfM ? 'PDF' : 'Folhas'),
    pdfM ? h('div', { class:'escopo' }, [['pagina', 'Página'], ['sel', 'Marcadas'], ['tudo', 'Arquivo']].map(([k, t]) => h('button', { class:F.escopo === k ? 'on' : '', onclick:() => { F.escopo = k; renderSelBar(); } }, t))) : h('span', { class:'grow' }),
    h('button', { class:'btn sm ghost', onclick:() => { if(n){ F.sel.clear(); F.escopo = 'pagina'; pintarSelecao(); } else marcarFolhas(folhasTela().map(f => f.key), true); } }, n ? 'Nenhuma' : 'Todas'),
    h('button', { class:'hbtn', html:I.x, 'aria-label':'Sair', onclick:() => sairSelecao() }));
  const kids = [lin];
  if(pdfM){
    const todasB = alvosSilenciosos().filter(f => f.e).every(f => f.e.b);
    kids.push(h('div', { class:'g' },
      tb('Enviar', 'share', ev => exportarSheet(ev.currentTarget), 'pri'),
      tb('Girar', 'rotR', () => pdfGirar(90)),
      tb(todasB ? 'Sem brasão' : 'Brasão', h('img', { src:BRAS_SRC, alt:'', style:{ width:'20px', opacity:todasB ? '.4' : '1' } }).outerHTML, () => pdfBrasao()),
      tb(settings.numerar ? 'Numeradas' : 'Numerar', 'hash', () => { settings.numerar = !settings.numerar; saveSettings(); renderSelBar(); }, settings.numerar ? 'pri' : ''),
      tb('Juntar', 'layers', () => pdfJuntar()),
      tb('Separar', 'split', () => pdfSeparar()),
      tb('Retirar', 'trash', () => pdfRetirar()),
      tb('Para processo', 'folderPlus', () => pdfIncluirEmProcesso()),
      tb('Anexar', 'clip', () => incluirPdfNaMesa())));
  } else {
    kids.push(h('div', { class:'g' },
      tb('Gerar PDF', 'pdf', () => exportarFolhas(alvos(), 'previa')),
      tb('Imprimir', 'print', () => exportarFolhas(alvos(), 'imprimir')),
      tb(settings.numerar ? 'Numeradas' : 'Numerar', 'hash', () => { settings.numerar = !settings.numerar; saveSettings(); renderSelBar(); }, settings.numerar ? 'pri' : ''),
      tb('Compartilhar', 'share', () => exportarFolhas(alvos(), 'compartilhar'), 'pri')));
  }
  bar.replaceChildren(...kids); bar.hidden = false;
  requestAnimationFrame(() => { if(M.fsel) pagesEl.style.paddingBottom = (bar.offsetHeight + 30) + 'px'; });
}
function alvosSilenciosos(){ const F = M.fsel; if(!F) return []; if(F.escopo === 'sel' || F.modo === 'folhas') return selecionadas(); const c = M.cur; if(!c) return []; const l = folhasTela(); if(F.escopo === 'tudo') return l.filter(f => f.d === c.d); const y = docEl.scrollTop + docEl.clientHeight * 0.33; let a = null; for(const f of l) if(f.pg.offsetTop + f.top <= y) a = f; return a ? [a] : []; }
const soPdf = l => { const r = l.filter(f => f.e); if(l.length && !r.length) toast('Essas ferramentas valem para páginas de PDF. Textos se ajustam no próprio texto.'); return r; };
function depoisDeMudar(msg){ salvarTudo(); touch(M.p); saveDB(); renderMesa(true); if(msg) toast(msg, { ms:1400 }); }
function pdfGirar(g){ const l = soPdf(alvos()); if(!l.length) return; l.forEach(f => f.e.r = (((f.e.r || 0) + g) % 360 + 360) % 360); depoisDeMudar(plural(l.length, 'página girada', 'páginas giradas') + '.'); }
function pdfBrasao(){ const l = soPdf(alvos()); if(!l.length) return; const todas = l.every(f => f.e.b); l.forEach(f => f.e.b = !todas); depoisDeMudar(todas ? 'Brasão retirado.' : 'Brasão colocado.'); }
function pdfRetirar(){ const l = soPdf(alvos()); if(!l.length) return; l.forEach(f => f.e.d = true); depoisDeMudar(); toast(plural(l.length, 'página retirada', 'páginas retiradas') + '.', { acao:'Desfazer', fn:() => { l.forEach(f => f.e.d = false); depoisDeMudar(); } }); }
/* separar: as páginas marcadas saem do arquivo e viram um documento próprio (sem refazer o arquivo) */
function pdfSeparar(){
  const l = soPdf(alvos()); if(!l.length) return;
  const porDoc = new Map(); l.forEach(f => { if(!porDoc.has(f.d)) porDoc.set(f.d, []); porDoc.get(f.d).push(f.e); });
  salvarTudo();
  let n = 0;
  porDoc.forEach((es, d) => {
    if(es.length === vivas(d).length && porDoc.size === 1 && M.fsel.escopo !== 'pagina') return toast('Isso já é o arquivo inteiro.');
    const novo = Object.assign(clone(d), { id:uid(), nome:d.nome + ' (separado)', pl:es.map(e => clone(e)), pai:null });
    es.forEach(e => e.d = true);
    M.p.docs.splice(M.p.docs.indexOf(d) + 1, 0, novo); n++;
  });
  if(n){ M.fsel.sel.clear(); depoisDeMudar(n === 1 ? 'Páginas separadas num arquivo próprio.' : n + ' arquivos separados.'); }
}
async function pdfJuntar(){
  const l = alvos(); if(!l.length) return;
  if(M.fsel.escopo !== 'sel' && M.fsel.modo === 'pdf'){
    /* sem marcação: junta todos os arquivos da mesa, na ordem */
    const todos = folhasTela(); if(todos.length < 2) return toast('Precisa de pelo menos duas páginas.');
    return juntarEmArquivo(todos);
  }
  juntarEmArquivo(l);
}
async function juntarEmArquivo(l){
  const docs = Array.from(new Set(l.map(f => f.d)));
  const op = await escolher('Juntar ' + plural(l.length, 'folha', 'folhas') + ' num arquivo só', [['tirar', 'Juntar e tirar os originais', 'O arquivo novo fica no lugar deles'], ['manter', 'Juntar e manter os originais']], 'tirar');
  if(!op) return;
  const b = busy('Juntando…');
  try{
    const bytes = await pdfDasFolhas(l, {});
    const nome = await Promise.resolve(docs.length === 1 ? docs[0].nome + ' (junto)' : 'PDF juntado ' + dataBR(hojeISO()));
    const d = await novoDocPdf(M.p, nome, bytes, 'linha');
    M.p.docs = M.p.docs.filter(x => x !== d);
    const i = M.p.docs.indexOf(docs[0]); M.p.docs.splice(i < 0 ? M.p.docs.length : i, 0, d);
    if(op === 'tirar'){
      const usadas = new Set(l.map(f => f.e).filter(Boolean));
      for(const x of docs){
        if(x.kind === 'pdf'){ x.pl.forEach(e => { if(usadas.has(e)) e.d = true; }); if(!vivas(x).length){ M.p.docs = M.p.docs.filter(y => y !== x); if(!fileEmUso(x.fileId, x)) await apagarBytes(x.fileId); } }
      }
    }
    b.end(); M.fsel.sel.clear(); M.fsel.escopo = 'pagina';
    depoisDeMudar('Arquivo juntado: ' + d.nome + '.');
  }catch(e){ b.end(); console.error(e); toast('Não foi possível juntar: ' + (e.message || e)); }
}
async function pdfIncluirEmProcesso(){
  const l = alvos(); if(!l.length) return;
  const ps = procsReais().filter(q => q !== M.p).sort((a, b) => b.updated - a.updated);
  if(!ps.length) return toast('Ainda não há processo para receber. Crie um em Novo processo.');
  const id = await optSheet('Incluir em qual processo?', [{ itens:ps.map(q => ({ v:q.id, t:q.ficha.objeto || tituloProc(q), sub:q.ficha.num || '' })) }], null);
  if(!id) return;
  const q = procPorId(id);
  const onde = await escolher('Onde entra', [['linha', 'Na linha do processo'], ['repo', 'No repositório'], ['ambos', 'Nos dois']], 'linha');
  if(!onde) return;
  const docs = Array.from(new Set(l.map(f => f.d)));
  const nome = await perguntar('Nome do documento', 'Como vai aparecer no processo', docs.length === 1 ? docs[0].nome : 'Documentos ' + dataBR(hojeISO()), 'Incluir');
  if(!nome) return;
  const b = busy('Preparando…');
  try{
    const bytes = await pdfDasFolhas(l, {});
    const d = await novoDocPdf(q, nome, bytes, onde);
    marcarUltimo(q); saveDB(true); b.end();
    toast('Incluído em ' + (q.ficha.num || tituloProc(q)) + '.', { acao:'Abrir', fn:() => abrirMesa(q, { doc:d.id }), ms:6000 });
  }catch(e){ b.end(); console.error(e); toast('Não foi possível incluir: ' + (e.message || e)); }
}
/* monta um PDF com as folhas escolhidas, na ordem da mesa; o carimbo mantém o número original da folha */
async function pdfDasFolhas(lista, opt){
  opt = opt || {};
  const out = await PDFLib.PDFDocument.create();
  const R = await recursos(out, { brasao:lista.some(f => f.e && f.e.b), carimbo:opt.carimbo });
  const txt = {}, byt = {};
  for(let i = 0; i < lista.length;){
    const f = lista[i];
    if(f.e){
      let j = i; const es = []; while(j < lista.length && lista[j].d === f.d && lista[j].e){ es.push(lista[j].e); j++; }
      const bytes = byt[f.d.fileId] || (byt[f.d.fileId] = await bytesDe(f.d.fileId));
      if(!bytes) throw new Error('arquivo de ' + f.d.nome + ' não encontrado');
      await PDFGen.appendFile(out, { bytes, pl:f.d.pl, name:f.d.nome }, R, es);
      i = j;
    } else {
      if(!txt[f.d.id]){ const t = await PDFGen.texto(htmlDoc(f.d), { doc:f.d, proc:M.p, title:f.d.nome }); txt[f.d.id] = await PDFLib.PDFDocument.load(t.bytes); }
      const src = txt[f.d.id], k = Math.min(f.j, src.getPageCount() - 1);
      const [pg] = await out.copyPages(src, [k]); out.addPage(pg);
      i++;
    }
  }
  if((opt.carimbo && opt.carimbo !== 'nenhum') || opt.numerar) carimbar(out, R, { carimbo:opt.carimbo || 'nenhum', numerar:opt.numerar, numeros:lista.map(f => f.fl), deitada:settings.deitada });
  out.setTitle(opt.titulo || ''); out.setCreator('Panda'); out.setProducer('Panda');
  return out.save();
}
function optCarimbo(){ return { carimbo:'nenhum', numerar:!!settings.numerar }; }
function exportarSheet(ancora){
  const l = alvos(); if(!l.length) return;
  menu('Exportar ' + plural(l.length, 'folha', 'folhas'), [
    { t:'Compartilhar PDF', sub:'WhatsApp, Gmail, Drive…', ic:'share', fn:() => exportarFolhas(l, 'compartilhar') },
    { t:'Imprimir', ic:'print', fn:() => exportarFolhas(l, 'imprimir') },
    { t:'Ver o PDF', ic:'eye', fn:() => exportarFolhas(l, 'previa') },
  ], ancora);
}
async function exportarFolhas(l, como){
  if(!l || !l.length) return;
  if(!precisaLibs()) return;
  const b = busy('Montando o PDF…');
  try{
    const o = optCarimbo();
    const bytes = await pdfDasFolhas(l, Object.assign({ titulo:tituloProc(M.p) }, o));
    b.end();
    const docs = Array.from(new Set(l.map(f => f.d)));
    const nome = safeName((docs.length === 1 ? docs[0].nome : (M.p.avulsa ? 'Documentos' : tituloProc(M.p))) + (l.length < folhasTela().length && docs.length > 1 ? ' (fls. ' + faixaTexto(l.map(f => f.fl)) + ')' : ''), '.pdf');
    if(como === 'imprimir') return imprimirBytes(bytes, nome);
    if(como === 'previa') return previa(bytes, nome);
    offer(bytes, nome);
  }catch(e){ b.end(); console.error(e); toast('Não foi possível montar o PDF: ' + (e.message || e)); }
}
function faixaTexto(ns){ ns = ns.slice().sort((a, b) => a - b); const out = []; let a = ns[0], p = ns[0]; for(let i = 1; i <= ns.length; i++){ if(ns[i] === p + 1){ p = ns[i]; continue; } out.push(a === p ? String(a) : a + '-' + p); a = p = ns[i]; } return out.join(', '); }
/* imprimir: no app instalado vai direto para as impressoras do Android (Brother, Xerox…) */
async function imprimirBytes(bytes, nome){
  if(!PWA || !temPdfjs()){ previa(bytes, nome); toast('Para imprimir, use Compartilhar na prévia e escolha a impressora. No app instalado este botão imprime direto.', { ms:6000 }); return; }
  const b = busy('Preparando a impressão…');
  try{
    const pdf = await pdfjsLib.getDocument(Object.assign({ data:bytes.slice(), isEvalSupported:false }, window.PDFJS_OPTS || {})).promise;
    const area = $('printArea'); area.replaceChildren();
    for(let i = 1; i <= pdf.numPages; i++){
      b.txt('Página ' + i + ' de ' + pdf.numPages + '…');
      const pg = await pdf.getPage(i), v1 = pg.getViewport({ scale:1 }), k = 1240 / Math.max(v1.width, 1);
      const vp = pg.getViewport({ scale:k }), cv = document.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await pg.render({ canvasContext:ctx, viewport:vp }).promise;
      area.append(h('img', { src:cv.toDataURL('image/jpeg', 0.9), alt:'' }));
    }
    pdf.destroy(); b.end();
    setTimeout(() => { window.print(); setTimeout(() => area.replaceChildren(), 1500); }, 120);
  }catch(e){ b.end(); console.error(e); previa(bytes, nome); }
}

/* ---------- bolinha do PDF (página de PDF em vista) ---------- */
function menuPdfPagina(){
  const c = M.cur; if(!c || !c.e) return;
  const e = c.e, d = c.d;
  const mud = fn => () => { fn(); depoisDeMudar(); };
  menu(d.nome + ' · fls. ' + c.fl, [
    { t:'Girar para a direita', ic:'rotR', fn:mud(() => { e.r = ((e.r || 0) + 90) % 360; }) },
    { t:'Girar para a esquerda', ic:'rotL', fn:mud(() => { e.r = ((e.r || 0) + 270) % 360; }) },
    { t:'Girar o arquivo todo', sub:'Página deitada: gira todas as páginas deste arquivo', ic:'rot', fn:mud(() => vivas(d).forEach(z => z.r = ((z.r || 0) + 90) % 360)) },
    { t:e.b ? 'Tirar o brasão desta página' : 'Brasão nesta página', ic:'pdf', fn:mud(() => { e.b = !e.b; }) },
    { t:'Retirar esta página', ic:'trash', fn:() => { e.d = true; depoisDeMudar(); toast('Página retirada.', { acao:'Desfazer', fn:() => { e.d = false; depoisDeMudar(); } }); } },
    '-',
    { t:'Selecionar folhas', sub:'Juntar, separar, carimbar, exportar', ic:'selpg', fn:() => entrarSelecao(false, M.p.avulsa ? 'pdf' : 'folhas') }
  ]);
}
for(const [id, fn] of [['bSig', () => { const d = M.cur && M.cur.d; if(d && d.kind === 'texto') sigSheet(d); }], ['bNovo', () => novoDocumento({})], ['bPdf', menuPdfPagina]]){
  $(id).addEventListener('pointerdown', ev => ev.preventDefault());
  $(id).addEventListener('click', () => { if(M.editing) return; fecharTeclado(); fn(); });
}
$('bSig').innerHTML = I.sig; $('bPdf').innerHTML = I.rotR;

/* ---------- barras da mesa (visual iOS): em cima ‹ Início · documento · signatário · + ; embaixo a cápsula de navegação ---------- */
$('aHome').innerHTML = I.chevL + '<span>Início</span>'; $('aSig').innerHTML = I.personPlus; $('aMais').innerHTML = I.plusBold;
[['selecionar', 'selbox'], ['esq', 'chevL'], ['cima', 'chevU'], ['baixo', 'chevD'], ['dir', 'chevR'], ['campo', 'campo'], ['ferramentas', 'plusCircle']].forEach(([a, ic]) => { const b = $('aBot').querySelector('[data-a="' + a + '"]'); if(b) b.innerHTML = I[ic]; });
[$('aTop'), $('aBot')].forEach(bar => bar.addEventListener('pointerdown', ev => { if(ev.target.closest('button')) ev.preventDefault(); }));   // não tira o cursor do texto
$('aHome').onclick = () => { fecharTeclado(); sairMesa(); };
$('aTit').onclick = () => { fecharTeclado(); M.painel === 'esq' ? fecharPainel() : abrirPainel('esq'); };
$('aSig').onclick = () => { fecharTeclado(); const d = M.cur && M.cur.d; if(d && d.kind === 'texto') sigSheet(d); else toast('Vá até um texto para escolher o signatário.'); };
$('aMais').onclick = () => { fecharTeclado(); menuTopo($('aMais')); };
$('aBot').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-a]'); if(!b || M.editing) return;
  if(b.dataset.a !== 'ferramentas') fecharTeclado();
  acao(b.dataset.a);
});
function menuTopo(ancora){
  const d = M.cur && M.cur.d, txt = d && d.kind === 'texto', p = M.p, proc = !p.avulsa && !p.avdoc;
  popMenu(ancora, [
    d ? { t:'Gerar PDF', sub:d.nome, ic:'pdf', fn:() => previaDoc(d) } : null,
    d ? { t:'Compartilhar', ic:'share', fn:() => baixarDoc(d) } : null,
    txt ? { t:'Word', ic:'word', fn:() => baixarWord(d) } : null,
    '-',
    p.avulsa ? null : { t:'Novo documento', ic:'docplus', fn:() => novoDocumento({}) },
    txt ? { t:'Nova página', ic:'blank', fn:() => novaPaginaNaMesa() } : null,
    { t:'Incluir PDF', ic:'clip', fn:() => incluirPdfNaMesa() },
    '-',
    txt ? { t:'Revisar o texto', ic:'sparkle', fn:() => revisarTudo(d) } : null,
    { t:'Selecionar folhas', ic:'selpg', fn:() => entrarSelecao(false, p.avulsa ? 'pdf' : 'folhas') },
    { t:ROL.on ? 'Parar a rolagem' : 'Rolar sozinho', ic:'chevD', on:ROL.on, fn:() => acao('rolar') },
    { t:'Buscar no texto', ic:'search', fn:() => buscarNoProcesso() },
    '-',
    { t:'Documentos', ic:'layers', fn:() => abrirPainel('esq') },
    proc ? { t:'Ficha do processo', ic:'pen', fn:() => fichaSheet(p) } : null,
    proc ? { t:'Notas e pendências', ic:'note', fn:() => abrirPainel('dir', 'notas') } : null,
    { t:'Esta página', ic:'doc', fn:() => abrirPainel('dir', 'pag') }
  ]);
}
function menuFerramentas(ancora){
  popMenu(ancora, [
    { t:'Copiar', ic:'copy', fn:() => acao('copiar') },
    { t:'Colar', ic:'paste', fn:() => acao('colar') },
    '-',
    { t:'Selecionar palavra', fn:() => acao('palavra') },
    { t:'Selecionar parágrafo', fn:() => acao('paragrafo') },
    { t:'Selecionar tudo', fn:() => acao('tudo') },
    '-',
    { t:'Marca-texto', ic:'highlighter', fn:() => acao('marca') },
    { t:'Formatar (negrito, lista…)', ic:'textsize', fn:() => acao('formatar') },
    { t:'Tabela', ic:'table', fn:() => acao('tabela') },
    { t:'Revisar este trecho', ic:'sparkle', fn:() => acao('revisar') },
    '-',
    M.zoom === 100 ? { t:'Letra maior', ic:'zoomIn', fn:() => setZoom(150) } : { t:'Letra no tamanho da folha', ic:'zoomOut', fn:() => setZoom(100) },
    { t:'Abrir o teclado', ic:'keyboard', fn:() => acao('teclado') }
  ]);
}


/* =====================================================================
   Signatário: um por documento, escolhido por você
   ===================================================================== */
function sigSheet(d){
  if(!d || d.kind !== 'texto') return;
  d.sig = d.sig || novoSig(null);
  const s0 = d.sig, p = procDoDoc(d);
  const st = { pessoa:s0.sem ? '__sem' : (s0.pessoa || ''), modo:s0.modo || 'eletronica', data:s0.data || hojeISO(), revit:!!s0.revit,
    vinculo:typeof s0.vinculo === 'string' ? s0.vinculo : s0.vinculo === false ? 'nenhum' : (p && !p.avulsa && !p.avdoc ? p.id : 'nenhum') };
  const grp = h('div', { class:'sgGrp' }), prev = h('div', { class:'sgPrev' });
  const val = (t, fn, ph) => { const b = h('button', { class:'sgRow', onclick:() => fn(b) }, h('span', null, t), h('span', { class:'v' }, h('span', null, ph), h('i', { html:I.chevD, style:{ display:'flex' } }))); return b; };
  const tmp = () => ({ pessoa:st.pessoa && st.pessoa !== '__sem' ? st.pessoa : null, sem:st.pessoa === '__sem', modo:st.modo, data:st.data, vinculo:st.vinculo === 'nenhum' ? false : st.vinculo, revit:st.revit });
  function pinta(){
    const pes = pessoaPorId(st.pessoa), q = st.vinculo !== 'nenhum' ? procPorId(st.vinculo) : null, temRevit = !!(q && revitTexto(q));
    const data = h('input', { type:'date', value:st.data, onchange:e => { st.data = e.target.value || hojeISO(); pinta(); } });
    const sw = h('label', { class:'sw' }, h('input', { type:'checkbox', checked:st.revit && temRevit, disabled:!temRevit, 'aria-label':'Usar o REVIT', onchange:e => { st.revit = e.target.checked; pinta(); } }), h('i'));
    grp.replaceChildren(
      val('Signatário', b => popMenu(b, settings.signatarios.map(x => ({ t:titleCase(x.nome), sub:x.cargo, on:st.pessoa === x.id, fn:() => { st.pessoa = x.id; pinta(); } })).concat(['-', { t:'Sem assinatura', sub:'anexo, planilha', on:st.pessoa === '__sem', fn:() => { st.pessoa = '__sem'; pinta(); } }])),
        st.pessoa === '__sem' ? 'Sem assinatura' : pes ? titleCase(pes.nome) : 'Escolher'),
      h('div', { class:'sgRow' }, h('span', null, 'Data'), data),
      val('Assinatura', b => popMenu(b, [['eletronica', 'Eletrônica'], ['fisica', 'Física (caneta)']].map(([k, t]) => ({ t, on:st.modo === k, fn:() => { st.modo = k; pinta(); } }))), st.modo === 'fisica' ? 'Física' : 'Eletrônica'),
      val('Processo', b => escolherProcTarja(b, st, pinta), q ? (q.ficha.num || 'sem número') : 'Nenhum'),
      h('div', { class:'sgRow' }, h('span', { style:{ color:temRevit ? '#000' : 'var(--faint)' } }, 'REVIT'), sw));
    const runs = st.pessoa === '__sem' ? null : tarjaRuns(Object.assign({}, d, { sig:tmp() }), p);
    prev.innerHTML = runs ? runsHTML(runs) : '<i>Sem tarja.</i>';
  }
  pinta();
  const s = sheet({ titulo:'Signatário', corpo:[grp, h('div', { class:'lbl', style:{ marginTop:'4px' } }, 'Tarja no pé do PDF'), prev,
    p && !p.avulsa && !p.avdoc ? h('div', { class:'sgGrp', style:{ marginTop:'6px' } }, h('button', { class:'sgRow', onclick:() => { s.fechar(); setTimeout(todosSigSheet, 60); } }, h('span', { style:{ color:'var(--accent)' } }, 'Todos os documentos'), h('span', { class:'v', html:I.chevR }))) : null],
    botoes:[{ t:'OK', v:'acc', fn:() => { d.sig = Object.assign({}, d.sig, tmp()); delete d.sig.carimbo; if(p) touch(p); saveDB(); if(VIEW === 'mesa') atualizarFecho(d); } }] });
}
/* processo citado na tarja: nenhum, o deste documento ou outro */
function escolherProcTarja(ancora, st, pinta){
  const todos = procsReais().sort((a, b) => b.updated - a.updated);
  const it = [{ t:'Nenhum', on:st.vinculo === 'nenhum', fn:() => { st.vinculo = 'nenhum'; st.revit = false; pinta(); } }, '-'];
  todos.slice(0, 6).forEach(q => it.push({ t:q.ficha.num || 'sem número', sub:(q.ficha.objeto || '').slice(0, 40), on:st.vinculo === q.id, fn:() => { st.vinculo = q.id; pinta(); } }));
  if(todos.length > 6) it.push('-', { t:'Outro processo…', fn:async () => { const v = await optSheet('Processo', [{ itens:todos.map(q => ({ v:q.id, t:q.ficha.num || 'sem número', sub:(q.ficha.objeto || '').slice(0, 50) })) }], st.vinculo); if(v){ st.vinculo = v; pinta(); } } });
  popMenu(ancora, it);
}
function todosSigSheet(){
  const p = M.p; if(!p) return;
  salvarTudo();
  const docs = p.docs.filter(d => d.linha && d.kind === 'texto'), N = numeracaoLinha(p);
  if(!docs.length) return toast('Este processo ainda não tem textos.');
  const sels = docs.map(d => h('select', { class:'sel', style:{ minHeight:'38px', padding:'6px 30px 6px 10px' } },
    h('option', { value:'' }, '— escolher —'), settings.signatarios.map(x => h('option', { value:x.id, selected:d.sig && d.sig.pessoa === x.id && !d.sig.sem }, titleCase(x.nome))), h('option', { value:'__sem', selected:!!(d.sig && d.sig.sem) }, 'Sem fecho')));
  const modos = docs.map(d => h('select', { class:'sel', style:{ minHeight:'38px', padding:'6px 30px 6px 10px', width:'auto' } }, h('option', { value:'eletronica', selected:!d.sig || d.sig.modo !== 'fisica' }, 'Eletrônica'), h('option', { value:'fisica', selected:!!(d.sig && d.sig.modo === 'fisica') }, 'Física')));
  const todos = h('select', { class:'sel' }, h('option', { value:'' }, 'Aplicar um signatário a todos…'), settings.signatarios.map(x => h('option', { value:x.id }, titleCase(x.nome))));
  todos.onchange = () => { if(todos.value) sels.forEach((s, i) => { if(!(docs[i].sig && docs[i].sig.sem)) s.value = todos.value; }); };
  sheet({ titulo:'Signatários do processo', cheio:true, corpo:[todos].concat(docs.map((d, i) => h('div', { class:'lrow', style:{ flexWrap:'wrap' } },
    h('span', { class:'nn' }, N[d.id] ? N[d.id].n : ''), h('span', { class:'tx' }, h('b', null, d.nome), h('span', null, TIPO_NOME[d.tipo] || 'Texto')),
    h('div', { class:'row', style:{ width:'100%', flexWrap:'nowrap' } }, sels[i], modos[i])))),
    botoes:[{ t:'Cancelar', v:'ghost' }, { t:'Aplicar', v:'acc', fn:() => {
      docs.forEach((d, i) => { const v = sels[i].value; d.sig = d.sig || novoSig(null); d.sig.sem = v === '__sem'; if(v && v !== '__sem') d.sig.pessoa = v; if(v === '') d.sig.pessoa = null; d.sig.modo = modos[i].value; if(d.sig.modo === 'fisica' && !d.sig.data) d.sig.data = hojeISO(); });
      touch(p); saveDB(); if(VIEW === 'mesa' && M.p === p) renderMesa(true); toast('Signatários aplicados.');
    } }] });
}

/* =====================================================================
   Revisão do texto inteiro: Atual × Revisado, parágrafo por parágrafo
   ===================================================================== */
const REV_TUDO = 'Você é revisor de documentos oficiais da Secretaria Municipal de Infraestrutura e Defesa Civil de Ilhéus (Bahia). Revise os parágrafos numerados abaixo: ortografia, acentuação, concordância, regência, crase, pontuação e clareza, em português do Brasil formal e impessoal. Não mude o sentido, os números, as datas, os nomes, os valores nem os marcadores entre colchetes como [^1]. Nunca use a palavra "tratativa(s)". Responda SOMENTE com os parágrafos que precisam de alguma mudança, cada um numa linha no formato [n] texto revisado completo. Se nada precisar mudar, responda apenas: SEM MUDANÇAS.';
function textoParaRevisao(b){
  const partes = [], map = [];
  const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode:n => n.nodeType === 1 ? (n.matches('sup.nr') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) : n.parentElement.closest('sup.nr') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n, k = 0;
  while((n = w.nextNode())){
    if(n.nodeType === 1){ k++; const t = '[^' + k + ']'; for(let i = 0; i < t.length; i++) map.push(null); partes.push(t); continue; }
    for(let i = 0; i < n.data.length; i++) map.push({ node:n, off:i });
    partes.push(n.data);
  }
  return { t:partes.join(''), map };
}
function tokens(s){ return s.split(/(\s+)/).filter(x => x !== ''); }
function difPalavras(a, b){
  const A = tokens(a), B = tokens(b), n = A.length, m = B.length;
  if(n * m > 250000) return [{ tipo:'troca', a:a, b:b, ia:0, ja:a.length }];
  const L = Array.from({ length:n + 1 }, () => new Uint16Array(m + 1));
  for(let i = n - 1; i >= 0; i--) for(let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = []; let i = 0, j = 0, pos = 0;
  const push = (tipo, ta, tb) => { const u = ops[ops.length - 1]; if(u && u.tipo !== 'igual' && tipo !== 'igual'){ u.a += ta; u.b += tb; u.ja += ta.length; u.tipo = 'troca'; return; } ops.push({ tipo, a:ta, b:tb, ia:pos, ja:pos + ta.length }); };
  while(i < n || j < m){
    if(i < n && j < m && A[i] === B[j]){ push('igual', A[i], A[i]); pos += A[i].length; i++; j++; }
    else if(j < m && (i === n || L[i][j + 1] >= L[i + 1][j])){ push('troca', '', B[j]); j++; }
    else { push('troca', A[i], ''); pos += A[i].length; i++; }
  }
  return ops;
}
function difHTML(ops){ return ops.map(o => o.tipo === 'igual' ? esc(o.a) : (o.a ? '<del>' + esc(o.a) + '</del>' : '') + (o.b ? '<ins>' + esc(o.b) + '</ins>' : '')).join(''); }
/* aplica as trocas direto nos pedaços de texto, preservando negrito, itálico e notas */
function aplicarRevisao(item){
  const ops = item.ops.filter(o => o.tipo !== 'igual'), map = item.map;
  for(let k = ops.length - 1; k >= 0; k--){
    const o = ops[k];
    if(map.slice(o.ia, o.ja).some(x => x === null)) continue;
    const r = document.createRange();
    if(o.ja > o.ia){ const a = map[o.ia], z = map[o.ja - 1]; if(!a || !z) continue; r.setStart(a.node, a.off); r.setEnd(z.node, z.off + 1); }
    else { const a = map[o.ia] || null, z = o.ia > 0 ? map[o.ia - 1] : null; if(a) r.setStart(a.node, a.off); else if(z) r.setStart(z.node, z.off + 1); else continue; r.collapse(true); }
    r.deleteContents();
    if(o.b) r.insertNode(document.createTextNode(o.b));
  }
  item.b.normalize();
}
async function revisarTudo(d){
  if(!d || d.kind !== 'texto') return toast('Vá até um texto para revisar.');
  const body = bodyDoDoc(d); if(!body) return;
  pararRolagem(); fecharTeclado();
  const bls = blocosDe(body).filter(b => !b.matches('p.bl,p.id,h1,.tmpP') && b.textContent.trim().length > 2);
  if(!bls.length) return toast('Não há parágrafos para revisar.');
  const itens = bls.map((b, i) => Object.assign({ b, n:i + 1 }, textoParaRevisao(b)));
  const st = h('div', { class:'muted', style:{ fontSize:'13px', minHeight:'18px' } }, 'Revisando ' + plural(itens.length, 'parágrafo', 'parágrafos') + '…');
  const lista = h('div', { style:{ display:'flex', flexDirection:'column', gap:'10px' } });
  let ctl = new AbortController(), achados = [];
  const s = sheet({ titulo:'Revisar o texto inteiro', cheio:true, aoFechar:() => ctl.abort(), corpo:[st, lista],
    botoes:[{ t:'Parar', v:'ghost', fica:true, fn:() => ctl.abort() }, { t:'Substituir todos', v:'acc', fica:true, fn:() => { let n = 0; achados.forEach(a => { if(!a.feito){ aplicarRevisao(a); a.feito = true; a.el.classList.add('feito'); n++; } }); fim(n); } }] });
  const fim = n => { if(!n) return toast('Nada para substituir.'); body.dispatchEvent(new Event('input')); toast(plural(n, 'parágrafo substituído', 'parágrafos substituídos') + '.'); if(achados.every(a => a.feito || a.ign)) s.fechar(); };
  /* manda em lotes de ~5.000 caracteres */
  const lotes = []; let cur = [], tam = 0;
  itens.forEach(it => { if(tam + it.t.length > 5000 && cur.length){ lotes.push(cur); cur = []; tam = 0; } cur.push(it); tam += it.t.length; });
  if(cur.length) lotes.push(cur);
  try{
    for(let k = 0; k < lotes.length; k++){
      st.textContent = 'Revisando' + (lotes.length > 1 ? ' parte ' + (k + 1) + ' de ' + lotes.length : '') + '…';
      const txt = lotes[k].map(it => '[' + it.n + '] ' + it.t.replace(/\s*\n\s*/g, ' ')).join('\n\n');
      const r = await iaPedir([{ role:'user', content:REV_TUDO + '\n\nPARÁGRAFOS:\n' + txt }], { signal:ctl.signal });
      const re = /\[(\d+)\]\s*([\s\S]*?)(?=\n\s*\[\d+\]|$)/g; let m;
      while((m = re.exec(r))){
        const it = itens[+m[1] - 1], nv = m[2].replace(/\s*\n\s*/g, ' ').trim();
        if(!it || !nv || nv === it.t.trim()) continue;
        const lead = it.t.match(/^\s*/)[0].length, orig = it.t.slice(lead).replace(/\s+$/, '');
        const ops = difPalavras(orig, nv).map(o => Object.assign(o, { ia:o.ia + lead, ja:o.ja + lead }));
        if(!ops.some(o => o.tipo !== 'igual')) continue;
        const item = Object.assign({}, it, { ops, nv });
        const el = h('div', { class:'rvItem' },
          h('div', { class:'lb' }, 'Parágrafo ' + it.n + ' · atual'), h('div', { class:'at', html:difHTML(ops.map(o => Object.assign({}, o, { b:'' }))) }),
          h('div', { class:'lb' }, 'Revisado'), h('div', { class:'nv', html:difHTML(ops.map(o => Object.assign({}, o, { a:o.tipo === 'igual' ? o.a : '' }))) }),
          h('div', { class:'row' },
            h('button', { class:'btn sm acc', onclick:() => { if(item.feito) return; aplicarRevisao(item); item.feito = true; el.classList.add('feito'); fim(1); } }, 'Substituir'),
            h('button', { class:'btn sm ghost', onclick:() => { item.ign = true; el.remove(); if(achados.every(a => a.feito || a.ign)) st.textContent = 'Pronto.'; } }, 'Ignorar'),
            h('button', { class:'btn sm ghost', onclick:() => { s.fechar(); const p = primeiroPonto(it.b); it.b.closest('.body').focus({ preventScroll:true }); window.getSelection().collapse(p.node, p.off); verFoco(); } }, 'Ver no texto')));
        item.el = el; achados.push(item); lista.append(el);
      }
    }
    st.textContent = achados.length ? plural(achados.length, 'parágrafo com sugestão', 'parágrafos com sugestão') + '. Vermelho sai, verde entra.' : 'Nenhuma mudança sugerida. O texto está bom.';
  }catch(e){ st.textContent = iaErro(e); }
}


/* ---------- pular campo: vai direto ao próximo [campo] a preencher, com o teclado aberto ---------- */
function camposNaMesa(){ return Array.from(pagesEl.querySelectorAll('.page.txt .body')).flatMap(b => Array.from(b.querySelectorAll('.campo, .fc.vazio'))); }
function proximoCampo(){
  const cs = camposNaMesa();
  if(!cs.length) return toast('Nenhum campo para preencher. Tudo preenchido.', { ms:1800 });
  const s = window.getSelection(); let alvo = null;
  if(s && s.rangeCount && curSel()){
    const r = s.getRangeAt(0);
    alvo = cs.find(c => { try{ return r.comparePoint(c, 0) === 1; }catch(e){ return false; } });
  } else {
    const y = docEl.getBoundingClientRect().top + 8;
    alvo = cs.find(c => c.getBoundingClientRect().top >= y);
  }
  if(!alvo){ alvo = cs[0]; toast('Voltei ao primeiro campo.', { ms:1100 }); }
  const body = alvo.closest('.body');
  body.focus({ preventScroll:true }); selecionarNo(alvo);
  modoTeclado(true); abrirTeclado(body);
  selecionarNo(alvo); verFoco();
  const rest = cs.length; toast(plural(rest, 'campo', 'campos') + ' para preencher.', { ms:1000 });
}
/* a cápsula de baixo sobe junto com o teclado */
if(window.visualViewport){
  const sobe = () => { const vv = window.visualViewport, k = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); $('aBot').style.bottom = k > 60 ? (k + 10) + 'px' : ''; };
  window.visualViewport.addEventListener('resize', sobe); window.visualViewport.addEventListener('scroll', sobe);
}

/* ===== h_rel.js ===== */
/* =====================================================================
   Relatório integrado do processo (prontuário): situação, ficha,
   pendências, definições, tramitação, repositório e documentos
   ===================================================================== */
let REL = null, relDe = 'home';
function abrirRel(p){
  if(VIEW === 'mesa') salvarTudo();
  relDe = VIEW === 'mesa' ? 'mesa' : 'home';
  REL = { id:p.id }; mostrar('rel'); renderRel(); $('vRel').querySelector('.scroll').scrollTop = 0;
  recontar(p).then(m => { if(m && VIEW === 'rel' && REL && REL.id === p.id) renderRel(); });
}
$('rBack').onclick = () => { if(relDe === 'mesa' && M.p){ mostrar('mesa'); renderMesa(true); } else { mostrar('home'); renderHome(); } };
$('rMesa').onclick = () => { const p = procPorId(REL && REL.id); if(p) abrirMesa(p); };
function secao(titulo, extra, ...kids){ return h('div', { class:'rsec' }, h('h3', null, h('span', null, titulo), extra || null), kids); }
function renderRel(){
  const p = procPorId(REL && REL.id); if(!p){ mostrar('home'); return; }
  $('rTit').replaceChildren(document.createTextNode(tituloProc(p)), h('small', null, objetoProc(p)));
  const b = $('relBody'); b.replaceChildren();
  const t = tramAtual(p), dias = t ? diasEntre(t.chegada, t.saida || null) : null;
  b.append(secao('Situação', h('button', { class:'btn sm', onclick:() => tramSheet(p) }, h('span', { html:I.route }), 'Tramitar'),
    h('div', { class:'rbox', style:{ display:'flex', flexDirection:'column', gap:'6px' } },
      h('div', { class:'row' }, chipStatus(p.status), h('span', { class:'muted', style:{ fontSize:'13px' } }, catName(p.cat))),
      t ? h('div', null, h('b', null, 'Está em ' + t.setor), h('div', { class:'muted', style:{ fontSize:'13.5px' } }, (t.acao ? t.acao + ' · ' : '') + 'chegou em ' + dataBR(t.chegada) + (dias != null ? ' (' + plural(Math.max(0, dias), 'dia', 'dias') + ')' : '') + (t.saida ? ' · saiu em ' + dataBR(t.saida) : ''))) : h('div', { class:'muted' }, 'Sem tramitação registrada.'))));
  const val = [['Valor atualizado', fichaValor(p, 'valorAtual')], ['Saldo', fichaValor(p, 'saldo')], ['Término previsto', fichaValor(p, 'termino') || fichaValor(p, 'vigencia')]];
  if(val.some(v => v[1])) b.append(h('div', { class:'stat', style:{ marginTop:'10px' } }, val.map(v => h('div', null, h('small', null, v[0]), h('b', null, v[1] || '—')))));
  const kv = h('dl', { class:'kv' });
  FICHA.forEach(([k, rot]) => { const v = fichaValor(p, k); if(v) kv.append(h('dt', null, rot), h('dd', null, v)); });
  (p.ficha.extras || []).forEach(e => { if(e.v) kv.append(h('dt', null, e.k), h('dd', null, e.v)); });
  b.append(secao('Ficha central', h('button', { class:'btn sm', onclick:() => fichaSheet(p) }, h('span', { html:I.pen }), 'Editar'), kv.children.length ? h('div', { class:'rbox' }, kv) : h('div', { class:'rbox muted' }, 'A ficha ainda está vazia. Preencha para os dados entrarem sozinhos nos documentos.')));
  const addNota = tipo => h('button', { class:'btn sm', onclick:() => novaNotaSheet(p, tipo) }, h('span', { html:I.plus }), 'Anotar');
  const abertas = pendAbertas(p), feitas = p.notas.filter(n => n.tipo === 'pend' && n.ok), defs = p.notas.filter(n => n.tipo === 'def'), notas = p.notas.filter(n => n.tipo === 'nota');
  b.append(secao('Pendências', addNota('pend'), h('div', { class:'rbox' }, abertas.length ? abertas.map(n => itemNota(p, n)) : h('div', { class:'muted' }, 'Sem pendências.'),
    feitas.length ? h('details', { style:{ marginTop:'8px' } }, h('summary', { class:'muted', style:{ cursor:'pointer', fontSize:'13px' } }, 'Resolvidas (' + feitas.length + ')'), feitas.map(n => itemNota(p, n))) : null)));
  b.append(secao('Definições e responsáveis', addNota('def'), h('div', { class:'rbox' }, defs.length ? defs.map(n => itemNota(p, n)) : h('div', { class:'muted' }, 'O que foi definido nas reuniões e quem ficou com cada tarefa.'))));
  if(notas.length) b.append(secao('Notas', addNota('nota'), h('div', { class:'rbox' }, notas.map(n => itemNota(p, n)))));
  const tt = h('table', { class:'ttab' }, h('tr', null, h('th', null, 'Setor'), h('th', null, 'Chegada'), h('th', null, 'Saída'), h('th', null, 'Dias')));
  p.tram.slice().reverse().forEach((x, i) => {
    const dd = diasEntre(x.chegada, x.saida || null);
    tt.append(h('tr', { class:i === 0 ? 'cur' : '', style:{ cursor:'pointer' }, onclick:() => tramSheet(p, x) }, h('td', null, h('b', null, x.setor), x.acao ? h('div', { class:'muted', style:{ fontSize:'12.5px' } }, x.acao) : null), h('td', null, dataBR(x.chegada)), h('td', null, dataBR(x.saida) || '—'), h('td', null, dd != null ? String(Math.max(0, dd)) : '')));
  });
  b.append(secao('Tramitação', h('button', { class:'btn sm', onclick:() => tramSheet(p) }, h('span', { html:I.plus }), 'Registrar'), h('div', { class:'rbox', style:{ padding:'6px 8px', overflowX:'auto' } }, p.tram.length ? tt : h('div', { class:'muted', style:{ padding:'6px' } }, 'Registre as entradas e saídas do processo para saber sempre onde ele está.'))));
  const F = folhas(p), linha = p.docs.filter(d => d.linha), repo = p.docs.filter(d => d.repo);
  b.append(secao('Linha do processo', h('span', { class:'muted', style:{ fontSize:'12.5px' } }, F._total ? plural(F._total, 'folha', 'folhas') : ''), h('div', { class:'rbox' }, linha.length ? linha.map(d => h('div', { class:'drow', style:{ cursor:'pointer' }, onclick:() => abrirMesa(p, { doc:d.id }) }, h('span', { class:'dash' }), h('div', { class:'nm' }, h('span', null, d.nome), h('small', null, (d.kind === 'pdf' ? 'PDF' : 'Texto') + (F[d.id] ? ' · fls. ' + F[d.id].ini + (F[d.id].k > 1 ? '–' + F[d.id].fim : '') : ''))))) : h('div', { class:'muted' }, 'Nenhum documento.'))));
  b.append(secao('Repositório do objeto', repo.length ? h('button', { class:'btn sm', onclick:() => compartilharRepo(p) }, h('span', { html:I.folderShare }), 'Compartilhar') : null, h('div', { class:'rbox' }, repo.length ? repo.map(d => h('div', { class:'drow' }, h('span', { class:'dash', style:{ background:'var(--accent)' } }), h('div', { class:'nm' }, h('span', null, d.nome), h('small', null, d.kind === 'pdf' ? 'PDF' : 'Texto')))) : h('div', { class:'muted' }, 'Vazio. Na mesa, marque “Repositório” nos documentos que vão para todo mundo.'))));
  b.append(secao('Gerar relatório', null, h('div', { class:'rbtns' },
    h('button', { class:'btn acc', onclick:() => relPdf(p, 'situacao') }, h('span', { html:I.pdf }), 'Situação'),
    h('button', { class:'btn acc', onclick:() => relPdf(p, 'completo') }, h('span', { html:I.pdf }), 'Completo'),
    h('button', { class:'btn', onclick:() => relPdf(p, 'tram') }, h('span', { html:I.route }), 'Tramitação'),
    h('button', { class:'btn', onclick:() => copiarTexto(relTexto(p, 'situacao'), 'Situação copiada. Cole no WhatsApp.') }, h('span', { html:I.whats }), 'WhatsApp'),
    h('button', { class:'btn', style:{ gridColumn:'1/-1' }, onclick:() => copiarTexto(relTexto(p, 'completo'), 'Relatório completo copiado.') }, h('span', { html:I.copy }), 'Copiar relatório completo'))));
}
function novaNotaSheet(p, tipo){
  const ta = h('textarea', { class:'txa', autofocus:true, placeholder:TIPO_NOTA[tipo] + '…' });
  const resp = h('input', { class:'inp', list:'dlResp2' }), prazo = h('input', { class:'inp', type:'date' });
  const nomes = Array.from(new Set(DB.procs.flatMap(q => q.notas.map(n => n.resp)).filter(Boolean).concat(SETORES)));
  sheet({ titulo:'Nova ' + TIPO_NOTA[tipo].toLowerCase(), corpo:[ta, tipo !== 'nota' ? h('div', { class:'fgrp' }, h('label', { class:'fld' }, h('span', null, 'Responsável'), resp), h('label', { class:'fld' }, h('span', null, 'Prazo'), prazo)) : null, h('datalist', { id:'dlResp2' }, nomes.map(n => h('option', { value:n })))],
    botoes:[{ t:'Cancelar', v:'ghost' }, { t:'Anotar', v:'pri', fn:() => { const t = ta.value.trim(); if(!t) return false; p.notas.push({ id:uid(), tipo, t, resp:resp.value.trim(), prazo:prazo.value, ok:false, criado:Date.now() }); touch(p); saveDB(true); renderRel(); } }] });
}

/* ---------- tramitação ---------- */
function tramSheet(p, x){
  const novo = !x;
  const ult = tramAtual(p);
  const setor = h('input', { class:'inp', list:'dlSet', value:x ? x.setor : '', autofocus:novo, placeholder:'Para onde foi / onde chegou' });
  const cheg = h('input', { class:'inp', type:'date', value:x ? x.chegada || '' : hojeISO() });
  const sai = h('input', { class:'inp', type:'date', value:x ? x.saida || '' : '' });
  const acao = h('input', { class:'inp', value:x ? x.acao || '' : '', placeholder:'Ex.: parecer jurídico, empenho, assinatura' });
  const st = h('select', { class:'sel' }, STATUS.map(s => h('option', { value:s, selected:p.status === s }, s)));
  const fecha = h('input', { type:'checkbox', checked:true });
  const corpo = [h('label', { class:'fld' }, h('span', null, 'Setor'), setor), h('datalist', { id:'dlSet' }, SETORES.map(s => h('option', { value:s }))),
    h('div', { class:'fgrp' }, h('label', { class:'fld' }, h('span', null, 'Chegada'), cheg), h('label', { class:'fld' }, h('span', null, 'Saída'), sai)),
    h('label', { class:'fld' }, h('span', null, 'O que fazer lá'), acao), h('label', { class:'fld' }, h('span', null, 'Situação do processo'), st)];
  if(novo && ult && !ult.saida) corpo.push(h('label', { class:'opt' }, fecha, h('span', null, 'Registrar a saída de ' + ult.setor + ' na mesma data')));
  sheet({ titulo:novo ? 'Registrar tramitação' : 'Tramitação', corpo,
    botoes:[novo ? { t:'Cancelar', v:'ghost' } : { t:'Excluir', v:'danger', fn:() => { p.tram = p.tram.filter(y => y !== x); saveDB(true); aposMudarProc(p); } },
      { t:'Salvar', v:'pri', fn:() => {
        if(!setor.value.trim()){ toast('Informe o setor.'); return false; }
        if(novo){ if(ult && !ult.saida && fecha.checked) ult.saida = cheg.value; p.tram.push({ id:uid(), setor:setor.value.trim(), chegada:cheg.value, saida:sai.value, acao:acao.value.trim() }); }
        else Object.assign(x, { setor:setor.value.trim(), chegada:cheg.value, saida:sai.value, acao:acao.value.trim() });
        p.status = st.value; touch(p); saveDB(true); aposMudarProc(p); if(VIEW === 'mesa' && M.painel) renderPainel(); toast('Tramitação registrada.');
      } }] });
}

/* ---------- relatórios em PDF e texto ---------- */
const agora = () => { const d = new Date(); return dataCurta(d) + ' às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const tabHTML = (cab, linhas, num) => '<table><tbody><tr>' + cab.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr>' + linhas.map(l => '<tr>' + l.map((c, i) => '<td' + (num && num.includes(i) ? ' class="n"' : '') + '>' + esc(c == null ? '' : c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
function relHTML(p, tipo){
  const t = tramAtual(p), pend = pendAbertas(p), defs = p.notas.filter(n => n.tipo === 'def'), notas = p.notas.filter(n => n.tipo === 'nota');
  const cab = '<p><strong>' + esc(tituloProc(p)) + '</strong> — ' + esc(objetoProc(p)) + '</p><p>Gerado em ' + agora() + '.</p>';
  const sit = '<p>Situação: <strong>' + esc(p.status) + '</strong>.' + (t ? ' Está em <strong>' + esc(t.setor) + '</strong> desde ' + dataBR(t.chegada) + (t.chegada ? ' (' + plural(Math.max(0, diasEntre(t.chegada, t.saida || null)), 'dia', 'dias') + ')' : '') + (t.saida ? ', saída em ' + dataBR(t.saida) : '') + '.' + (t.acao ? ' Providência: ' + esc(t.acao) + '.' : '') : ' Sem tramitação registrada.') + '</p>';
  const pendT = pend.length ? tabHTML(['Pendência', 'Responsável', 'Prazo'], pend.map(n => [n.t, n.resp || '—', n.prazo ? dataBR(n.prazo) : '—'])) : '<p>Sem pendências.</p>';
  const tramT = p.tram.length ? tabHTML(['Setor', 'Chegada', 'Saída', 'Dias', 'Providência'], p.tram.map(x => [x.setor, dataBR(x.chegada), dataBR(x.saida) || '—', x.chegada ? String(Math.max(0, diasEntre(x.chegada, x.saida || null))) : '', x.acao || '']), [3]) : '<p>Sem tramitação registrada.</p>';
  if(tipo === 'tram') return '<h1>TRAMITAÇÃO DO PROCESSO</h1>' + cab + '<h2>1. Situação atual</h2>' + sit + '<h2>2. Histórico</h2>' + tramT;
  if(tipo === 'situacao'){
    const ult = p.tram.slice(-3).reverse();
    return '<h1>RELATÓRIO DE SITUAÇÃO</h1>' + cab + '<h2>1. Situação atual</h2>' + sit + '<h2>2. Pendências</h2>' + pendT +
      (ult.length ? '<h2>3. Últimas movimentações</h2>' + tabHTML(['Setor', 'Chegada', 'Saída'], ult.map(x => [x.setor, dataBR(x.chegada), dataBR(x.saida) || '—'])) : '');
  }
  const ficha = FICHA.map(([k, rot]) => [rot, fichaValor(p, k)]).filter(x => x[1]).concat((p.ficha.extras || []).filter(e => e.v).map(e => [e.k, e.v]));
  const F = folhas(p), linha = p.docs.filter(d => d.linha), repo = p.docs.filter(d => d.repo);
  let n = 1; const H = t2 => '<h2>' + (n++) + '. ' + t2 + '</h2>';
  return '<h1>RELATÓRIO DO PROCESSO</h1>' + cab +
    H('Situação atual') + sit +
    (ficha.length ? H('Ficha central') + tabHTML(['Campo', 'Informação'], ficha) : '') +
    H('Pendências') + pendT +
    H('Definições e responsáveis') + (defs.length ? tabHTML(['Definição', 'Responsável', 'Data'], defs.map(x => [x.t, x.resp || '—', dataCurta(x.criado)])) : '<p>Nenhuma definição registrada.</p>') +
    (notas.length ? H('Notas') + '<ul>' + notas.map(x => '<li>' + esc(x.t) + '</li>').join('') + '</ul>' : '') +
    H('Tramitação') + tramT +
    H('Documentos do processo') + (linha.length ? tabHTML(['Folhas', 'Documento', 'Tipo'], linha.map(d => [F[d.id] ? F[d.id].ini + (F[d.id].k > 1 ? '–' + F[d.id].fim : '') : '', d.nome, d.kind === 'pdf' ? 'PDF' : 'Texto'])) : '<p>Nenhum documento.</p>') +
    (repo.length ? H('Repositório') + '<ul>' + repo.map(d => '<li>' + esc(d.nome) + '</li>').join('') + '</ul>' : '');
}
function relTexto(p, tipo){
  const t = tramAtual(p), pend = pendAbertas(p), L = [];
  L.push('*' + tituloProc(p) + '*', objetoProc(p), '');
  L.push('*Situação:* ' + p.status + (t ? ' · está em ' + t.setor + ' desde ' + dataBR(t.chegada) + (t.acao ? ' (' + t.acao + ')' : '') : ''));
  if(tipo === 'completo'){
    const ficha = FICHA.map(([k, rot]) => [rot, fichaValor(p, k)]).filter(x => x[1] && x[0] !== 'Objeto');
    if(ficha.length){ L.push('', '*Ficha*'); ficha.forEach(x => L.push('• ' + x[0] + ': ' + x[1])); }
  }
  L.push('', '*Pendências*');
  if(pend.length) pend.forEach(n => L.push('• ' + n.t + (n.resp ? ' — ' + n.resp : '') + (n.prazo ? ' (até ' + dataBR(n.prazo) + ')' : ''))); else L.push('Sem pendências.');
  if(tipo === 'completo'){
    const defs = p.notas.filter(n => n.tipo === 'def');
    if(defs.length){ L.push('', '*Definições*'); defs.forEach(n => L.push('• ' + n.t + (n.resp ? ' — ' + n.resp : ''))); }
    if(p.tram.length){ L.push('', '*Tramitação*'); p.tram.forEach(x => L.push('• ' + x.setor + ': ' + dataBR(x.chegada) + (x.saida ? ' a ' + dataBR(x.saida) : ' (atual)'))); }
  }
  return L.join('\n');
}
async function relPdf(p, tipo){
  if(!precisaLibs()) return;
  const b = busy('Gerando relatório…');
  try{
    const r = await PDFGen.texto(relHTML(p, tipo), { raw:true, bras:'primeira', title:'Relatório' });
    b.end();
    previa(r.bytes, safeName((tipo === 'situacao' ? 'Situação' : tipo === 'tram' ? 'Tramitação' : 'Relatório') + ' – ' + tituloProc(p), '.pdf'));
  }catch(e){ b.end(); console.error(e); toast('Não foi possível gerar o relatório.'); }
}
function relGeralHTML(ps){
  let h2 = '<h1>RELATÓRIO GERAL DOS OBJETOS</h1><p>Gerado em ' + agora() + '. ' + plural(ps.length, 'objeto', 'objetos') + '.</p>';
  h2 += tabHTML(['Processo', 'Objeto', 'Situação', 'Onde está', 'Pend.'], ps.map(p => [p.ficha.num || '—', p.ficha.objeto || '—', p.status, ondeEsta(p) || '—', String(pendAbertas(p).length)]), [4]);
  const comPend = ps.filter(p => pendAbertas(p).length);
  if(comPend.length){
    h2 += '<h2>Pendências por objeto</h2>';
    comPend.forEach(p => { h2 += '<p><strong>' + esc(tituloProc(p)) + '</strong> — ' + esc((p.ficha.objeto || '').slice(0, 120)) + '</p><ul>' + pendAbertas(p).map(n => '<li>' + esc(n.t) + (n.resp ? ' — ' + esc(n.resp) : '') + (n.prazo ? ' (até ' + dataBR(n.prazo) + ')' : '') + '</li>').join('') + '</ul>'; });
  }
  return h2;
}
function relGeralTexto(ps){
  const L = ['*Relatório geral dos objetos* — ' + agora(), ''];
  ps.forEach(p => { L.push('*' + tituloProc(p) + '* — ' + (p.ficha.objeto || '').slice(0, 90)); L.push(p.status + (ondeEsta(p) ? ' · ' + ondeEsta(p) : '')); pendAbertas(p).forEach(n => L.push('  • ' + n.t + (n.resp ? ' — ' + n.resp : ''))); L.push(''); });
  return L.join('\n');
}
async function relGeralPdf(ps){
  if(!precisaLibs()) return;
  if(!ps.length) return toast('Nenhum processo ainda.');
  const b = busy('Gerando relatório geral…');
  try{ const r = await PDFGen.texto(relGeralHTML(ps), { raw:true, bras:'primeira', title:'Relatório geral' }); b.end(); previa(r.bytes, safeName('Relatório geral dos objetos ' + hojeISO(), '.pdf')); }
  catch(e){ b.end(); toast('Não foi possível gerar o relatório.'); }
}

/* ===== i_ajustes.js ===== */
/* =====================================================================
   Ajustes: signatários, modelos, documentos, saída, IA, dados
   ===================================================================== */
function abrirAjustes(){
  const s = sheet({ titulo:'Ajustes', cheio:true, corpo:[] });
  const desenhar = () => {
    const c = s.corpo; c.replaceChildren();
    const item = (t, sub, fn, ic) => h('button', { class:'mitem', onclick:fn }, h('span', { html:I[ic || 'chev'] }), h('span', { class:'grow' }, t, sub ? h('small', null, sub) : null), h('span', { html:I.chev, style:{ color:'var(--faint)' } }));
    c.append(h('span', { class:'lbl' }, 'Documentos'),
      item('Signatários', settings.signatarios.map(x => x.nome).filter(Boolean).join(' · ') || 'Nenhum', () => signatariosSheet(desenhar), 'sig'),
      item('Modelos de documento', plural(modelos().length, 'modelo', 'modelos') + ' · despachos, CI, ofício, nota técnica, DFD, ETP, TR', () => modelosSheet(), 'doc'),
      item('Timbre e brasão', (settings.timbre === 'completo' ? 'Brasão com Estado e Prefeitura' : 'Só o brasão') + ' · textos novos: ' + ({ todas:'brasão em todas', primeira:'brasão na 1ª', nenhum:'sem brasão' })[settings.brasTexto], () => timbreSheet(desenhar), 'eye'),
      h('span', { class:'lbl', style:{ marginTop:'8px' } }, 'Saída de PDF'),
      item('Numeração das folhas', settings.numerar ? 'Numerar ao gerar o PDF' : 'Sem numeração', () => { settings.numerar = !settings.numerar; settings.carimbo = 'nenhum'; saveSettings(); desenhar(); }, 'hash'),
      h('span', { class:'lbl', style:{ marginTop:'8px' } }, 'Mesa'),
      item('Zoom ao abrir', settings.zoom + '% (o botão de zoom volta para este valor)', async () => { const v = await perguntar('Zoom ao abrir', 'Percentual', String(settings.zoom), 'Salvar', { tipo:'number' }); const n = parseInt(v, 10); if(n >= 50 && n <= 260){ settings.zoom = n; saveSettings(); desenhar(); } }, 'search'),
      item('Editar botões da mesa', 'Posição, tamanho, códigos e função de cada botão', () => { s.fechar(); const p = (DB.ui.proc && procPorId(DB.ui.proc)) || procsReais()[0] || procAvulsa(); abrirMesa(p); setTimeout(abrirEditor, 200); }, 'gear'),
      h('span', { class:'lbl', style:{ marginTop:'8px' } }, 'Revisão por inteligência artificial'),
      item('Revisão de texto (botão R)', iaResumo(), () => iaSheet(desenhar), 'sparkle'),
      h('span', { class:'lbl', style:{ marginTop:'8px' } }, 'Dados deste aparelho'),
      item('Fazer backup', 'Um arquivo ZIP com processos, textos, notas e PDFs', fazerBackup, 'dl'),
      item('Restaurar backup', 'Substitui tudo o que está neste aparelho', () => $('bkFile').click(), 'undo'),
      item('Importar do Proc.Ios 2', DB.importouV2 ? 'Já importado' : 'Traz os processos da versão anterior, se estiverem neste aparelho', async () => { if(DB.importouV2){ if(!await confirmar('Importar de novo', 'Os processos da versão anterior já foram importados. Importar de novo cria cópias.', 'Importar')) return; DB.importouV2 = false; } const n = await importarV2(); saveDB(true); toast(n ? plural(n, 'processo importado', 'processos importados') + '.' : 'Nada da versão anterior neste aparelho.'); if(n) renderHome(); desenhar(); }, 'layers'),
      h('p', { class:'muted', style:{ fontSize:'12.5px', margin:'10px 4px 0' } }, APP_NOME + ' ' + VERSAO_APP + '. ' + (PWA ? 'Tudo fica guardado neste celular e funciona sem internet.' : 'Tudo fica guardado neste navegador. Para usar sem internet, instale o app no celular.')));
  };
  desenhar();
}
function iaResumo(){ const ia = settings.ia; if(!PWA) return 'No Claude: usa a sua conta (' + (ia.tier === 'default' ? 'caprichada' : 'rápida') + ')'; if(ia.claudeKey && ia.prov !== 'gemini') return 'Claude · ' + ia.claudeModel; if(ia.geminiKey && ia.prov !== 'claude') return 'Gemini · ' + ia.geminiModel; return 'Sem chave: copia o texto e abre o Claude ou o Gemini'; }

/* ---------- signatários (com carimbo e autoridade competente) ---------- */
function signatariosSheet(volta){
  const lista = h('div', { style:{ display:'flex', flexDirection:'column', gap:'12px' } });
  const linhas = [];
  let autId = (settings.signatarios.find(x => x.autoridade) || {}).id;
  const pintaAut = () => linhas.forEach(r => r.aut.checked = r.id === autId);
  const add = s => {
    const r = { id:s.id || uid() };
    const nome = h('input', { class:'inp', value:s.nome || '', placeholder:'Nome completo' }), cargo = h('input', { class:'inp', value:s.cargo || '', placeholder:'Cargo' }), mat = h('input', { class:'inp', value:s.mat || '', placeholder:'Matrícula' });
    const aut = h('input', { type:'radio', name:'autSig', checked:r.id === autId, onchange:() => { autId = r.id; pintaAut(); } });
    const box = h('div', { class:'rbox', style:{ display:'flex', flexDirection:'column', gap:'8px' } },
      h('div', { class:'row' }, h('span', { class:'lbl grow' }, 'Signatário'), h('button', { class:'ib sm', html:I.trash, 'aria-label':'Remover', onclick:() => { box.remove(); linhas.splice(linhas.indexOf(r), 1); } })),
      nome, h('div', { class:'fgrp' }, cargo, mat),
      h('label', { class:'chk' }, aut, h('span', null, 'Autoridade competente (assina despachos decisórios, ofícios e DFD)')),
      null);
    Object.assign(r, { nome, cargo, mat, aut }); linhas.push(r); lista.append(box);
  };
  settings.signatarios.forEach(add);
  sheet({ titulo:'Signatários', cheio:true, corpo:[h('p', { class:'muted', style:{ margin:0, fontSize:'13px' } }, 'Cada documento tem um signatário, escolhido no botão de signatário da mesa. O nome sai em negrito no fecho e na tarja.'), lista, h('button', { class:'btn sm soft', style:{ alignSelf:'flex-start' }, onclick:() => add({}) }, h('span', { html:I.plus }), 'Signatário')],
    botoes:[{ t:'Cancelar', v:'ghost' }, { t:'Salvar', v:'pri', fn:() => {
      settings.signatarios = linhas.map(r => ({ id:r.id, nome:r.nome.value.trim(), cargo:r.cargo.value.trim(), mat:r.mat.value.trim(), autoridade:r.id === autId })).filter(x => x.nome || x.cargo);
      if(!settings.signatarios.length) settings.signatarios = SETTINGS_PADRAO().signatarios;
      saveSettings(); volta && volta(); if(VIEW === 'mesa') renderMesa(true); toast('Signatários salvos.');
    } }] });
}

/* ---------- modelos ---------- */
function modelosSheet(){
  const s = sheet({ titulo:'Modelos de documento', cheio:true, corpo:[] });
  const desenhar = () => {
    const ms = modelos(); s.corpo.replaceChildren(h('p', { class:'muted', style:{ margin:0, fontSize:'13px' } }, 'Cada linha vira um parágrafo. # título · = identificação (SEINFRA N.) · | linha do cabeçalho (De, Para, Assunto) · |+ linha com espaço antes · @data data do ofício · ## capítulo · > citação · --- quebra de página. {{marcador}} puxa da ficha; [texto] vira campo para preencher. O local, a data e a assinatura entram sozinhos no fim.'));
    GRUPOS_MODELO.concat(Array.from(new Set(ms.map(m => m.grupo))).filter(g => !GRUPOS_MODELO.includes(g))).forEach(g => {
      const doG = ms.filter(m => m.grupo === g); if(!doG.length) return;
      s.corpo.append(h('span', { class:'lbl' }, g));
      doG.forEach(m => s.corpo.append(h('button', { class:'mitem', onclick:() => editarModelo(m, desenhar) }, h('span', { html:I.doc }), h('span', { class:'grow' }, m.nome, h('small', null, m.desc || '')), h('span', { html:I.chev, style:{ color:'var(--faint)' } }))));
    });
    s.corpo.append(h('div', { class:'row', style:{ marginTop:'8px' } }, h('button', { class:'btn sm acc', onclick:() => editarModelo(null, desenhar) }, h('span', { html:I.plus }), 'Novo modelo'),
      h('button', { class:'btn sm danger', onclick:async () => { if(await confirmar('Restaurar modelos', 'Os modelos voltam ao original. Os que você criou ou mudou serão perdidos.', 'Restaurar', true)){ settings.modelos = null; saveSettings(); desenhar(); } } }, 'Restaurar originais')));
  };
  desenhar();
}
function editarModelo(m, volta){
  const novo = !m;
  const nome = h('input', { class:'inp', value:m ? m.nome : '', placeholder:'Ex.: Despacho de devolução' });
  const grupo = h('input', { class:'inp', list:'dlGr', value:m ? m.grupo : 'Despachos' });
  const desc = h('input', { class:'inp', value:m ? m.desc || '' : '' });
  const sig = h('select', { class:'sel' }, h('option', { value:'autoridade', selected:m && m.sig === 'autoridade' }, 'Autoridade competente'), settings.signatarios.map(x => h('option', { value:x.id, selected:(m ? m.sig : 's1') === x.id }, x.nome || x.id)), h('option', { value:'', selected:m && !m.sig }, 'Sem assinatura'));
  const tipo = h('select', { class:'sel' }, Object.keys(TIPO_NOME).map(k => h('option', { value:k, selected:(m ? m.tipo : 'desp') === k }, TIPO_NOME[k])));
  const texto = h('textarea', { class:'txa', style:{ minHeight:'260px', fontFamily:'var(--doc)', fontSize:'14px' } }, m ? m.texto : '# DESPACHO\n| **Referência:** Processo Administrativo nº {{processo}}\n[Texto.]');
  const marc = Object.keys(MARC_ROTULO).map(k => h('button', { class:'chip', style:{ border:0, height:'28px' }, onclick:() => { const a = texto.selectionStart, b = texto.selectionEnd, t = '{{' + k + '}}'; texto.setRangeText(t, a, b, 'end'); texto.focus(); } }, MARC_ROTULO[k]));
  sheet({ titulo:novo ? 'Novo modelo' : 'Modelo', cheio:true, corpo:[
    h('div', { class:'fgrp' }, h('label', { class:'fld w2' }, h('span', null, 'Nome'), nome), h('label', { class:'fld' }, h('span', null, 'Grupo'), grupo), h('label', { class:'fld' }, h('span', null, 'Assina'), sig), h('label', { class:'fld' }, h('span', null, 'Tipo'), tipo), h('label', { class:'fld' }, h('span', null, 'Descrição curta'), desc)),
    h('datalist', { id:'dlGr' }, GRUPOS_MODELO.map(g => h('option', { value:g }))),
    h('label', { class:'fld' }, h('span', null, 'Texto do modelo'), texto),
    h('span', { class:'lbl' }, 'Inserir dado da ficha'), h('div', { class:'row', style:{ gap:'6px' } }, marc)],
    botoes:[novo ? { t:'Cancelar', v:'ghost' } : { t:'Apagar', v:'danger', fn:async () => { if(!await confirmar('Apagar modelo', '“' + m.nome + '” sai da lista de novos documentos.', 'Apagar', true)) return false; settings.modelos = modelos().filter(x => x.id !== m.id); settings.modelosV = MODELOS_V; saveSettings(); volta(); } },
      { t:'Salvar', v:'pri', fn:() => {
        if(!nome.value.trim()){ toast('Dê um nome ao modelo.'); return false; }
        const ms = clone(modelos()), dados = { nome:nome.value.trim(), grupo:grupo.value.trim() || 'Outros', desc:desc.value.trim(), sig:sig.value || null, tipo:tipo.value, texto:texto.value };
        if(novo) ms.push(Object.assign({ id:uid() }, dados)); else Object.assign(ms.find(x => x.id === m.id), dados);
        settings.modelos = ms; settings.modelosV = MODELOS_V; saveSettings(); volta(); toast('Modelo salvo.');
      } }] });
}

/* ---------- timbre, carimbo, IA ---------- */
function timbreSheet(volta){
  const tim = h('select', { class:'sel' }, h('option', { value:'brasao', selected:settings.timbre === 'brasao' }, 'Só o brasão'), h('option', { value:'completo', selected:settings.timbre === 'completo' }, 'Brasão + Estado da Bahia / Prefeitura Municipal de Ilhéus'));
  const br = h('select', { class:'sel' }, [['todas', 'Brasão em todas as páginas'], ['primeira', 'Brasão só na 1ª página'], ['nenhum', 'Sem brasão']].map(o => h('option', { value:o[0], selected:settings.brasTexto === o[0] }, o[1])));
  const cid = h('input', { class:'inp', value:settings.cidade || '' });
  sheet({ titulo:'Timbre e brasão', corpo:[h('label', { class:'fld' }, h('span', null, 'Cabeçalho'), tim), h('label', { class:'fld' }, h('span', null, 'Textos novos'), br), h('label', { class:'fld' }, h('span', null, 'Cidade (datas dos documentos)'), cid)],
    botoes:[{ t:'Cancelar', v:'ghost' }, { t:'Salvar', v:'pri', fn:() => { settings.timbre = tim.value; settings.brasTexto = br.value; settings.cidade = cid.value.trim() || 'Ilhéus'; saveSettings(); volta(); if(VIEW === 'mesa') renderMesa(true); DB.procs.forEach(p => recontar(p, true)); } }] });
}
function iaSheet(volta){
  const ia = settings.ia;
  const prov = h('select', { class:'sel' }, [['auto', 'Automático (usa a chave que houver)'], ['claude', 'Claude'], ['gemini', 'Gemini']].map(o => h('option', { value:o[0], selected:ia.prov === o[0] }, o[1])));
  const tier = h('select', { class:'sel' }, [['quick', 'Rápida (modelo leve, tipo Haiku)'], ['default', 'Caprichada (modelo mais forte, tipo Sonnet)']].map(o => h('option', { value:o[0], selected:ia.tier === o[0] }, o[1])));
  const ck = h('input', { class:'inp', type:'password', value:ia.claudeKey || '', placeholder:'sk-ant-…', autocomplete:'off' }), cm = h('input', { class:'inp', value:ia.claudeModel || 'claude-haiku-4-5' });
  const gk = h('input', { class:'inp', type:'password', value:ia.geminiKey || '', placeholder:'AIza…', autocomplete:'off' }), gm = h('input', { class:'inp', value:ia.geminiModel || 'gemini-2.5-flash' });
  const pr = h('textarea', { class:'txa', style:{ minHeight:'200px', fontSize:'13.5px' } }, ia.prompt || REV_PROMPT);
  sheet({ titulo:'Revisão por IA', cheio:true, corpo:[
    h('p', { class:'muted', style:{ margin:0, fontSize:'13px' } }, PWA ? 'No app instalado, a revisão usa a sua chave de API (cobrada à parte da assinatura, poucos centavos por revisão). A chave fica só neste celular. Sem chave, o botão R copia o trecho e abre o Claude ou o Gemini.' : 'Aberto pelo Claude, a revisão usa a sua própria conta do Claude, sem chave. As chaves abaixo valem para o app instalado.'),
    h('label', { class:'fld' }, h('span', null, 'Modo da revisão'), tier),
    h('label', { class:'fld' }, h('span', null, 'Quem revisa no app instalado'), prov),
    h('div', { class:'fgrp' }, h('label', { class:'fld' }, h('span', null, 'Chave do Claude'), ck), h('label', { class:'fld' }, h('span', null, 'Modelo do Claude'), cm), h('label', { class:'fld' }, h('span', null, 'Chave do Gemini'), gk), h('label', { class:'fld' }, h('span', null, 'Modelo do Gemini'), gm)),
    h('label', { class:'fld' }, h('span', null, 'Prompt da revisão'), pr), h('button', { class:'btn sm soft', style:{ alignSelf:'flex-start' }, onclick:() => { pr.value = REV_PROMPT; } }, 'Voltar ao prompt padrão')],
    botoes:[{ t:'Cancelar', v:'ghost' }, { t:'Salvar', v:'pri', fn:() => { Object.assign(settings.ia, { prov:prov.value, tier:tier.value, claudeKey:ck.value.trim(), claudeModel:cm.value.trim() || 'claude-haiku-4-5', geminiKey:gk.value.trim(), geminiModel:gm.value.trim() || 'gemini-2.5-flash', prompt:pr.value.trim() || REV_PROMPT }); saveSettings(); volta(); toast('Ajustes da revisão salvos.'); } }] });
}

/* ---------- backup ---------- */
async function fazerBackup(){
  if(!window.JSZip) return toast('O gerador de ZIP ainda está carregando.');
  if(VIEW === 'mesa') salvarTudo();
  const b = busy('Preparando backup…');
  try{
    const zip = new JSZip();
    const cfg = clone(settings); cfg.ia = Object.assign({}, cfg.ia, { claudeKey:'', geminiKey:'' });
    zip.file('procios3.json', JSON.stringify({ app:'Proc.Ios', v:3, salvo:new Date().toISOString(), db:DB, settings:cfg }));
    const ids = new Set(DB.procs.flatMap(p => p.docs.filter(d => d.kind === 'pdf').map(d => d.fileId)));
    for(const id of ids){ const bytes = await bytesDe(id); if(bytes) zip.file('arquivos/' + id + '.pdf', bytes); }
    const blob = await zip.generateAsync({ type:'blob' }); b.end();
    offer(blob, 'Panda Backup ' + hojeISO() + '.zip');
  }catch(e){ b.end(); toast('Não foi possível gerar o backup.'); }
}
$('bkFile').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if(!file || !window.JSZip) return;
  let data, zip;
  try{ zip = await JSZip.loadAsync(file); }catch(err){ toast('Este arquivo não é um backup do Panda.'); return; }
  if(!zip.file('procios3.json') && zip.file('procios.json')){
    /* backup da versão 2: acrescenta os processos, sem apagar nada */
    try{
      const v2 = JSON.parse(await zip.file('procios.json').async('string'));
      if(!v2 || !v2.state || !Array.isArray(v2.state.procs)) throw new Error('formato');
      const meta = zip.file('anexos.json') ? JSON.parse(await zip.file('anexos.json').async('string')) : [];
      const porId = {}; meta.forEach(m => porId[m.id] = m);
      if(!await confirmar('Backup da versão anterior', 'O arquivo tem ' + plural(v2.state.procs.length, 'processo', 'processos') + ' do Proc.Ios 2. Eles serão acrescentados aos que já estão aqui.', 'Acrescentar')) return;
      const b = busy('Trazendo processos…');
      const n = await converterV2(v2.state, async id => { const zf = zip.file('anexos/' + id + '.pdf'); return zf ? { name:(porId[id] || {}).name || 'Arquivo', pl:(porId[id] || {}).pl, bytes:await zf.async('uint8array') } : null; });
      await saveDB(true); b.end();
      while(SHEETS.length) SHEETS[SHEETS.length - 1].fechar();
      mostrar('home'); renderHome(); toast(plural(n, 'processo trazido', 'processos trazidos') + ' da versão anterior.');
    }catch(err){ toast('Não foi possível ler o backup da versão anterior.'); }
    return;
  }
  try{ data = JSON.parse(await zip.file('procios3.json').async('string')); if(!data || data.app !== 'Proc.Ios' || !data.db || !Array.isArray(data.db.procs)) throw new Error('formato'); }
  catch(err){ toast('Este arquivo não é um backup do Panda.'); return; }
  if(!await confirmar('Restaurar backup', 'O backup tem ' + plural(data.db.procs.filter(p => !p.avulsa).length, 'processo', 'processos') + '. Tudo o que está neste aparelho será substituído.', 'Restaurar', true)) return;
  const b = busy('Restaurando…');
  try{
    /* 1º grava os arquivos do backup; só depois troca os dados; por fim apaga o que sobrou */
    const novos = new Set();
    for(const f of Object.values(zip.files)){ const m = f.name.match(/^arquivos\/(.+)\.pdf$/); if(!m) continue; b.txt('Restaurando ' + (novos.size + 1) + '…'); await guardarBytes(await f.async('uint8array'), m[1], m[1]); novos.add(m[1]); }
    const antigos = new Set(DB.procs.flatMap(p => p.docs.filter(d => d.kind === 'pdf').map(d => d.fileId)));
    DB = data.db; DB.ui = { tab:'procs' };
    for(const id of antigos) if(!novos.has(id)) await apagarBytes(id);
    if(data.settings){ const ia = settings.ia; settings = Object.assign(SETTINGS_PADRAO(), data.settings); settings.ia = Object.assign({}, data.settings.ia || {}, { claudeKey:ia.claudeKey, geminiKey:ia.geminiKey }); M.lay = null; saveSettings(); }
    migrarSettings(); migrarDB(); procAvulsa(); await saveDB(true); b.end();
    while(SHEETS.length) SHEETS[SHEETS.length - 1].fechar();
    mostrar('home'); renderHome(); toast('Backup restaurado.');
  }catch(err){ b.end(); toast('Não foi possível restaurar o backup.'); }
};

/* ===== j_init.js ===== */
/* =====================================================================
   Início do app, voltar do Android, arquivos recebidos pelo WhatsApp
   ===================================================================== */
const QP = new URLSearchParams(location.search);
$('hAjustes').innerHTML = I.gear; $('hAjustes').onclick = abrirAjustes;
$('rBack').innerHTML = I.back; $('pvBack').innerHTML = I.x;
$('hRapido').innerHTML = I.side; $('hRapido').onclick = abrirRapido;
$('hMais').innerHTML = I.plusBold; $('hMais').onclick = () => menuMais($('hMais'));
$('hScrim').onclick = fecharRapido;
$('pandaLogo').onclick = () => toast('Panda · ' + VERSAO_APP + ' · Secretaria Municipal de Infraestrutura e Defesa Civil de Ilhéus', { ms:2600 });

function voltar(){
  if(SHEETS.length){ fecharFolhaTopo(); return true; }
  if(!$('vPrev').hidden){ $('pvBack').click(); return true; }
  if(M.editing){ fecharEditor(); return true; }
  if(VIEW === 'home' && $('hPanel').classList.contains('open')){ fecharRapido(); return true; }
  if(VIEW === 'mesa'){
    if(M.fsel){ sairSelecao(); return true; }
    if(!$('fmt').hidden){ $('fmt').hidden = true; atualizarIcones(); return true; }
    if(M.painel){ fecharPainel(); return true; }
    if(ROL.on){ pararRolagem(); return true; }
    sairMesa(); return true;
  }
  if(VIEW === 'rel'){ $('rBack').click(); return true; }
  return false;
}
document.addEventListener('keydown', e => { if(e.key === 'Escape') voltar(); });

/* recebidos pelo menu Compartilhar do Android (app instalado) */
function inboxDb(fn){
  return new Promise(res => {
    try{
      const r = indexedDB.open('procios-inbox', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('inbox', { keyPath:'id', autoIncrement:true });
      r.onsuccess = () => { const tx = r.result.transaction('inbox', 'readwrite'), out = fn(tx.objectStore('inbox')); tx.oncomplete = () => res(out && out.result); tx.onerror = () => res(null); };
      r.onerror = () => res(null);
    }catch(err){ res(null); }
  });
}
let inboxOcupado = false;
async function processarInbox(){
  if(inboxOcupado || !DB) return; inboxOcupado = true;
  try{
    const recs = (await inboxDb(st => st.getAll())) || []; if(!recs.length) return;
    const arqs = recs.filter(r => r.blob), textos = recs.filter(r => r.text);
    const feitos = textos.map(r => r.id);
    const av = procAvulsa();
    if(arqs.length){
      if(!window.PDFLib || !window.JSZip) toast('Abra o app com internet uma vez para carregar as ferramentas de PDF.');
      else {
        feitos.push(...arqs.map(r => r.id));
        await inboxDb(st => { arqs.forEach(r => st.delete(r.id)); });
        await receberArquivos(arqs.map(r => new File([r.blob], r.name || 'arquivo.pdf', { type:r.type || r.blob.type || '' })));
      }
    }
    if(feitos.length) await inboxDb(st => { feitos.forEach(id => st.delete(id)); });
    const t = textos.map(r => r.text.trim()).filter(Boolean).join('\n\n');
    if(t){
      const d = criarTexto(av, null, 's1');
      d.html = mdParaHTML(t);
      d.nome = titleOf(d.html);
      saveDB(true); abrirMesa(av, { doc:d.id });
      toast('Texto recebido como texto pronto na mesa avulsa.');
    }
  } finally { inboxOcupado = false; }
}

/* ajustes de versões anteriores: signatários com carimbo e autoridade, nome da secretaria */
function migrarSettings(){
  const P = SETTINGS_PADRAO();
  if(!Array.isArray(settings.signatarios) || !settings.signatarios.length) settings.signatarios = P.signatarios;
  settings.signatarios.forEach(x => { if(x.carimbo == null) x.carimbo = ''; if(x.autoridade == null) x.autoridade = false; });
  if(!settings.signatarios.some(x => x.autoridade)){
    const s3 = P.signatarios.find(x => x.autoridade);
    const ja = settings.signatarios.find(x => norm(x.nome) === norm(s3.nome));
    if(ja) ja.autoridade = true; else settings.signatarios.push(Object.assign({}, s3, { id:settings.signatarios.some(x => x.id === s3.id) ? uid() : s3.id }));
  }
  if(!settings.orgao || /^secretaria (municipal )?de infraestrutura$/i.test(settings.orgao)) settings.orgao = P.orgao;
  if(!settings.sigla) settings.sigla = P.sigla;
  settings.carimbo = 'nenhum'; settings.signatarios.forEach(x => { delete x.carimbo; });
  if((settings.v || 0) < 4){ settings.v = 4; delete settings.sigLine; settings.timbre = 'completo'; }
  saveSettings();
}

/* ---------- partida ---------- */
(async function iniciar(){
  const ls = lsGet('settings', null);
  if(ls) settings = Object.assign(SETTINGS_PADRAO(), ls);
  const kv = await kvGet('settings');
  if(kv && (!ls || JSON.stringify(kv) !== JSON.stringify(ls))) settings = Object.assign(SETTINGS_PADRAO(), kv);
  settings.ia = Object.assign(SETTINGS_PADRAO().ia, settings.ia || {});
  migrarSettings();
  try{ DB = await kvGetStrict('db'); }
  catch(e){
    console.error(e); DB_ERRO = true; DB = { v:3, procs:[], ui:{ tab:'procs' } }; procAvulsa();
    mostrar('home'); renderHome();
    $('homeBody').prepend(h('div', { class:'rbox', style:{ borderColor:'#ecc9c5', background:'var(--danger-soft)', marginTop:'8px' } }, h('b', null, 'Não consegui ler os dados guardados neste aparelho.'), h('div', { style:{ fontSize:'13.5px' } }, 'Para não apagar nada, o app não vai gravar até ser reaberto. Feche e abra de novo.')));
    return;
  }
  if(!DB || !Array.isArray(DB.procs)){
    DB = { v:3, procs:[], ui:{ tab:'procs' } };
    let n = 0;
    try{ n = await importarV2(); }catch(e){ n = 0; }
    if(!n) DB = seedDB();
    await saveDB(true);
  }
  DB.ui = DB.ui || { tab:'procs' };
  DB.procs.forEach(p => { p.docs = p.docs || []; p.tram = p.tram || []; p.notas = p.notas || []; p.ficha = p.ficha || { extras:[] }; if(!p.ficha.extras) p.ficha.extras = []; });
  migrarDB(); procAvulsa();
  /* volta para onde você estava */
  const volta = DB.ui.view === 'mesa' && DB.ui.proc && procPorId(DB.ui.proc), docV = DB.ui.doc;
  mostrar('home'); renderHome();
  if(volta) abrirMesa(volta, { doc:docV && volta.docs.some(d => d.id === docV) ? docV : null });
  if(PWA){
    processarInbox();
    document.addEventListener('visibilitychange', () => { if(!document.hidden) processarInbox(); });
    if(QP.get('view') === 'otim') pdfMenu();
    if(QP.has('novo')) setTimeout(() => novoDocumento({}), 200);
  }
})();

if(PWA){
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__instalar = e; if(VIEW === 'home' && DB) renderHome(); });
  window.addEventListener('appinstalled', () => { window.__instalar = null; toast('Panda instalado.'); });
  history.replaceState({ root:1 }, '', location.pathname);
  history.pushState({ guarda:1 }, '');
  window.addEventListener('popstate', () => { if(voltar()) history.pushState({ guarda:1 }, ''); else history.back(); });
}

})();
