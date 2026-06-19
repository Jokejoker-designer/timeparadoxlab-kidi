/**
 * useElementSize — measure a container with ResizeObserver so canvases/3D views
 * can size to the available width (wide-layout patch). Falls back gracefully if
 * ResizeObserver is unavailable.
 */
import { useEffect, useRef, useState } from 'react';

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 600, height: 420 });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      setSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(280, Math.floor(rect.height)),
      });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}
