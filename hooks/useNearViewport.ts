import { useEffect, useRef, useState } from "react";

/**
 * True once the element has come within `margin` of the visible area — and
 * true from then on. For deferring work a user may never scroll to.
 *
 * Measured: drawing all ten catalog charts on load is one ~1 s main-thread
 * task on a throttled phone, while a phone shows one or two cards. Charts now
 * draw as their card approaches.
 *
 * The page scrolls inside the centre column, not the window; observing
 * against the window would clip cards to that column before the margin could
 * apply, so the nearest `[data-scroll-root]` is the root when there is one.
 * Without IntersectionObserver (old browsers, jsdom) it is true at once.
 */
export function useNearViewport<T extends Element>(margin = "200px") {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { root: el.closest("[data-scroll-root]"), rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near, margin]);

  return [ref, near] as const;
}
