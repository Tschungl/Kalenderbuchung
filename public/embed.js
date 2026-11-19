/*
 * Einbettung der Buchungsseite auf fremden Webseiten.
 *
 *   <div data-kalender="organisation/meeting-typ"></div>
 *   <script src="https://<app>/embed.js" async></script>
 *
 * Popup-Variante: <a href="https://<app>/organisation/meeting-typ" data-kalender-popup>Termin buchen</a>
 * Nach einer Buchung wird auf window das Ereignis "kalender:booked" ausgelöst (detail: { start, event }).
 */
(function () {
  if (window.__kalenderEmbed) return;
  window.__kalenderEmbed = true;

  var script = document.currentScript || document.querySelector('script[src*="embed.js"]');
  var base = new URL(script.src).origin;
  var frames = [];

  function makeFrame(path) {
    var iframe = document.createElement("iframe");
    iframe.src = base + "/embed/" + path.replace(/^\/+/, "");
    iframe.title = "Terminbuchung";
    iframe.loading = "lazy";
    iframe.style.cssText = "width:100%;border:0;min-height:600px;display:block;background:transparent";
    iframe.setAttribute("allow", "clipboard-write");
    frames.push(iframe);
    return iframe;
  }

  function mountInline() {
    document.querySelectorAll("[data-kalender]:not([data-kalender-mounted])").forEach(function (el) {
      el.setAttribute("data-kalender-mounted", "1");
      el.appendChild(makeFrame(el.getAttribute("data-kalender")));
    });
  }

  function openPopup(path) {
    var overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px";
    var box = document.createElement("div");
    box.style.cssText = "position:relative;width:100%;max-width:960px;background:#fff;border-radius:12px;overflow:hidden;padding-top:36px";
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Schließen");
    close.textContent = "×";
    close.style.cssText =
      "position:absolute;top:6px;right:10px;font-size:28px;line-height:1;border:0;background:none;cursor:pointer;color:#475569;z-index:1";
    function remove() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") remove();
    }
    close.onclick = remove;
    overlay.onclick = function (e) {
      if (e.target === overlay) remove();
    };
    document.addEventListener("keydown", onKey);
    box.appendChild(close);
    box.appendChild(makeFrame(path));
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("[data-kalender-popup]");
    if (!link) return;
    e.preventDefault();
    var target = link.getAttribute("data-kalender-popup") || new URL(link.href, location.href).pathname;
    openPopup(target);
  });

  window.addEventListener("message", function (e) {
    if (e.origin !== base || !e.data || typeof e.data.type !== "string") return;
    var frame = frames.find(function (f) {
      return f.contentWindow === e.source;
    });
    if (!frame) return;
    if (e.data.type === "kalender:resize" && typeof e.data.height === "number") {
      frame.style.minHeight = "0";
      frame.style.height = Math.max(300, Math.ceil(e.data.height)) + "px";
    } else if (e.data.type === "kalender:booked") {
      window.dispatchEvent(new CustomEvent("kalender:booked", { detail: { start: e.data.start, event: e.data.event } }));
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountInline);
  else mountInline();
})();
