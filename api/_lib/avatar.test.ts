import { describe, expect, it } from "vitest";
import { MAX_AVATAR_BYTES, avatarKey, parseAvatar } from "./avatar";

const ok = { contentType: "image/jpeg", bytes: 1000 };

describe("parseAvatar", () => {
  it("accepts a JPEG from the camera", () => {
    expect(parseAvatar(ok)).toEqual({ contentType: "image/jpeg", ext: "jpg" });
  });

  it.each([
    ["image/png", "png"],
    ["image/webp", "webp"],
  ])("accepts %s", (type, ext) => {
    expect(parseAvatar({ ...ok, contentType: type }).ext).toBe(ext);
  });

  it("ignores charset and casing the client tacks on", () => {
    expect(
      parseAvatar({ ...ok, contentType: "IMAGE/JPEG; charset=binary" }),
    ).toMatchObject({ contentType: "image/jpeg" });
  });

  // An allow-list, not a block-list: the danger is the type nobody thought of.
  // image/svg+xml is the classic — a script served from our own domain.
  it.each([
    ["image/svg+xml"],
    ["text/html"],
    ["application/octet-stream"],
    [""],
  ])("refuses %s", (type) => {
    expect(() => parseAvatar({ ...ok, contentType: type })).toThrow(
      /Unsupported/,
    );
  });

  it("refuses an unsupported type with 415, not a generic error", () => {
    try {
      parseAvatar({ ...ok, contentType: "image/gif" });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as { status?: number }).status).toBe(415);
    }
  });

  it("refuses an empty body", () => {
    expect(() => parseAvatar({ ...ok, bytes: 0 })).toThrow(/Empty/);
  });

  it("accepts a file right at the ceiling", () => {
    expect(() => parseAvatar({ ...ok, bytes: MAX_AVATAR_BYTES })).not.toThrow();
  });

  it("refuses one byte over it, with 413", () => {
    try {
      parseAvatar({ ...ok, bytes: MAX_AVATAR_BYTES + 1 });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as { status?: number }).status).toBe(413);
    }
  });
});

describe("avatarKey", () => {
  // Keyed by user id, so one account cannot write over another's photo.
  it("scopes the object to its owner", () => {
    expect(avatarKey("u1", "jpg", 0)).toMatch(/^avatars\/u1\//);
    expect(avatarKey("u2", "jpg", 0)).not.toContain("/u1/");
  });

  // A stable key would keep serving the old face from every CDN and client
  // cache that already fetched it.
  it("gives a new photo a new key", () => {
    expect(avatarKey("u1", "jpg", 1)).not.toBe(avatarKey("u1", "jpg", 2));
  });

  it("keeps the extension the content type implied", () => {
    expect(avatarKey("u1", "webp", 0)).toMatch(/\.webp$/);
  });
});
