const CACHE = 'magic-river-v01';
const FILES = [
  './','index.html','style.css','game.js','manifest.json',
  'assets/images/river_scene.png','assets/images/animals.png',
  'assets/sounds/pixel_hunt_rush.ogg','assets/sounds/gunshot_pro.ogg',
  'assets/sounds/duck.ogg','assets/sounds/splat.ogg','assets/sounds/moose.ogg',
  'assets/sounds/squeek.ogg','assets/sounds/victory.ogg',
  'icons/icon-192.png','icons/icon-512.png'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
