import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNearViewport } from "./useNearViewport";

type Callback = (entries: { isIntersecting: boolean }[]) => void;

/** Stands in for the browser's observer and records how it was set up. */
class FakeObserver {
  static last: FakeObserver | null = null;
  callback: Callback;
  options: IntersectionObserverInit;
  observed: Element[] = [];
  disconnected = false;
  constructor(callback: Callback, options: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeObserver.last = this;
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
}

function Probe() {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  return <div ref={ref}>{near ? "near" : "far"}</div>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeObserver.last = null;
});

describe("useNearViewport", () => {
  it("stays false until the element approaches, then true for good", () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<Probe />);
    expect(screen.getByText("far")).toBeInTheDocument();

    const observer = FakeObserver.last!;
    act(() => observer.callback([{ isIntersecting: false }]));
    expect(screen.getByText("far")).toBeInTheDocument();

    act(() => observer.callback([{ isIntersecting: true }]));
    expect(screen.getByText("near")).toBeInTheDocument();
    expect(observer.disconnected).toBe(true);
  });

  // The page scrolls inside a column: observing against the window would
  // clip cards to it before the margin could apply.
  it("observes against the nearest scroll root, ahead of time", () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const { container } = render(
      <div data-scroll-root>
        <Probe />
      </div>,
    );

    const observer = FakeObserver.last!;
    expect(observer.options.root).toBe(container.firstElementChild);
    expect(observer.options.rootMargin).toBe("200px");
  });

  it("uses the viewport when there is no scroll root", () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<Probe />);

    expect(FakeObserver.last!.options.root).toBeNull();
  });

  it("is true at once where IntersectionObserver does not exist", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);

    expect(screen.getByText("near")).toBeInTheDocument();
  });
});
