# Game guide app starter

Build a dedicated public GitHub template and a reusable agent workflow for future game companions. The default app must run immediately, deploy to a GitHub Pages project path, and demonstrate the common infrastructure with clearly labelled synthetic data. It is not a finished guide for a real game.

## Boundary

Share a browser shell, byte acquisition, versioned local progress, project export/recovery, hosting and release checks. Keep game edition/profile validation, save decoding, inventory/Dex models, challenge history, route planning and achievement triggers in each game's adapter. No changes to existing game apps or live cluster services are required.

The default browser uses a small JSON demo save. The UI labels demo facts, manual checklist marks and unconnected achievement awards separately. Renaming the starter must put save decoding into an unsupported state until the new adapter is implemented; merely accepting bytes or published achievement membership must not imply gameplay validation.

## Runnable deliverable

- Node 24, Preact, TypeScript and Vite with a committed lockfile and relative asset base. Responsive accessible guide/checklist, save upload, opt-in remote read, source/error/freshness display, new attempt, export/restore and recovery download.
- Game configuration in `game.config.json`, domain adapter in `src/game/adapter.ts`, common save access and state in separate modules. Default accounts, keys and source URLs are absent/blank; no network requests on startup.
- Namespaced versioned local storage. Invalid, foreign-game and future envelopes preserve the original raw value and expose a recovery download. In-memory use remains possible without silently overwriting that value. Export contains derived facts and user tracking, never raw save bytes. Restore is validated before mutation; reset/new attempt is reversible and drops the old source/snapshot/history from the active attempt.
- Manual upload cancels remote work and disables automatic reading. Bounded GET/no-store acquisition rejects authentication redirects, HTML and oversized responses, and settles on timeout/cancellation even if the transport ignores AbortSignal. A response started under an old source/attempt/revision cannot commit.
- `node scripts/configure-game.mjs --id example-rpg --title "Example RPG" --owner example --repo example-rpg-guide` validates inputs and changes only documented configuration paths. It must work in temporary generated projects, including paths with spaces, without shell evaluation or modifying the starter. Invalid inputs leave files unchanged. Re-running the same configuration is safe. It disables the demo adapter for a renamed game.
- A synthetic demo save download makes manual upload demonstrable without distributing a real save. Meaningful tests cover state preservation, source races and configuration behavior; browser checks cover the built project path, mobile overflow, upload, restore and persistence.

## Hosting deliverable

The same frontend is served by a common non-root Nginx runtime. The image serves static files, `/healthz` and one exact read-only `/save` alias. Neighboring paths and non-GET/HEAD methods are denied; `/save` never receives SPA fallback or caching. Optional achievement routes are an explicit numeric allowlist with a configurable upstream path prefix, preserving that prefix. No credentials, incoming cookies/Authorization or request body reach the proxy upstream. Defaults expose no progress routes and select a nonexistent save path.

The runtime validates settings before generating Nginx configuration, runs as UID/GID 10000 with a read-only root plus `/tmp`, and is tested in Docker CI. CI returns bind-mounted build output ownership to the runner before cleanup. No image is automatically pushed or cluster resources applied. Ship a validated app-template Helm values example for optional private deployment, with disabled ingress until authentication is selected, read-only directory save mounts, probes and a digest placeholder clearly requiring configuration. Existing chart versions, image publisher trust, storage and additive network policies must be discovered for each environment rather than embedded from a private cluster.

Prefer each app's canonical public repo and immutable release bundle in its own image, built through the environment's existing trusted publisher. A shared runtime/template simplifies packaging without coupling all game releases. A single image loading all apps remains a later tradeoff, not a requirement for this starter.

## Agent workflow

Ship `skills/build-game-guide/SKILL.md` with concise discovery metadata, a practical reference workflow and brief/evidence/review/release forms accessible from `docs/`. Docs entrypoints may link to references bundled inside the skill so installation preserves resource resolution without duplicate instructions. The workflow starts from exact game/edition/emulator/core/run scope, research and evidence; it progresses through an adapter and guide, independent review, public publication and optional private integration.

Capture the hard lessons: independently attributable fixture expectations; edited/constructed/other-core/target-core captures distinguished; missing fixtures reported as skips/open gates; achievement hashes not executable conditions; true hardcore awards not save-state inference; current source preserved when adding private feed support; exact configuration and commit provenance; Docker output ownership; public reachable-history audit; Pages project paths; authentication-to-import verification; directory mounts for atomic replacement; immutable signed image acceptance; long-lived network-policy identities and existing additive allows; no save edits/restores/rescans to test sync. Provide concrete acceptance artifact slots instead of an unbounded checklist or a narrative of a past session.

Install the canonical skill locally through a script or link without overwriting an unrelated skill. Keep reusable instructions in this repository; project guidance points to the template and skill. Test the reference workflow with a baseline next-game exercise and a fresh-agent forward exercise, then validate the skill metadata.

## Publication and acceptance

Public source contains only generic code, synthetic data and reusable documentation. No private domain, account state, source byte fixtures, operational records, credentials or internal execution ledger enters this repository or its reachable history. Audit before publication. Mark the repository as a GitHub template and enable workflow Pages, independently read back settings, and wait for all required CI checks. Exercise the actual public HTTPS app and report working template/demo links. Docker CI proves container behavior; it does not prove any future private deployment or game's decoder/awards. Keep those future gates explicit.
