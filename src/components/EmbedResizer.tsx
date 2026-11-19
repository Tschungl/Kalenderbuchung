"use client";

import { useEffect } from "react";

/** Meldet der einbettenden Seite die Höhe, damit der iframe ohne Scrollbalken passt. */
export function EmbedResizer() {
  useEffect(() => {
    if (window.parent === window) return;
    const el = document.querySelector<HTMLElement>(".branded") ?? document.body;
    const post = () =>
      window.parent.postMessage({ type: "kalender:resize", height: el.getBoundingClientRect().height }, "*");
    const ro = new ResizeObserver(post);
    ro.observe(el);
    post();
    return () => ro.disconnect();
  }, []);
  return null;
}
