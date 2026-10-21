/* Saves the Wyatt Croft site on the phone so Chrome can open it with no internet. */
const VERSION = "wc-offline-1";

const PRECACHE = [
  "./",
  "./index.html",
  "./offline.js",
  "./manifest.webmanifest",
  "./fonts/fonts.css",
  "./fonts/libre-baskerville-italic.woff2",
  "./fonts/libre-baskerville-400.woff2",
  "./fonts/libre-baskerville-700.woff2",
  "./fonts/rye-latin.woff2",
  "./fonts/source-serif-4-latin.woff2",
  "./album-one/",
  "./album-one/index.html",
  "./classic-home/",
  "./classic-home/index.html",
  "./songs/crofton-in-the-rearview/",
  "./songs/crofton-in-the-rearview/index.html",
  "./songs/fire-tower-rd/",
  "./songs/fire-tower-rd/index.html",
  "./songs/hard-row-to-hoe/",
  "./songs/hard-row-to-hoe/index.html",
  "./songs/porch-light-smoke/",
  "./songs/porch-light-smoke/index.html",
  "./songs/sleep-now-kentucky/",
  "./songs/sleep-now-kentucky/index.html",
  "./songs/tobacco-barn-light/",
  "./songs/tobacco-barn-light/index.html",
  "./songs/you-got-what-it-takes/",
  "./songs/you-got-what-it-takes/index.html",
  "./img/avatar.jpg",
  "./img/buggy-lane-poster.jpg",
  "./img/f10.jpg",
  "./img/f110.jpg",
  "./img/f130.jpg",
  "./img/f150.jpg",
  "./img/f30.jpg",
  "./img/f50.jpg",
  "./img/f70.jpg",
  "./img/f90.jpg",
  "./img/farmer-row-poster.jpg",
  "./img/hero.jpg",
  "./img/icon-192.png",
  "./img/icon-512.png",
  "./img/man-barn-night-poster.jpg",
  "./img/road.jpg",
  "./img/story.jpg",
  "./audio/crofton-in-the-rearview.mp3",
  "./audio/hard-row-to-hoe.mp3",
  "./audio/porch-light-smoke.mp3",
  "./audio/rolled-out-of-crofton.mp3",
  "./audio/sleep-now-kentucky.mp3",
  "./audio/tobacco-barn-light.mp3",
  "./audio/you-got-what-it-takes.mp3",
  "./clips/buggy-lane.mp4",
  "./clips/farmer-row.mp4",
  "./clips/man-barn-night.mp4",
  "./video/porch-light-smoke.mp4"
];

function abs(path) {
  return new URL(path, self.location).href;
}

function typeFor(pathname) {
  const path = pathname.toLowerCase();
  if (path.endsWith(".mp3")) return "audio/mpeg";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".webmanifest")) return "application/manifest+json";
  if (path.endsWith(".woff2")) return "font/woff2";
  if (path.endsWith(".html") || path.endsWith("/")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function ping(data) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  for (const client of clients) client.postMessage(Object.assign({ type: "wc-offline" }, data));
}

async function precache() {
  const cache = await caches.open(VERSION);
  const total = PRECACHE.length;
  for (let i = 0; i < total; i++) {
    const path = PRECACHE[i];
    const url = abs(path);
    await ping({ phase: "saving", done: i, total, path });
    const hit = await cache.match(url);
    if (hit) continue;
    const response = await fetch(url, { cache: "reload" });
    if (!response.ok) throw new Error(response.status + " " + path);
    await cache.put(url, response);
  }
  await ping({ phase: "ready", done: total, total });
  await self.skipWaiting();
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().catch(async (error) => {
    await ping({ phase: "error", message: String(error) });
    throw error;
  }));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function fullResponse(cached, url) {
  const headers = new Headers(cached.headers);
  const current = (headers.get("Content-Type") || "").toLowerCase();
  if (!current || current.startsWith("application/octet-stream") || current.startsWith("text/plain")) {
    headers.set("Content-Type", typeFor(url.pathname));
  }
  headers.set("Accept-Ranges", "bytes");
  return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
}

async function rangeResponse(cached, rangeHeader, url) {
  const body = await cached.blob();
  const size = body.size;
  const headersFor = (extra) => {
    const headers = {
      "Content-Type": typeFor(url.pathname),
      "Accept-Ranges": "bytes"
    };
    if (extra) Object.assign(headers, extra);
    return headers;
  };
  const match = /^bytes=(\d*)-(\d*)$/i.exec((rangeHeader || "").trim());
  if (!match || !size) {
    return new Response(body, { status: 200, statusText: "OK", headers: headersFor({ "Content-Length": String(size) }) });
  }
  let start = match[1] === "" ? NaN : Number(match[1]);
  let end = match[2] === "" ? size - 1 : Number(match[2]);
  if (match[1] === "" && match[2] !== "") {
    const last = Number(match[2]);
    start = Number.isFinite(last) ? Math.max(size - last, 0) : NaN;
    end = size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
    return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + size } });
  }
  end = Math.min(end, size - 1);
  const slice = body.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    statusText: "Partial Content",
    headers: headersFor({
      "Content-Range": "bytes " + start + "-" + end + "/" + size,
      "Content-Length": String(slice.size)
    })
  });
}

async function cachedPage(cache, url) {
  const tries = [url.href];
  if (url.pathname.endsWith("/")) tries.push(url.href + "index.html");
  else tries.push(url.href + "/", new URL("index.html", url.href).href);
  tries.push(abs("./index.html"), abs("./"));
  for (const item of tries) {
    const hit = await cache.match(item);
    if (hit) return fullResponse(hit, new URL(item));
  }
  return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(url.href);
    const page = request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");
    if (page) {
      try {
        const fresh = await fetchWithTimeout(request, 4000);
        if (fresh.ok && fresh.status === 200 && fresh.type === "basic") await cache.put(url.href, fresh.clone());
        return fresh;
      } catch (error) {
        if (cached) return fullResponse(cached, url);
        if (request.mode === "navigate") return cachedPage(cache, url);
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    }
    if (cached) {
      const range = request.headers.get("range");
      if (range) return rangeResponse(cached, range, url);
      return fullResponse(cached, url);
    }
    try {
      const fresh = await fetch(request);
      if (fresh.ok && fresh.status === 200 && fresh.type === "basic") await cache.put(url.href, fresh.clone());
      return fresh;
    } catch (error) {
      return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
