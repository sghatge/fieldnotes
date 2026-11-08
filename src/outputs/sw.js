// PuneStack Tools (Fieldnotes) service worker v4. Bump CACHE whenever app.js or styles.css change.
// Pages: network first, so updates show; falls back to cache when offline.
// Static assets: cache first. jsDelivr (speech test lab only): cached on first use so the lab works offline.
const CACHE='fieldnotes-v4',CDN_CACHE='fieldnotes-lab-cdn-v1';
const PRECACHE=['/','/styles.css','/icon.svg','/manifest.webmanifest','/app/','/app/app.js','/privacy/','/voicetask/','/callrecap/','/expenselens/','/fieldaudit/','/paperbrief/','/lab/speech-test/'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==CDN_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.origin===location.origin){
    if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('/app/'))));return}
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c))}return res})));return}
  if(u.hostname==='cdn.jsdelivr.net'){e.respondWith(caches.open(CDN_CACHE).then(c=>c.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res}))))}
});
