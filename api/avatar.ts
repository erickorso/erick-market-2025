import { put } from "@vercel/blob";
import { withAuth } from "./_lib/middleware.js";
import { setAvatarUrl } from "./_lib/store.js";
import { MAX_AVATAR_BYTES, avatarKey, parseAvatar } from "./_lib/avatar.js";

export const config = {
  api: {
    // The body is image bytes, not JSON. Without this the default parser
    // mangles them into a string before the handler ever sees them.
    bodyParser: false,
  },
};

async function readBody(req: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    // Checked while reading, not after: waiting until the end would mean
    // buffering whatever someone decided to send us.
    if (total > MAX_AVATAR_BYTES) {
      throw Object.assign(new Error("Image too large"), {
        status: 413,
        code: "payload_too_large",
      });
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export default withAuth(async (req, res, { user }) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(503).json({
      error: "Image storage is not configured",
      code: "storage_not_configured",
    });
    return;
  }

  const body = await readBody(req as unknown as NodeJS.ReadableStream);
  const { contentType, ext } = parseAvatar({
    contentType: String(req.headers["content-type"] ?? ""),
    bytes: body.length,
  });

  const blob = await put(avatarKey(user.id, ext, Date.now()), body, {
    access: "public",
    contentType,
  });

  // The row stores the URL, never the bytes. The database is shared with
  // another application; growing it with images would be somebody else's
  // problem as much as ours.
  const updated = await setAvatarUrl(user.id, blob.url);
  res.status(200).json({ user: updated });
});
