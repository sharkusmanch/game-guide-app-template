# Public release form

Each gate has status **pass / fail / open / not applicable**, artifact reference, candidate revision and owner. Keep private reports outside public source; only sanitized reusable results enter it.

| Gate | Status | Actual evidence / revision / owner |
|---|---|---|
| Exact game configuration, clean pinned factual inputs, immutable source/tag/bundle digest | open | |
| Public source allowlist: no ROM/save bytes, personal accounts/progress, credentials, private domains or operational/internal records | open | |
| All refs/reachable blobs plus build-context/ignored/untracked review; clean history if donor was private | open | `git ls-files`, `git log --all`, `git rev-list --objects --all`; content/secret scanner plus manual review |
| Redistribution licences and independent fixture oracle; target-core omissions explicit | open | |
| Reviewed candidate/diff and findings resolved | open | |
| Browser tests, typecheck/build and real Docker runtime plus runner output ownership/write/cleanup CI | open | CI run URL and exact commit; missing Docker is pending |
| Template flag and workflow Pages source read back after authorized setup | open | |
| Real HTTPS Pages project path, relative assets, no initial integration requests | open | Actual URL/browser evidence |
| Desktop/mobile, overflow/keyboard, sample upload, tracking/reload/export/restore/new-attempt/undo/raw recovery | open | |
| Public guide claims, unsupported profile UI, manual/facts/actual award distinction | open | |

Publication commands are an authorized release step, not a consequence of filling this form. If publication uses a native worktree and `gh --source` fails, create the ordinary repository, add its remote and push the selected reviewed branch; do not mirror internal refs. A public manual release may pass while genuine decoding, condition assistance and private deployment remain explicitly open.
