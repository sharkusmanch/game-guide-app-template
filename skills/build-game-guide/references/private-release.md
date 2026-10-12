# Private release form

Complete only for an authorized private integration. Each row records **pass / fail / open / not applicable**, exact immutable candidate, artifact reference and owner. Public CI or a port-forward cannot close environment gates.

| Gate | Status | Actual evidence / candidate / owner |
|---|---|---|
| Current service source/revision, existing auth/routes/guide features; minimal adapter delta and regressions | open | |
| Trusted existing publisher, immutable source bundle/tag/digest, image source/revision/version/platform/user | open | |
| Image digest, signature/attestation/provenance verification and actual enforced admission result | open | Anonymous pull alone is insufficient; digest-verified OCI referrer/fallback bundle if needed |
| Discovered current chart version; render/schema and environment diff reviewed | open | Starter example render proves no deployment |
| Ingress auth/trust reviewed; actual authenticated login-to-import browser session | open | Anonymous redirect and port-forward are separate evidence |
| Exact allowed IDs/path prefix, no incoming auth/cookies/body upstream, strict hardcore feed identity/time | open | |
| UID/GID 10000, read-only root/source directories, `/tmp`, source type/size/hash equality, restart/resources/probes/monitoring | open | |
| Directory mount replacement semantics; deterministic eligible-slot selection; atomic output; partial/unsupported write last-good freshness | open | Declare unobserved replacements open; no live save edits/restores/rescans |
| Long-lived source/destination identities, existing additive policies inventoried, selected ingress/upstream/DNS allowed, peers denied with known reachable baseline | open | Environment-specific policy review; no generic deny claim |
| Browser deadline/cancellation/races/manual precedence, raw recovery/export/restore and separate run assignment | open | |
| Genuine intended-core decoder acceptance and actual hardcore awards (if claimed) | open | Source/synthetic validation are separate levels |
| Cleanup/rollback ownership, monitoring and remaining gate owners | open | |

Use the existing trusted publication pipeline with this app's immutable public source bundle and common runtime recipe. Reconcile that pipeline's source layout rather than vendoring another permanent copy. Enforced trust or additive networking that rejects the candidate remains a gate; do not bypass admission or copy another environment's policy.
