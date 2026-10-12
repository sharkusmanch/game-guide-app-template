# Game guide app starter implementation

**Goal:** Publish a runnable GitHub template plus an installed reusable agent workflow for the next game.

**Architecture:** Small browser infrastructure with a replaceable game adapter; static Pages deployment and optional common Nginx image; evidence-led workflow in the same template repository.

**Stack:** Node 24, Preact, TypeScript, Vite, Vitest, Nginx/Alpine, Docker CI, app-template Helm values, Markdown skill/reference forms.

**Spec:** [spec.md](spec.md)

## Global Constraints

- Public source contains no real save/ROM bytes, personal accounts/progress, keys, private domains, operational evidence or internal execution ledger.
- Default source URL is blank and disabled; no startup network requests. Default data is explicitly synthetic demo data. A renamed game's decoder is unsupported until implemented.
- Game-specific decoding/planning and actual achievement awards stay separate from common infrastructure and manual checklist marks.
- GET/no-store save reads have a bounded deadline including the body and cancellation; stale results cannot commit across source/attempt/revision changes. Manual upload disables remote reads.
- Storage is game-namespaced and versioned; unrecognized data is preserved with a recovery download, not silently overwritten. Export excludes raw save bytes. Restore validates before mutation. New attempt is reversible and clears the active source/snapshot/history.
- Node 24 lockfile builds; Vite base is `./`. Configure inputs are validated before any file changes and never evaluated by a shell.
- The private runtime uses UID/GID 10000, read-only root and `/tmp`. Only GET/HEAD, exact save path, bounded explicit progress allowlist; no forwarding incoming Authorization/cookies/body. Private deployment requires environment-specific auth/trust/network review.
- Existing apps and production infrastructure remain unchanged. No automatic image publication or cluster application. Public GitHub template and Pages publication are authorized by the user.

## Review Focus

| Failure mode | Owning task and evidence |
|---|---|
| Rename retains demo decoding or leaks old source/state | Task 1 configuration and attempt tests |
| Abort/timeout or late result corrupts active facts | Task 1 save acquisition/context tests |
| Unknown local storage overwritten or malformed restore mutates state | Task 1 preservation/recovery tests |
| Proxy broadens routes/credentials; cleanup fails under Docker root output | Task 2 real Docker runtime and cleanup CI |
| Future agent confuses sourced/edited evidence with runtime award proof or publishes internal history | Task 2 reference forms, fresh-agent workflow exercise and public tree/history audit |

## Task 1: Runnable browser starter and project generation

