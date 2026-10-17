import { type RefObject, useEffect, useState } from "react";

/** Largura atual do elemento, para gráficos SVG que se ajustam ao contêiner. */
export function useElementWidth<T extends HTMLElement>(ref: RefObject<T | null>, fallback = 640) {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
