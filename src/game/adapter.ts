import config from "../../game.config.json";
import type { DecodeResult } from "../common/model";
export type { DecodeResult, Snapshot } from "../common/model";
/** Original synthetic JSON format; this is not a real game's save format. */
export const sampleText =
  '{"format":"guide-demo-v1","game":"demo-quest","slot":"synthetic-slot","chapter":2,"collectibles":3}';
export const objectives = [
  {
    id: "read-guide",
    title: "Read the route notes",
    detail:
      "Begin at the harbor, follow the lanterns, then visit the beacon. This route is invented for the demo.",
  },
  {
    id: "visit-beacon",
    title: "Visit the beacon",
    detail:
      "Track this objective yourself. A checklist mark does not prove a save fact or award.",
  },
  {
    id: "collect-shells",
    title: "Collect three shells",
    detail: "Compare your manual notes with the synthetic collectible count.",
  },
];
export function decode(bytes: Uint8Array, mode = config.mode): DecodeResult {
  if (mode !== "demo" || config.mode !== "demo" || config.id !== "demo-quest")
    return {
      ok: false,
      error:
        "Save decoding is unsupported for this game. Implement its adapter first.",
    };
  try {
    const v = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).length !== 5 ||
      v.format !== "guide-demo-v1" ||
      v.game !== "demo-quest" ||
      v.slot !== "synthetic-slot" ||
      !Number.isInteger(v.chapter) ||
      v.chapter < 0 ||
      v.chapter > 9 ||
      !Number.isInteger(v.collectibles) ||
      v.collectibles < 0 ||
      v.collectibles > 99
    )
      throw Error();
    // This stable, non-cryptographic identity is for demo change tracking only.
    let hash = 2166136261;
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
    return {
      ok: true,
      snapshot: {
        saveIdentity: `demo:${(hash >>> 0).toString(16)}`,
        facts: { chapter: v.chapter, collectibles: v.collectibles },
        capturedAt: new Date().toISOString(),
      },
    };
  } catch {
    return {
      ok: false,
      error:
        "Invalid synthetic demo save. Download the sample to try an upload.",
    };
  }
}
export const adapter = { decode, objectives, sampleText };
