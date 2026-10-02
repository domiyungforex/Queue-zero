import "server-only";

export class RequestBodyTooLarge extends Error {}

/** Enforce a byte limit while reading, including requests without Content-Length. */
export async function readLimitedBody(request: Request, limit: number): Promise<string> {
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > limit) throw new RequestBodyTooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestBodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
