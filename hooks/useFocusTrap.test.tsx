import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useFocusTrap } from "./useFocusTrap";

function Dialog({ active }: { active: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(active);
  if (!active) return null;
  return (
    <div ref={ref} role="dialog" tabIndex={-1}>
      <button type="button">first</button>
      <button type="button">middle</button>
      <button type="button">last</button>
    </div>
  );
}

function Harness({ open }: { open: boolean }) {
  return (
    <>
      <button type="button">opener</button>
      <Dialog active={open} />
      <button type="button">outside</button>
    </>
  );
}

describe("useFocusTrap", () => {
  it("moves focus into the dialog when it opens", () => {
    render(<Harness open />);
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("wraps from the last control back to the first", async () => {
    render(<Harness open />);

    screen.getByRole("button", { name: "last" }).focus();
    await userEvent.tab();

    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
  });

  it("wraps backwards from the first control to the last", async () => {
    render(<Harness open />);

    screen.getByRole("button", { name: "first" }).focus();
    await userEvent.tab({ shift: true });

    expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
  });

  it("never lands on controls outside the dialog", async () => {
    render(<Harness open />);
    const outside = screen.getByRole("button", { name: "outside" });

    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(outside).not.toHaveFocus();
    }
  });

  it("returns focus to the opener on close", async () => {
    const { rerender } = render(<Harness open={false} />);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();

    rerender(<Harness open />);
    expect(screen.getByRole("dialog")).toHaveFocus();

    rerender(<Harness open={false} />);
    expect(opener).toHaveFocus();
  });

  it("does nothing while inactive", () => {
    render(<Harness open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
  });
});
