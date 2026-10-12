# Adapter contract form

The starter owns common browser acquisition/state; `src/game/adapter.ts` owns named game/profile validation, decoding and objectives. A game may extend the model deliberately with tests; do not manufacture a universal planner.

| Contract | Game-specific implementation and acceptance artifact |
|---|---|
| Input | Bytes plus exact supported edition/core/profile; signature/container/checksum/slot validation; size bounds; unsupported-file result |
| Output | Derived facts with per-field evidence/unknowns; decoder/schema versions; capture and observation times; selected slot; source kind; identity assignment; safe digest if useful |
| Domain | Inventory/recipes/reservations or registration/held instances/ownership history as appropriate; checkpoint history cannot be inferred from a current save |
| Progress | Separate feed identity/set IDs, strict award IDs and hardcore timestamps; unavailable/stale/error states; no browser account keys |
| Fixture oracle | Link evidence-matrix rows; constructed/edited/other-core/target-core distinction; independent expected-value origin; missing fixture tests explicitly skipped |
| Shared transport regression | GET/no-store; total deadline through body; cancellation settles when fetch ignores AbortSignal; redirects/HTML/oversize rejection; source/attempt/revision races cannot commit; manual upload disables remote reads |
| Shared persistence regression | Game/version namespace; future/unreadable existing value preserved byte-for-byte with raw recovery download; validate restore before mutation; exports exclude bytes/credentials/private source URLs; reversible new attempt clears active source/snapshot/history |
| Source adapter | Fixed-file or deterministic latest-validated-slot policy; directory replacement/partial-write tests; input read-only, output atomically replaced; last good snapshot with truthful stale/error time |

Private source recipe: open a bounded stable snapshot read-only, validate through the same decoder/profile used by the browser, then write a temporary output in the destination filesystem and atomically rename it. Fixed-file adapters watch the parent directory and periodically rescan. Latest-slot adapters inspect supported card/slot metadata and choose the latest eligible slot using documented timestamp/tie rules, ignoring temporary/unrelated files. Malformed new candidates preserve the last good output with an error. Mount directories rather than single-file `subPath` mounts so atomic sync replacement remains visible. Output lives separately from synchronized inputs; tests never edit saves, restore/rescan sync, or restart production to manufacture results.
