# Game guide app starter

A runnable Preact companion with an invented **Demo Quest** guide and synthetic JSON save. Manual checklist marks, parsed facts and actual achievement awards are separate. No real-game decoder or award connection is included.

## Quick start

Use Node 24 and npm:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Download the synthetic sample, then use **Upload save**. No source URL or network request is configured on startup. Remote reads require a valid URL, **Enable remote reads**, then **Read save**. There is no background polling. Manual uploads disable remote reads.

```sh
npm test
npm run typecheck
npm run build
```

Build output is `dist/`; Vite's `./` asset base supports GitHub Pages project paths. Pull requests run browser/state/configuration tests, type checks and builds. Both workflows call shared browser and Docker runtime validation; Pages deploys the checked artifact only after both jobs pass. Select **GitHub Actions** as the repository's Pages source.

## Configure the next game

Generate a repository from the GitHub template (when repository creation is in scope), then configure it:

```sh
gh repo create example/example-rpg-guide --template sharkusmanch/game-guide-app-template --public --clone
cd example-rpg-guide
npm ci
```

Run this inside your generated project:

```sh
node scripts/configure-game.mjs --id example-rpg --title "Example RPG" --owner example --repo example-rpg-guide
```

Or use `npm run configure --` with the same four options. All four are required, exactly once; no other flags are supported. IDs are lowercase hyphenated slugs up to 64 characters, owners use GitHub's username character rules, and repository names are lowercase letters/digits/hyphens up to 100 characters. Titles contain 1–100 printable characters without HTML brackets.

The script validates all inputs and current configuration before writing `game.config.json`, `package.json`, `package-lock.json` and the title/description in `index.html`. It does not invoke a shell. Repeating identical arguments is safe, including from paths with spaces. A renamed game uses `mode: "unsupported"`: implement and validate its adapter before enabling decoding. Renaming metadata never makes demo bytes valid for a real game.

## Extension boundaries

- `game.config.json`: game identity, title, description, repository owner/name, demo or unsupported mode.
- `src/game/adapter.ts`: exported `adapter`, objectives, `decode(bytes)` with an explicit success/error result. Successful results contain only a save identity, capture time and bounded derived scalar facts. Add real-game format/edition/profile validation here, with independently attributable fixtures.
- `src/common/acquire.ts`: GET/no-store byte acquisition, redirect/HTML/oversize rejection, 1 MiB limit and 5-second deadline including the body. HTTP(S) URLs cannot embed credentials. Same-origin reads use the browser's existing session credentials; cross-origin reads explicitly omit credentials and endpoints must allow CORS. Redirects remain rejected. This request policy does not verify a private login or authentication-to-import flow; authentication and trust require environment-specific review.
- `src/common/state.ts`: version-1 progress under `guide:<game-id>:v1`; bounded derived history, manual marks and reversible in-session new attempts. `LoadGate` prevents old source/attempt/revision results from committing.

Progress exports contain derived snapshots and manual tracking, never raw save bytes. Restore validates the complete envelope before changing state and disables remote reads. Invalid, future and foreign-game local data remain untouched; **Download recovery** saves the original value. While recovery is pending, progress remains in memory and can be exported. Undo survives until the next new attempt/restore or page reload. If browser storage is unavailable, export before closing the page. A successful parse shows its timestamp so stored facts can be recognized as old.

## Synthetic save format

The original demo format is a UTF-8 JSON object with exactly these fields:

```json
{"format":"guide-demo-v1","game":"demo-quest","slot":"synthetic-slot","chapter":2,"collectibles":3}
```

`chapter` is an integer from 0 to 9; `collectibles` is an integer from 0 to 99. Other fields and values are rejected. The demo identity uses a stable non-cryptographic byte fingerprint for change tracking. It provides no proof of game completion, save authenticity or achievement awards.

## Next-game agent workflow

Read [docs/workflow.md](docs/workflow.md) for the bundled brief, evidence matrix, adapter contract and review/release forms. Install from the canonical checkout into your chosen skills directory:

```sh
node scripts/install-skill.mjs --skills-dir "$HOME/.codex/skills" --mode link
```

Use `--mode copy` for a self-contained installation. Both modes preserve bundled resources and refuse an unrelated existing target; repeating the same installation is safe. A link follows canonical updates and requires retaining this checkout; a changed copy requires deliberate removal/reinstallation by its owner.

Concrete invocation after configuring Example RPG:

> Use $build-game-guide to build Example RPG's manual companion in this generated repository. Read docs/workflow.md and fill the bundled brief/evidence/review forms outside public source. Platform, edition and target core are unknown; leave decoding and actual awards unavailable. Implement a sourced manual guide and run local checks. Publication and private deployment are out of scope.

| Owner | Scope |
|---|---|
| Game adapter / guide data | Edition/core/profile validation, game facts, objectives and game-specific planning; independently attributable fixture expectations |
| Common browser modules | Byte acquisition/cancellation, source/attempt guards, namespaced persistence, export/restore and recovery |
| Private source adapter | Read-only fixed-file or latest-validated-slot selection, format validation and atomic derived output; no synchronized-save edits |
| Existing progress service | Confirmed hardcore awards and its current authentication/feed contracts; preserve verified service features |
| Common runtime | `dist/`, exact read-only `/save` and explicit progress route allowlist; no decoder or awards inference |

## Hosting and validation

Public Pages needs no private infrastructure. For optional private packaging, use [docs/hosting.md](docs/hosting.md) and [deploy/values.example.yaml](deploy/values.example.yaml). The example has disabled ingress/source storage and an unusable image digest placeholder until environment review. Use each app's immutable source bundle through an existing trusted publisher; there is no automatic image push or cluster application.

```sh
npm run test:hosting  # Python 3 plus Node: runtime configuration and installer
npm run test:runtime  # Docker: committed source, actual runtime, output ownership/cleanup
```

Docker tests require Docker and stage the committed `HEAD`, not uncommitted edits. Local tests, synthetic demo behavior and Helm rendering do not establish a game's decoder/awards or a private environment's authenticated import, trust, storage and network acceptance. Record those gates explicitly in the release forms.
