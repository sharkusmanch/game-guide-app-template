/** Adapter output contains bounded derived scalar facts, never source bytes. */
export type DerivedFacts = Record<string, string | number | boolean>;
export type Snapshot = {
  saveIdentity: string;
  capturedAt: string;
  facts: DerivedFacts;
};
export type DecodeResult =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; error: string };