**Own:** `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `src/`, `test/` browser/state/config tests, `scripts/configure-game.mjs`, `game.config.json`, `.gitignore`, `LICENSE`, `.github/workflows/pages.yml`, `.github/workflows/check.yml` (browser checks only initially), initial `README.md` quick start.

**Interface:** Export a game adapter from `src/game/adapter.ts`. Its public contract must make decode failures explicit and return only derived facts with a save identity. `game.config.json` owns id/title/description/repository owner+name and demo-vs-unsupported mode. Common modules own byte acquisition and state persistence. The demo uses an original documented JSON format and supplies downloadable synthetic bytes. Package scripts include `dev`, `test`, `typecheck`, `build`, `configure`; Task 2 adds `test:runtime` and hosting documentation. Any additional CLI flags/options are documented in README. Runtime bundle output is `dist/`.

- [ ] Bootstrap tooling using the reviewed dependency baseline: preact `^11.0.1`, @preact/preset-vite `^2.10.6`, @testing-library/preact `^3.2.4`, happy-dom `^20.14.6`, typescript `^7.0.2`, vite `^8.3.4`, vitest `^5.0.3`; commit a fresh matching lockfile.
- [ ] Write and observe failing behavior tests for invalid/future/foreign-game storage preservation, restore validation, new attempt/undo isolation, raw-byte-free export, cancellation and timeout including an unresponsive response body, oversized/HTML/redirect reads, and late source/attempt results. Then implement the minimum working infrastructure and demo adapter.
- [ ] Build a responsive accessible app that exposes guide objectives, manual tracking, parsed facts, source status and distinct unconnected awards; upload/sample download, source opt-in, export/restore, new attempt/undo, recovery. Automatic reads may use a small polling interval only after explicit opt-in; context cancellation applies to all asynchronous loads.
- [ ] Write failing configuration behavior tests, then implement `node scripts/configure-game.mjs --id example-rpg --title "Example RPG" --owner example --repo example-rpg-guide`; assert invalid input leaves all files unchanged, same arguments are idempotent, two isolated generated projects build, a path with spaces works, and renamed games reject the demo save. Keep package name/lock root/config/HTML metadata coherent.
- [ ] Add test/typecheck/build checks for pull requests and Pages deploy after successful checks on main. Use the reviewed workflow action baseline checkout/setup-node `@v7`, configure-pages `@v6`, upload-pages-artifact `@v5`, deploy-pages `@v5`, Node 24. Relative assets support a project subpath.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and generated-project verification. Record commands/results in the report, self-review, commit only owned files and return the report contract.

## Task 2: Private runtime and next-game agent workflow

**Own:** `hosting/`, `deploy/`, `docs/` reusable workflow/forms (preserve spec/plan), `skills/build-game-guide/`, `scripts/install-skill.mjs`, hosting/runtime test files, update README/AGENTS.md, package scripts and check workflow for runtime CI. Consume Task 1's unchanged `dist/` contract; avoid app behavior changes unless an identified integration issue requires a scoped fix.

**Interface:** `hosting/Dockerfile` builds this repo frontend using Node 24 and ships it in a common Nginx runtime. Expose configurable `SAVE_FILE` (absolute safe literal, default `/saves/unconfigured.bin`), `PROGRESS_UPSTREAM` (`host:port`), `PROGRESS_PREFIX` (safe slash path, default `/companion`) and `PROGRESS_IDS` (comma separated positive integers, default empty). Runtime routes `${PROGRESS_PREFIX}/api/achievements/ra/<id>` preserve that complete prefix and exact path. No browser account credentials are bundled. `deploy/values.example.yaml` is an app-template values example, not an automatic cluster installer. Skill source is `skills/build-game-guide/` and installation links or copies this canonical directory to a chosen skills directory without overwriting another target.

- [ ] Write runtime acceptance tests for only GET/HEAD, root/assets, health, exact save alias and neighbor denial, binary type/no-store, invalid configuration, absent and selected progress routes, no forwarded auth/cookies/body, path prefix preservation, read-only root/UID and SIGTERM exit. Implement the runtime with nginx configuration safely generated in `/tmp`; defaults expose no feed and no real save.
- [ ] Add a Docker CI runner that builds in a container from a read-only source copy and restores output ownership with runner UID/GID before cleanup; test the actual runtime stage under a read-only root. Add runtime job to check workflow. No automatic push. Use the observed runtime baseline Node `24.21.0`, Alpine `3.24` with Renovate annotations and OCI source/revision/version metadata. Document source bundle/tag/provenance integration through an existing trusted publisher instead of vendoring another permanent source tree.
- [ ] Add app-template values with non-root security, temp-only writable root, probes, existing optional read-only directory source (disabled by default), immutable image digest placeholder, no personal domains, disabled ingress until environment auth/network is chosen. Validate the example against current published app-template, document exact tested version and separate later environment gates. Include fixed-file vs latest-validated-slot adapter recipes with atomic output; format selection belongs to game-specific work.
- [ ] Read the baseline workflow exercise report supplied by controller before authoring the skill. Write a short discoverable reference SKILL.md and reusable workflow, game brief, evidence matrix, adapter contract, review handoff, public-release and private-release forms. Required slots distinguish fixture origin/core/profile/hash and independent oracle; published membership/conditions/actual hardcore award; source/synthetic/target runtime validation; public history/CI/live browser/ownership/provenance/auth-to-import/network/storage gates. Unknown gates remain explicit rather than blocked startup scaffolding.
- [ ] Add safe local skill installation and precise quick-start commands, template generation (`gh repo create ... --template ...`), configuration, adapter ownership map, public/private patterns and concrete next-game agent invocation. Add concise AGENTS.md to generated repos directing agents to the workflow without overriding user authorization or existing project policy.
- [ ] Run covering runtime/installer tests, `npm test`, `npm run typecheck`, `npm run build`; validate skill metadata; report real Docker execution as pending if unavailable locally (the controller will run GitHub CI). Self-review, commit only owned files, return the report contract.

## Controller acceptance and publication

- [ ] Task-scoped independent spec+quality reviews with diff packages; one final whole-branch review. Fix covering failures before publication; preserve sanitized review conclusions in project records outside this public template.
- [ ] Fresh-agent forward exercise with the same next-game scenario, using the skill and producing actual brief/evidence/release artifacts; compare baseline omissions and validate retrieval. Install the skill locally, record template/workflow in games project guidance.
- [ ] Audit the complete public tree and reachable history. Publish dedicated public repo `sharkusmanch/game-guide-app-template`, mark as template, enable Pages workflow and read back settings. Verify all actual CI jobs, including Docker runtime and output cleanup.
- [ ] Exercise the live HTTPS project path at desktop/mobile: no initial network integrations, sample download/manual upload, facts/manual/award distinction, tracking/reload/export/restore/new attempt/undo. Report actual evidence and remaining game/environment gates.

## Plan self-review

Task 1 produces the `dist/`/configuration/state contracts consumed by Task 2. Task 2 touches README, package scripts and checks only to extend them after Task 1; implementation is sequential. Neither requires private service or existing app mutation. Tests cover all five review risks and each required state invariant. Domain parsers, online real-save acquisition and deployment remain per-game work in the workflow; the starter verifies synthetic input rather than claiming a game's acceptance. The two deliverables are independently reviewable; configuration/release setup is folded into the deliverable it enables.
