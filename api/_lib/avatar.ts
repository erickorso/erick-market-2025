/** Pure validation for an avatar upload — no I/O, so it is cheap to test. */

/** Well past a camera capture downscaled for a profile picture. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type AvatarInput = { contentType: string; bytes: number };

/**
 * An upload endpoint takes bytes from a stranger, so what it accepts is the
 * whole security surface. The allow-list is by content type rather than by
 * extension, and it is an allow-list rather than a block-list: anything not
 * named here is refused, including the SVG that would otherwise be a script
 * served from our own domain.
 */
export function parseAvatar({ contentType, bytes }: AvatarInput) {
  const type = contentType.split(";")[0].trim().toLowerCase();
  const ext = ALLOWED.get(type);
  if (!ext) {
    throw Object.assign(new Error("Unsupported image type"), {
      status: 415,
      code: "unsupported_media_type",
    });
  }
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw Object.assign(new Error("Empty upload"), {
      status: 400,
      code: "empty_upload",
    });
  }
  if (bytes > MAX_AVATAR_BYTES) {
    throw Object.assign(new Error("Image too large"), {
      status: 413,
      code: "payload_too_large",
    });
  }
  return { contentType: type, ext };
}

/**
 * Where the object lives.
 *
 * Keyed by user id so one account cannot overwrite another's, and suffixed
 * with a stamp so a new photo gets a new URL — otherwise every client that
 * cached the old one would keep showing it.
 */
export function avatarKey(userId: string, ext: string, stamp: number) {
  return `avatars/${userId}/${stamp.toString(36)}.${ext}`;
}
