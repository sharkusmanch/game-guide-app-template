import type { Snapshot } from "./model";

export const storageKey = (game: string) => `guide:${game}:v1`;
export type Progress = {
  version: 1;
  game: string;
  attempt: string;
  manual: Record<string, boolean>;
  source: { url: string; enabled: boolean };
  snapshot: Snapshot | null;
  history: Snapshot[];
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
const bounded = (v: unknown, max = 256): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
export function validSnapshot(v: unknown): v is Snapshot {
  return (
    record(v) &&
    exact(v, ["saveIdentity", "capturedAt", "facts"]) &&
    bounded(v.saveIdentity) &&
    bounded(v.capturedAt, 40) &&
    Number.isFinite(Date.parse(v.capturedAt)) &&
    record(v.facts) &&
    Object.keys(v.facts).length <= 100 &&
    Object.entries(v.facts).every(
      ([k, x]) =>
        bounded(k, 100) &&
        (typeof x === "boolean" ||
          (typeof x === "number" && Number.isFinite(x)) ||
          bounded(x)),
    )
  );
}
function validProgress(v: unknown, game: string): v is Progress {
  return (
    record(v) &&
    exact(v, [
      "version",
      "game",
      "attempt",
      "manual",
      "source",
      "snapshot",
      "history",
    ]) &&
    v.version === 1 &&
    v.game === game &&
    bounded(v.attempt) &&
    record(v.manual) &&
    Object.keys(v.manual).length <= 1000 &&
    Object.entries(v.manual).every(
      ([k, x]) => /^[a-z0-9-]{1,100}$/.test(k) && typeof x === "boolean",
    ) &&
    record(v.source) &&
    exact(v.source, ["url", "enabled"]) &&
    typeof v.source.url === "string" &&
    v.source.url.length <= 2048 &&
    typeof v.source.enabled === "boolean" &&
    (v.snapshot === null || validSnapshot(v.snapshot)) &&
    Array.isArray(v.history) &&
    v.history.length <= 30 &&
    v.history.every(validSnapshot)
  );
}
function empty(game: string): Progress {
  return {
    version: 1,
    game,
    attempt: crypto.randomUUID(),
    manual: {},
    source: { url: "", enabled: false },
    snapshot: null,
    history: [],
  };
}
export class ProgressStore {
  state: Progress;
  recovery: string | null = null;
  revision = 0;
  storageWarning = "";
  private previous: Progress | null = null;
  constructor(
    public game: string,
    private storage: Pick<Storage, "getItem" | "setItem">,
  ) {
    this.state = empty(game);
    try {
      const raw = storage.getItem(storageKey(game));
      if (raw !== null) {
        try {
          const value: unknown = JSON.parse(raw);
          if (!validProgress(value, game)) throw Error();
          this.state = value;
          this.state.source.enabled = false;
        } catch {
          this.recovery = raw;
        }
      }
    } catch {
      this.storageWarning =
        "Browser storage is unavailable. Export progress to keep it.";
    }
  }
  private persist() {
    this.revision++;
    if (this.recovery !== null) return;
    try {
      this.storage.setItem(storageKey(this.game), JSON.stringify(this.state));
      this.storageWarning = "";
    } catch {
      this.storageWarning = "Progress is in memory only. Export it to keep it.";
    }
  }
  mark(id: string, done: boolean) {
    if (!/^[a-z0-9-]{1,100}$/.test(id)) throw Error("Invalid objective");
    this.state.manual[id] = done;
    this.persist();
  }
  source(url: string, enabled: boolean) {
    if (url.length > 2048) throw Error("Source URL is too long");
    this.state.source = { url, enabled };
    this.persist();
  }
  snapshot(value: unknown) {
    if (!validSnapshot(value)) throw Error("Invalid derived snapshot");
    const snapshot = structuredClone(value);
    this.state.snapshot = snapshot;
    this.state.history = [...this.state.history, snapshot].slice(-30);
    this.persist();
  }
  newAttempt() {
    this.previous = structuredClone(this.state);
    this.state = empty(this.game);
    this.persist();
  }
  get canUndo() {
    return this.previous !== null;
  }
  undo() {
    if (!this.previous) return false;
    this.state = this.previous;
    this.previous = null;
    this.state.source.enabled = false;
    this.persist();
    return true;
  }
  export() {
    const value = structuredClone(this.state);
    value.source.enabled = false;
    return JSON.stringify(value, null, 2);
  }
  restore(raw: string) {
    if (raw.length > 1024 * 1024) throw Error("Progress file is too large");
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw Error("Invalid progress JSON");
    }
    if (!validProgress(value, this.game))
      throw Error("Invalid, foreign-game or unsupported progress file");
    value.source.enabled = false;
    this.state = value;
    this.previous = null;
    this.persist();
  }
}
