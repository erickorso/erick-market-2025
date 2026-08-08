import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketBackground from "./MarketBackground";

const reduced = vi.hoisted(() => ({ value: false }));
const sceneMounted = vi.hoisted(() => ({ count: 0 }));

vi.mock("../../hooks/useReducedMotion", () => ({
  useReducedMotion: () => reduced.value,
}));

vi.mock("./ThreeDBackground", () => ({
  default: () => {
    sceneMounted.count += 1;
    return <div data-testid="scene" />;
  },
}));

beforeEach(() => {
  reduced.value = false;
  sceneMounted.count = 0;
});

describe("MarketBackground", () => {
  it("mounts the scene when motion is welcome", async () => {
    render(<MarketBackground />);
    expect(await screen.findByTestId("scene")).toBeInTheDocument();
  });

  it("renders nothing at all when reduced motion is requested", () => {
    reduced.value = true;
    const { container } = render(<MarketBackground />);

    expect(container).toBeEmptyDOMElement();
  });

  // Skipping the render also skips the lazy chunk — ~475 kB the visitor who
  // asked for less motion never has to download.
  it("does not even load the chunk under reduced motion", async () => {
    reduced.value = true;
    render(<MarketBackground />);

    await waitFor(() => expect(sceneMounted.count).toBe(0));
  });

  it("survives the scene throwing, since it is only decoration", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.doMock("./ThreeDBackground", () => ({
      default: () => {
        throw new Error("WebGL unavailable");
      },
    }));

    const { container } = render(
      <div>
        <MarketBackground />
        <p>market still here</p>
      </div>,
    );

    await waitFor(() =>
      expect(container).toHaveTextContent("market still here"),
    );
  });
});
