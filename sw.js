/* Proc.Ios — service worker: funciona offline e recebe arquivos compartilhados */
const VERSION = 'panda-v1-20260926-2246';
const SHELL = [
   "./",
   "./app.js",
   "./icons/apple-touch-icon.png",
   "./icons/favicon-64.png",
   "./icons/icon-192.png",
   "./icons/icon-512.png",
   "./icons/icon-maskable-512.png",
   "./index.html",
   "./manifest.webmanifest",
   "./vendor/fonts/LiberationSerif-Bold.ttf",
   "./vendor/fonts/LiberationSerif-BoldItalic.ttf",
   "./vendor/fonts/LiberationSerif-Italic.ttf",
   "./vendor/fonts/LiberationSerif-Regular.ttf",
   "./vendor/jszip.min.js",
   "./vendor/pdf-lib.min.js",
   "./vendor/pdf.min.mjs",
   "./vendor/pdf.worker.min.mjs",
   "./vendor/standard_fonts/FoxitDingbats.pfb",
   "./vendor/standard_fonts/FoxitFixed.pfb",
   "./vendor/standard_fonts/FoxitFixedBold.pfb",
   "./vendor/standard_fonts/FoxitFixedBoldItalic.pfb",
   "./vendor/standard_fonts/FoxitFixedItalic.pfb",
   "./vendor/standard_fonts/FoxitSerif.pfb",
   "./vendor/standard_fonts/FoxitSerifBold.pfb",
   "./vendor/standard_fonts/FoxitSerifBoldItalic.pfb",
   "./vendor/standard_fonts/FoxitSerifItalic.pfb",
   "./vendor/standard_fonts/FoxitSymbol.pfb",
   "./vendor/standard_fonts/LiberationSans-Bold.ttf",
   "./vendor/standard_fonts/LiberationSans-BoldItalic.ttf",
   "./vendor/standard_fonts/LiberationSans-Italic.ttf",
   "./vendor/standard_fonts/LiberationSans-Regular.ttf",
   "./vendor/wasm/jbig2.wasm",
   "./vendor/wasm/jbig2_nowasm_fallback.js",
   "./vendor/wasm/openjpeg.wasm",
   "./vendor/wasm/openjpeg_nowasm_fallback.js",
   "./vendor/wasm/qcms_bg.wasm"
  ];
const LIBS = [];
const RUNTIME_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    await Promise.all(LIBS.map(u => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function putInbox(records){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('procios-inbox', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('inbox', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => {
      const tx = req.result.transaction('inbox', 'readwrite');
      const st = tx.objectStore('inbox');
      records.forEach(r => st.add(r));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

async function receiveShare(request){
  try {
    const form = await request.formData();
    const records = [];
    for (const f of form.getAll('files')) {
      if (f && typeof f === 'object' && f.size) records.push({ name: f.name || 'arquivo', type: f.type || '', blob: f, at: Date.now() });
    }
    const text = [form.get('title'), form.get('text'), form.get('url')].filter(v => typeof v === 'string' && v.trim()).join('\n');
    if (!records.length && text) records.push({ text, at: Date.now() });
    if (records.length) await putInbox(records);
  } catch (e) {}
  return Response.redirect(new URL('./?inbox=1', self.registration.scope).href, 303);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/share-target')) {
    event.respondWith(receiveShare(req));
    return;
  }
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  if (url.origin === location.origin || RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      /* arquivos do próprio app: busca a versão nova quando há internet; sem internet usa a guardada */
      if (url.origin === location.origin) {
        try {
          const res = await fetch(req, { cache: 'no-cache' });
          if (res && res.ok) { const cache = await caches.open(VERSION); cache.put(req, res.clone()); }
          return res;
        } catch (e) { return hit || Response.error(); }
      }
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) {
          const cache = await caches.open(VERSION);
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        return hit || Response.error();
      }
    })());
  }
});
