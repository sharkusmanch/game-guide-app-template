# Game guide project

Use [docs/workflow.md](docs/workflow.md) and the canonical reference skill at
[skills/build-game-guide/SKILL.md](skills/build-game-guide/SKILL.md) for next-game
briefs, evidence, adapter work and review/release artifacts. Keep manual marks,
save facts and confirmed hardcore awards separate; renamed games remain
unsupported until their adapter is independently validated.

The common browser infrastructure is in `src/common/`; game decoding/objectives
belong in `src/game/adapter.ts`. Hosting consumes `dist/`. Preserve existing source
and service contracts when adding integrations. Use synthetic public fixtures;
keep real save/ROM bytes, accounts/progress, keys and operational records outside
public source and reachable history.

Run the relevant package checks and record unexecuted Docker/game/environment
gates honestly. These references support the user's requested scope and do not
override existing project policy or grant publication/deployment authorization.
