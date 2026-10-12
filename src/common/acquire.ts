export const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 5000;
type ReadOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
  fetcher?: typeof fetch;
};
/** Race the entire operation, including body reads, against cancellation/deadline.
 * A transport that ignores AbortSignal still cannot keep the caller pending. */
async function bounded<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let reject!: (error: Error) => void;
  const stopped = new Promise<never>((_, r) => {
    reject = r;
  });
  const cancel = () => {
    controller.abort();
    reject(Error("Read cancelled"));
  };
  const timer = setTimeout(() => {
    controller.abort();
    reject(Error("Read timed out"));
  }, timeoutMs);
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  try {
    return await Promise.race([
      stopped,
      signal?.aborted ? stopped : operation(controller.signal),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    controller.abort();
  }
}
async function streamBytes(
  stream: ReadableStream<Uint8Array> | null,
  signal: AbortSignal,
  max: number,
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (signal.aborted) throw Error("Read cancelled");
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw Error("Save is too large");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  } finally {
    signal.removeEventListener("abort", cancel);
    cancel();
  }
}
export function validateSource(url: string) {
  if (!url.trim() || url.length > 2048) throw Error("Enter a save URL");
  const parsed = new URL(
    url,
    globalThis.location?.href ?? "https://example.invalid/",
  );
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw Error("Use an HTTP(S) URL without embedded credentials");
  return parsed;
}
export async function readRemote(
  url: string,
  options: ReadOptions = {},
): Promise<Uint8Array> {
  const source = validateSource(url);
  const credentials: RequestCredentials =
    source.origin === globalThis.location?.origin ? "same-origin" : "omit";
  return bounded(
    async (signal) => {
      const response = await (options.fetcher ?? fetch)(url, {
        method: "GET",
        cache: "no-store",
        redirect: "error",
        credentials,
        signal,
      });
      if (!response.ok || response.redirected)
        throw Error(
          `Save request rejected (HTTP ${response.status} or redirect)`,
        );
      if (/html/i.test(response.headers.get("Content-Type") ?? ""))
        throw Error("Expected save bytes, received HTML");
      const max = options.maxBytes ?? MAX_BYTES;
      if (Number(response.headers.get("Content-Length")) > max)
        throw Error("Save is too large");
      const bytes = await streamBytes(response.body, signal, max);
      // Normalize only the sniffing view; returned save bytes stay untouched.
      let prefix = new TextDecoder().decode(bytes).trimStart();
      while (prefix.startsWith("<!--") || prefix.startsWith("<?")) {
        const endMarker = prefix.startsWith("<!--") ? "-->" : "?>";
        const end = prefix.indexOf(endMarker, 2);
        if (end < 0) break;
        prefix = prefix.slice(end + endMarker.length).trimStart();
      }
      if (/^(?:<!doctype\s+html|<html|<head|<body)/i.test(prefix))
        throw Error("Expected save bytes, received HTML");
      return bytes;
    },
    options.signal,
    options.timeoutMs,
  );
}
export async function readUpload(
  blob: Blob,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (blob.size > MAX_BYTES) throw Error("Save is too large");
  return bounded((s) => streamBytes(blob.stream(), s, MAX_BYTES), signal);
}
export class LoadGate {
  private generation = 0;
  private controller?: AbortController;
  cancel() {
    this.generation++;
    this.controller?.abort();
  }
  async run<T>(
    load: (signal: AbortSignal) => Promise<T>,
    revision: number,
    currentRevision: () => number,
  ): Promise<T | null> {
    this.cancel();
    const generation = this.generation;
    const controller = (this.controller = new AbortController());
    try {
      const value = await load(controller.signal);
      return generation === this.generation && revision === currentRevision()
        ? value
        : null;
    } catch (error) {
      if (generation !== this.generation || revision !== currentRevision())
        return null;
      throw error;
    }
  }
}
