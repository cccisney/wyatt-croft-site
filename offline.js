(function () {
  if (!("serviceWorker" in navigator)) return;
  var src = document.currentScript && document.currentScript.src;
  var root = new URL("./", src || location.href);
  navigator.serviceWorker.register(new URL("sw.js", root).href);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

  function pill(text, hold) {
    var el = document.getElementById("wc-offline");
    if (!el) {
      el = document.createElement("div");
      el.id = "wc-offline";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;left:50%;top:calc(52px + env(safe-area-inset-top));transform:translateX(-50%);z-index:80;background:rgba(23,18,13,.94);color:#f3e7d3;border:1px solid #4a3826;border-radius:999px;padding:7px 12px;font:600 12px/1.3 Georgia,serif;pointer-events:none;max-width:92vw;text-align:center";
      (document.body || document.documentElement).appendChild(el);
    }
    el.hidden = false;
    el.textContent = text;
    clearTimeout(el._hide);
    if (!hold) el._hide = setTimeout(function () { el.hidden = true; }, 5000);
  }

  navigator.serviceWorker.addEventListener("message", function (event) {
    var data = event.data || {};
    if (data.type !== "wc-offline") return;
    if (data.phase === "saving") {
      var name = String(data.path || "").split("/").filter(function (part) { return part && part !== "."; }).pop() || "the site";
      pill("Saving " + name + " on this phone…", true);
    } else if (data.phase === "ready") {
      pill("Saved on this phone. It plays with no internet.");
    } else if (data.phase === "error") {
      pill("Could not save this phone copy. Open the site once while online.");
    }
  });
})();
