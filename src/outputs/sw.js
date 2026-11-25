// PuneStack Tools (Fieldnotes) service worker v5.
// Keep paths relative to the registered scope so the app works at both a domain root and a GitHub Pages project path.
const BASE = new URL(self.registration.scope);
const CACHE='fieldnotes-v5',CDN_CACHE='fieldnotes-lab-cdn-v1';
const PATHS=['','styles.css','icon.svg','manifest.webmanifest','app/','app/app.js','privacy/','voicetask/','callrecap/','expenselens/','fieldaudit/','paperbrief/','lab/speech-test/'];
const PRECACHE=PATHS.map(path=>new URL(path,BASE).pathname);
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==CDN_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.origin===location.origin&&u.pathname.startsWith(BASE.pathname)){
    if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match(new URL('app/',BASE).pathname)))));return}
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c))}return res})));return}
  if(u.hostname==='cdn.jsdelivr.net'){e.respondWith(caches.open(CDN_CACHE).then(c=>c.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res}))))}
});
