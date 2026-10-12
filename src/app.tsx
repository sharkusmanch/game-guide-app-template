import { useEffect, useMemo, useState } from "preact/hooks";
import config from "../game.config.json";
import { adapter } from "./game/adapter";
import { ProgressStore } from "./common/state";
import {
  LoadGate,
  readRemote,
  readUpload,
  validateSource,
} from "./common/acquire";

function download(text: string, name: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function browserStorage(): Pick<Storage, "getItem" | "setItem"> {
  try {
    return localStorage;
  } catch {
    return {
      getItem: () => {
        throw Error("Unavailable");
      },
      setItem: () => {
        throw Error("Unavailable");
      },
    };
  }
}
export function App() {
  const store = useMemo(
    () => new ProgressStore(config.id, browserStorage()),
    [],
  );
  const gate = useMemo(() => new LoadGate(), []);
  const [, redraw] = useState(0);
  const [status, setStatus] = useState("No source read this session.");
  const [busy, setBusy] = useState(false);
  const refresh = () => redraw((n) => n + 1);
  useEffect(() => () => gate.cancel(), [gate]);
  const mutate = (action: () => void, message?: string) => {
    gate.cancel();
    setBusy(false);
    action();
    refresh();
    if (message) setStatus(message);
    else if (busy) setStatus("Read cancelled. Manual progress updated.");
  };
  async function load(
    read: (signal: AbortSignal) => Promise<Uint8Array>,
    apply: (bytes: Uint8Array) => void,
    message: string,
  ) {
    setBusy(true);
    setStatus("Reading…");
    try {
      const bytes = await gate.run(read, store.revision, () => store.revision);
      if (bytes === null) return;
      apply(bytes);
      setStatus(message);
      setBusy(false);
      refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Read failed");
      setBusy(false);
      refresh();
    }
  }
  const parse = (bytes: Uint8Array) => {
    const decoded = adapter.decode(bytes);
    if (!decoded.ok) throw Error(decoded.error);
    store.snapshot(decoded.snapshot);
  };
  const fileFrom = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = "";
    return file;
  };
  const state = store.state;
  let sourceValid = false;
  try {
    validateSource(state.source.url);
    sourceValid = true;
  } catch {
    /* Display URL guidance until valid. */
  }
  return (
    <>
      <header class="hero">
        <div class="container">
          <span class="eyebrow">GAME GUIDE STARTER</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
          <span class="badge">
            {config.mode === "demo"
              ? "Synthetic demo • invented game and save data"
              : "Adapter unsupported • implement game-specific decoding"}
          </span>
        </div>
      </header>
      <main class="container">
        <section class="attempt" aria-label="Attempt controls">
          <div>
            <strong>Current attempt</strong>
            <p class="small">{state.attempt}</p>
          </div>
          <div class="actions">
            <button
              onClick={() =>
                mutate(
                  () => store.newAttempt(),
                  "New attempt started. Source, facts and history cleared.",
                )
              }
            >
              New attempt
            </button>
            <button
              disabled={!store.canUndo}
              onClick={() =>
                mutate(() => {
                  store.undo();
                }, "Previous attempt restored. Remote reads remain disabled.")
              }
            >
              Undo new attempt
            </button>
          </div>
        </section>
        {store.recovery !== null && (
          <aside class="notice" aria-live="polite">
            <strong>Stored data needs recovery.</strong>
            <p>
              Its format or game is unrecognized. The original stays untouched;
              changes in this session remain in memory. Export your current
              progress before leaving.
            </p>
            <button
              onClick={() =>
                download(
                  store.recovery!,
                  `${config.id}-recovery.txt`,
                  "text/plain",
                )
              }
            >
              Download recovery
            </button>
          </aside>
        )}
        {store.storageWarning && (
          <aside class="notice" aria-live="polite">
            {store.storageWarning}
          </aside>
        )}
        <div class="grid">
          <section class="card" aria-labelledby="guide-heading">
            <span class="eyebrow">PLAN YOUR NEXT STEP</span>
            <h2 id="guide-heading">Guide objectives</h2>
            <p>
              Manual tracking. These marks are your notes and do not grant
              achievement awards.
            </p>
            {adapter.objectives.map((objective) => (
              <div class="objective" key={objective.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!state.manual[objective.id]}
                    onChange={(event) =>
                      mutate(() =>
                        store.mark(objective.id, event.currentTarget.checked),
                      )
                    }
                  />
                  <span>{objective.title}</span>
                </label>
                <p>{objective.detail}</p>
              </div>
            ))}
          </section>
          <section class="card" aria-labelledby="facts-heading">
            <span class="eyebrow">PARSED SAVE EVIDENCE</span>
            <h2 id="facts-heading">Parsed facts</h2>
            {state.snapshot ? (
              <>
                <dl>
                  {Object.entries(state.snapshot.facts).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key.charAt(0).toUpperCase() + key.slice(1)}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
                </dl>
                <p class="small">
                  Save identity: {state.snapshot.saveIdentity}
                </p>
                <p class="small">
                  Last parsed:{" "}
                  <time dateTime={state.snapshot.capturedAt}>
                    {new Date(state.snapshot.capturedAt).toLocaleString()}
                  </time>
                </p>
                <p class="small">
                  {state.history.length} derived snapshot
                  {state.history.length === 1 ? "" : "s"} in this attempt.
                </p>
                <p>
                  {config.mode === "demo"
                    ? "Synthetic facts from an invented JSON save."
                    : "Stored derived facts; game-specific validation is required."}
                </p>
              </>
            ) : (
              <p>
                No parsed save yet.{" "}
                {config.mode === "demo"
                  ? "Download the synthetic sample and upload it below."
                  : "Implement the adapter before importing a game save."}
              </p>
            )}
          </section>
          <section class="card wide" aria-labelledby="source-heading">
            <span class="eyebrow">SAVE ACCESS</span>
            <h2 id="source-heading">Source and status</h2>
            <p role="status" aria-live="polite" class="source-status">
              {status}
            </p>
            <p class="small">
              At most 1 MiB. Reads have a 5-second deadline. Remote reads run
              only when enabled and you press Read save; no background polling.
            </p>
            <div class="source-grid">
              <div>
                <label class="file-label">
                  Upload save
                  <input
                    type="file"
                    onChange={(event) => {
                      const file = fileFrom(event.currentTarget);
                      if (!file) return;
                      mutate(() => store.source(state.source.url, false));
                      void load(
                        (signal) => readUpload(file, signal),
                        parse,
                        "Manual upload parsed. Remote reads disabled.",
                      );
                    }}
                  />
                </label>
                <button
                  disabled={config.mode !== "demo"}
                  onClick={() =>
                    download(adapter.sampleText, "synthetic-demo-save.json")
                  }
                >
                  Download synthetic sample
                </button>
              </div>
              <div>
                <label class="field">
                  Save URL
                  <input
                    type="url"
                    placeholder="Enter a save endpoint or /save"
                    value={state.source.url}
                    onInput={(event) => {
                      const url = event.currentTarget.value;
                      mutate(
                        () => store.source(url, false),
                        "Source changed. Enable remote reads to use it.",
                      );
                    }}
                  />
                </label>
                <label class="toggle">
                  <input
                    type="checkbox"
                    checked={state.source.enabled}
                    disabled={!sourceValid}
                    onChange={(event) => {
                      const enabled = event.currentTarget.checked;
                      mutate(
                        () => store.source(state.source.url, enabled),
                        enabled
                          ? "Remote reads enabled. Press Read save when ready."
                          : "Remote reads disabled.",
                      );
                    }}
                  />
                  Enable remote reads
                </label>
                <button
                  disabled={!state.source.enabled || !sourceValid || busy}
                  onClick={() =>
                    void load(
                      (signal) => readRemote(state.source.url, { signal }),
                      parse,
                      "Remote save parsed.",
                    )
                  }
                >
                  Read save
                </button>
              </div>
            </div>
          </section>
          <section class="card" aria-labelledby="awards-heading">
            <span class="eyebrow">SEPARATE EVIDENCE</span>
            <h2 id="awards-heading">Achievement awards</h2>
            <span class="badge muted">Unconnected</span>
            <p>
              No award service is connected. Manual marks and parsed save facts
              do not verify actual awards or hardcore achievement conditions.
            </p>
          </section>
          <section class="card" aria-labelledby="progress-heading">
            <span class="eyebrow">KEEP YOUR NOTES</span>
            <h2 id="progress-heading">Progress backup</h2>
            <p>
              Export includes derived facts and manual tracking, never raw save
              bytes. Restore accepts this game's supported progress format and
              disables remote reads.
            </p>
            <button
              onClick={() =>
                download(store.export(), `${config.id}-progress.json`)
              }
            >
              Export progress
            </button>
            <label class="file-label">
              Restore progress
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = fileFrom(event.currentTarget);
                  if (!file) return;
                  void load(
                    (signal) => readUpload(file, signal),
                    (bytes) => store.restore(new TextDecoder().decode(bytes)),
                    "Progress restored. Remote reads disabled.",
                  );
                }}
              />
            </label>
          </section>
        </div>
      </main>
      <footer class="container">
        A reusable companion starter. Your checklist and parsed facts stay in
        this browser unless you export them.
      </footer>
    </>
  );
}
