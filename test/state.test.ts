import { describe, it, expect } from "vitest";
import { ProgressStore, storageKey } from "../src/common/state";
import { decode, sampleText } from "../src/game/adapter";
const bytes = new TextEncoder().encode(sampleText);
function fresh(raw?: string) {
  const storage = new Map<string, string>();
  if (raw !== undefined) storage.set(storageKey("demo-quest"), raw);
  const api = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  } as Pick<Storage, "getItem" | "setItem">;
  return { store: new ProgressStore("demo-quest", api), storage };
}
const snapshot = {
  saveIdentity: "synthetic",
  facts: { chapter: 2, collectibles: 3 },
  capturedAt: "2026-01-01T00:00:00.000Z",
};
describe("progress boundary", () => {
  it.each([
    "not json",
    JSON.stringify({ version: 99, game: "demo-quest" }),
    JSON.stringify({ version: 1, game: "foreign" }),
  ])("preserves unrecognized data: %s", (raw) => {
    const { store, storage } = fresh(raw);
    store.mark("read-guide", true);
    expect(store.recovery).toBe(raw);
    expect(storage.get(storageKey("demo-quest"))).toBe(raw);
    expect(store.state.manual["read-guide"]).toBe(true);
  });
  it("persists and reloads manual marks and derived facts", () => {
    const { store, storage } = fresh();
    store.mark("read-guide", true);
    store.snapshot(snapshot);
    const next = fresh(storage.get(storageKey("demo-quest"))).store;
    expect(next.state.manual["read-guide"]).toBe(true);
    expect(next.state.snapshot).toEqual(snapshot);
  });
  it("validates restore before any mutation", () => {
    const { store, storage } = fresh();
    store.mark("read-guide", true);
    const before = store.export();
    const disk = storage.get(storageKey("demo-quest"));
    for (const raw of [
      "bad",
      JSON.stringify({ version: 99 }),
      JSON.stringify({ game: "other" }),
      JSON.stringify({ ...JSON.parse(before), rawBytes: [1, 2] }),
    ]) {
      expect(() => store.restore(raw)).toThrow();
      expect(store.export()).toBe(before);
      expect(storage.get(storageKey("demo-quest"))).toBe(disk);
    }
  });
  it("restores valid progress with remote reads disabled", () => {
    const first = fresh().store;
    first.mark("read-guide", true);
    first.source("/save", true);
    first.snapshot(snapshot);
    const next = fresh().store;
    next.restore(first.export());
    expect(next.state.manual["read-guide"]).toBe(true);
    expect(next.state.snapshot).toEqual(snapshot);
    expect(next.state.source.enabled).toBe(false);
  });
  it("starts an isolated reversible attempt", () => {
    const { store } = fresh();
    store.mark("read-guide", true);
    store.source("/save", true);
    store.snapshot(snapshot);
    const attempt = store.state.attempt;
    store.newAttempt();
    expect(store.state.attempt).not.toBe(attempt);
    expect(store.state.source).toEqual({ url: "", enabled: false });
    expect(store.state.snapshot).toBeNull();
    expect(store.state.history).toEqual([]);
    expect(store.state.manual).toEqual({});
    store.mark("visit-beacon", true);
    expect(store.undo()).toBe(true);
    expect(store.state.attempt).toBe(attempt);
    expect(store.state.manual).toEqual({ "read-guide": true });
    expect(store.state.snapshot).toEqual(snapshot);
    expect(store.state.source.url).toBe("/save");
    expect(store.state.source.enabled).toBe(false);
  });
  it("exports only validated derived data, never raw save bytes", () => {
    const { store } = fresh();
    store.snapshot(snapshot);
    const exported = JSON.parse(store.export());
    expect(exported.snapshot.facts).toEqual(snapshot.facts);
    expect(store.export()).not.toContain("guide-demo-v1");
    expect(() => store.snapshot({ ...snapshot, bytes: [1, 2, 3] })).toThrow();
  });
  it("supports in-memory progress when browser storage is unavailable", () => {
    const storage = {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
    } as unknown as Storage;
    const store = new ProgressStore("demo-quest", storage);
    store.mark("read-guide", true);
    expect(store.state.manual["read-guide"]).toBe(true);
  });
});
describe("demo adapter", () => {
  it("derives facts and an identity from the documented synthetic save", () => {
    const result = decode(bytes);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.facts).toEqual({ chapter: 2, collectibles: 3 });
      expect(result.snapshot.saveIdentity).toBeTruthy();
    }
  });
  it("rejects malformed, foreign, and unsupported renamed-game saves", () => {
    expect(decode(new TextEncoder().encode("{}")).ok).toBe(false);
    expect(
      decode(
        new TextEncoder().encode(sampleText.replace("demo-quest", "foreign")),
      ).ok,
    ).toBe(false);
    expect(decode(bytes, "unsupported").ok).toBe(false);
  });
});
