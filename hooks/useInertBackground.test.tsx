import { render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useInertBackground } from "./useInertBackground";

function Harness({ open }: { open: boolean }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useInertBackground(open, overlayRef);

  return (
    <div data-testid="frame">
      <header data-testid="header">nav</header>
      <main data-testid="main">market</main>
      {open && (
        <div ref={overlayRef} data-testid="overlay">
          dialog
        </div>
      )}
    </div>
  );
}

describe("useInertBackground", () => {
  it("does nothing while the overlay is closed", () => {
    const { getByTestId } = render(<Harness open={false} />);

    expect(getByTestId("header")).not.toHaveAttribute("inert");
    expect(getByTestId("main")).not.toHaveAttribute("aria-hidden");
  });

  it("marks every sibling inert and hidden while open", () => {
    const { getByTestId } = render(<Harness open />);

    ["header", "main"].forEach((id) => {
      expect(getByTestId(id)).toHaveAttribute("inert");
      expect(getByTestId(id)).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("leaves the overlay itself reachable", () => {
    const { getByTestId } = render(<Harness open />);

    expect(getByTestId("overlay")).not.toHaveAttribute("inert");
    expect(getByTestId("overlay")).not.toHaveAttribute("aria-hidden");
  });

  it("restores the page when the overlay closes", () => {
    const { getByTestId, rerender } = render(<Harness open />);
    expect(getByTestId("header")).toHaveAttribute("inert");

    rerender(<Harness open={false} />);

    expect(getByTestId("header")).not.toHaveAttribute("inert");
    expect(getByTestId("header")).not.toHaveAttribute("aria-hidden");
  });

  it("restores on unmount, so a route change cannot strand the page", () => {
    const { getByTestId, unmount } = render(<Harness open />);
    const header = getByTestId("header");

    unmount();
    expect(header).not.toHaveAttribute("inert");
  });

  // Otherwise closing one overlay would un-hide content another still covers.
  it("preserves attributes that were already set by something else", () => {
    function Pre({ open }: { open: boolean }) {
      const overlayRef = useRef<HTMLDivElement>(null);
      useInertBackground(open, overlayRef);
      return (
        <div>
          <aside data-testid="aside" inert aria-hidden="true">
            already hidden
          </aside>
          {open && <div ref={overlayRef}>dialog</div>}
        </div>
      );
    }

    const { getByTestId, rerender } = render(<Pre open />);
    rerender(<Pre open={false} />);

    expect(getByTestId("aside")).toHaveAttribute("inert");
    expect(getByTestId("aside")).toHaveAttribute("aria-hidden", "true");
  });

  it("does nothing when the overlay never mounts a node", () => {
    function Detached() {
      const ref = useRef<HTMLDivElement>(null);
      useInertBackground(true, ref);
      return <div data-testid="lonely">no overlay</div>;
    }

    expect(() => render(<Detached />)).not.toThrow();
  });
});
