import { useEffect, type RefObject } from "react";

/**
 * Marks everything behind an open overlay as `inert` and `aria-hidden`.
 *
 * `aria-modal` tells a screen reader the dialog is modal, but on its own it
 * does not stop virtual-cursor browsing of the page underneath, and it does
 * nothing for pointer or Tab access. Marking the siblings inert does both,
 * and the browser handles it natively.
 *
 * Operates on the overlay's siblings rather than a fixed selector, so the
 * layout can be rearranged without silently breaking this.
 */
export function useInertBackground(
  active: boolean,
  overlayRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const overlay = overlayRef.current;
    const parent = overlay?.parentElement;
    if (!overlay || !parent) return;

    const siblings = Array.from(parent.children).filter(
      (el): el is HTMLElement => el !== overlay && el instanceof HTMLElement,
    );

    // Remember what was already set, so nesting or a re-render cannot leave
    // part of the page permanently hidden.
    const previous = siblings.map((el) => ({
      el,
      inert: el.hasAttribute("inert"),
      ariaHidden: el.getAttribute("aria-hidden"),
    }));

    siblings.forEach((el) => {
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    });

    return () => {
      previous.forEach(({ el, inert, ariaHidden }) => {
        if (!inert) el.removeAttribute("inert");
        if (ariaHidden === null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", ariaHidden);
      });
    };
  }, [active, overlayRef]);
}
