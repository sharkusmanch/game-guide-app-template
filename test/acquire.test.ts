import { it, expect, vi } from "vitest";
import { readRemote, LoadGate, readUpload } from "../src/common/acquire";
const fetcher = (response: Response) =>
  vi.fn(async () => response) as unknown as typeof fetch;
it("uses GET/no-store with redirect rejection", async () => {
  const get = fetcher(
    new Response("synthetic", {
      headers: { "Content-Type": "application/octet-stream" },
    }),
  );
  const bytes = await readRemote("/save", { fetcher: get });
  expect(new TextDecoder().decode(bytes)).toBe("synthetic");
  expect(get).toHaveBeenCalledWith(
    "/save",
    expect.objectContaining({
      method: "GET",
      cache: "no-store",
      redirect: "error",
      credentials: "omit",
    }),
  );
});
it("settles on cancellation even when fetch ignores AbortSignal", async () => {
  const controller = new AbortController();
  const result = readRemote("/save", {
    signal: controller.signal,
    fetcher: (() => new Promise(() => {})) as typeof fetch,
  });
  controller.abort();
  await expect(result).rejects.toThrow(/cancel/i);
});
it("bounds the fetch deadline", async () => {
  await expect(
    readRemote("/save", {
      timeoutMs: 10,
      fetcher: (() => new Promise(() => {})) as typeof fetch,
    }),
  ).rejects.toThrow(/timed out/i);
});
it("bounds an unresponsive response body", async () => {
  const response = new Response(new ReadableStream({ start() {} }));
  await expect(
    readRemote("/save", { timeoutMs: 10, fetcher: fetcher(response) }),
  ).rejects.toThrow(/timed out/i);
});
it("rejects oversized declared and streamed bodies", async () => {
  await expect(
    readRemote("/save", {
      maxBytes: 3,
      fetcher: fetcher(
        new Response("four", { headers: { "Content-Length": "4" } }),
      ),
    }),
  ).rejects.toThrow(/large/i);
  await expect(
    readRemote("/save", {
      maxBytes: 3,
      fetcher: fetcher(new Response("four")),
    }),
  ).rejects.toThrow(/large/i);
});
it("rejects HTML, redirects and HTTP failures", async () => {
  for (const response of [
    new Response("<html>login</html>"),
    new Response("login", { headers: { "Content-Type": "text/html" } }),
    new Response("", { status: 401 }),
    Object.assign(new Response("bytes"), { redirected: true }),
  ])
    await expect(
      readRemote("/save", { fetcher: fetcher(response) }),
    ).rejects.toThrow();
});
it("rejects unsafe URL protocols and embedded credentials before a request", async () => {
  const get = vi.fn();
  for (const url of [
    "javascript:alert(1)",
    "https://user:secret@example.com/save",
    "",
  ])
    await expect(readRemote(url, { fetcher: get })).rejects.toThrow();
  expect(get).not.toHaveBeenCalled();
});
it("bounds manual uploads and supports valid bytes", async () => {
  expect(new TextDecoder().decode(await readUpload(new Blob(["sample"])))).toBe(
    "sample",
  );
  await expect(
    readUpload(new Blob([new Uint8Array(1024 * 1024 + 1)])),
  ).rejects.toThrow(/large/i);
});
it("discards results after source cancellation or attempt changes", async () => {
  const gate = new LoadGate();
  let release!: (s: string) => void;
  let revision = 0;
  const result = gate.run(
    () =>
      new Promise<string>((r) => {
        release = r;
      }),
    0,
    () => revision,
  );
  gate.cancel();
  release("old source");
  expect(await result).toBeNull();
  const second = gate.run(
    async () => {
      revision++;
      return "old attempt";
    },
    revision,
    () => revision,
  );
  expect(await second).toBeNull();
});
it("a late older read cannot replace a newer read", async () => {
  const gate = new LoadGate();
  let release!: (s: string) => void;
  const old = gate.run(
    () =>
      new Promise<string>((r) => {
        release = r;
      }),
    0,
    () => 0,
  );
  expect(
    await gate.run(
      async () => "new",
      0,
      () => 0,
    ),
  ).toBe("new");
  release("old");
  expect(await old).toBeNull();
});

it("cancels a pending body and never starts a pre-cancelled request", async () => {
  const controller = new AbortController();
  const result = readRemote("/save", {
    signal: controller.signal,
    fetcher: fetcher(new Response(new ReadableStream({ start() {} }))),
  });
  await Promise.resolve();
  controller.abort();
  await expect(result).rejects.toThrow(/cancel/i);
  const get = vi.fn();
  await expect(
    readRemote("/save", { signal: controller.signal, fetcher: get }),
  ).rejects.toThrow(/cancel/i);
  expect(get).not.toHaveBeenCalled();
});

it("rejects HTML even after a long whitespace prefix", async () => {
  await expect(
    readRemote("/save", {
      fetcher: fetcher(new Response(" ".repeat(300) + "<!doctype html>login")),
    }),
  ).rejects.toThrow(/HTML/);
});
