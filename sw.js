const V = "contei-v1";
const ARQ = ["./", "index.html", "estilo.css", "app.js", "manifest.json", "icone-192.png", "icone-512.png"];
self.addEventListener("install", function(e){
  e.waitUntil(caches.open(V).then(function(c){ return c.addAll(ARQ); }));
  self.skipWaiting();
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k !== V; }).map(function(k){ return caches.delete(k); }));
  }));
  self.clients.claim();
});
// rede primeiro (pega atualizações); sem internet usa o que está guardado
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function(r){
      var copia = r.clone();
      caches.open(V).then(function(c){ c.put(e.request, copia); });
      return r;
    }).catch(function(){
      return caches.match(e.request).then(function(m){ return m || caches.match("index.html"); });
    })
  );
});
