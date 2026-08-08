import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPromptProvider, useAuthPrompt } from "./AuthPromptContext";

const login = vi.hoisted(() => vi.fn());

vi.mock("./UserContext", () => ({
  useUser: () => ({ login }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthPromptProvider>{children}</AuthPromptProvider>
);

beforeEach(() => {
  login.mockReset();
});

describe("AuthPromptContext", () => {
  it("asks nothing until something requests it", () => {
    const { result } = renderHook(() => useAuthPrompt(), { wrapper });
    expect(result.current.reason).toBeNull();
  });

  // The whole point: clicking Buy must not throw the user out to Auth0.
  it("does not redirect when a login is requested", () => {
    const { result } = renderHook(() => useAuthPrompt(), { wrapper });

    act(() => result.current.requestLogin("trade"));

    expect(result.current.reason).toBe("trade");
    expect(login).not.toHaveBeenCalled();
  });

  it("redirects only once the user agrees", () => {
    const { result } = renderHook(() => useAuthPrompt(), { wrapper });

    act(() => result.current.requestLogin("trade"));
    act(() => result.current.confirm());

    expect(login).toHaveBeenCalledTimes(1);
    expect(result.current.reason).toBeNull();
  });

  it("leaves the user where they were when they decline", () => {
    const { result } = renderHook(() => useAuthPrompt(), { wrapper });

    act(() => result.current.requestLogin("trade"));
    act(() => result.current.dismiss());

    expect(login).not.toHaveBeenCalled();
    expect(result.current.reason).toBeNull();
  });

  it("carries the reason, so the dialog can explain itself", () => {
    const { result } = renderHook(() => useAuthPrompt(), { wrapper });

    act(() => result.current.requestLogin("sessionExpired"));
    expect(result.current.reason).toBe("sessionExpired");
  });

  it("lets a later request replace an earlier one", () => {
    const { result } = renderHook(() => useAuthPrompt(), { wrapper });

    act(() => result.current.requestLogin("trade"));
    act(() => result.current.requestLogin("sessionExpired"));

    expect(result.current.reason).toBe("sessionExpired");
  });

  it("refuses to be used outside its provider", () => {
    expect(() => renderHook(() => useAuthPrompt())).toThrow(
      /AuthPromptProvider/,
    );
  });
});
