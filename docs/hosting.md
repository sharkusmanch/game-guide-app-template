# Private runtime and packaging

The image builds the same `dist/` frontend with Node `24.21.0` and serves it using Alpine `3.24`'s Nginx package. It runs as UID/GID `10000`, binds `8080`, writes configuration/PID/temporary files only under `/tmp`, and handles SIGTERM through Nginx. Renovate annotations identify the base-version inputs. No image push or deployment is automatic.

```sh
docker build -f hosting/Dockerfile \
  --build-arg SOURCE_URL=https://github.com/example/example-rpg-guide \
  --build-arg SOURCE_REVISION="$(git rev-parse HEAD)" \
  --build-arg APP_VERSION=0.1.0 -t example-rpg-guide:local .
docker run --rm --read-only --tmpfs /tmp:rw,nosuid,nodev,noexec,size=16m \
  --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1:8080:8080 example-rpg-guide:local
```

Default `/save` is a missing file; no progress upstream route exists. Root/static assets and `/healthz` work without private integration. Only GET/HEAD are accepted. The runtime validates all settings before writing configuration or resolving an upstream. Symlink save files are denied.

| Environment setting | Contract |
|---|---|
| `SAVE_FILE` | Absolute literal file path, default `/saves/unconfigured.bin`; normal printable filename characters including spaces, parentheses, brackets, commas, plus and `#` are supported; no traversal/empty segments, controls, variables, quotes, backslashes, backticks, semicolons or braces; alias is safely quoted without shell evaluation |
| `PROGRESS_UPSTREAM` | DNS/IPv4 `host:port`, blank by default; ports 1–65535, no URI/credentials |
| `PROGRESS_PREFIX` | Slash-separated URL components of letters/digits/underscore/dot/hyphen, default `/companion`; no trailing slash/traversal or reserved `/save*`, `/healthz`, `/assets`, `/index.html` prefixes; top-level files/directories shipped in `dist/` are also reserved |
| `PROGRESS_IDS` | Empty by default, or at most 32 unique comma-separated integers from 1 to 2147483647; upstream required |

`/save` has exact alias semantics, binary MIME type and `Cache-Control: no-store`, including missing-file responses. Neighbor paths are denied. Each enabled `${PROGRESS_PREFIX}/api/achievements/ra/<id>` preserves the upstream prefix and exact path. Incoming headers, Authorization, cookies and request body are stripped; no browser account credential is included. Same-origin browser session cookies authenticate at the ingress and are a separate layer from upstream service credentials. Cross-origin browser reads omit credentials. Neither behavior establishes environment auth acceptance.

Run `npm run test:hosting` for configuration and installer tests. `npm run test:runtime` requires Docker and a committed candidate: it stages `git archive HEAD`, mounts source read-only, builds in a Node container, returns only output ownership to the runner UID/GID, verifies host write/removal, builds the actual runtime stage and exercises it with a read-only root. Synthetic binary data and a synthetic HTTP upstream test methods, exact routing, credentials/body stripping, health, UID and SIGTERM. Missing Docker means runtime execution is pending, not passed. Checks validates pull requests and manual dispatches. Pages owns the single main-push validation/deployment path; both shared jobs gate deployment and supply the checked frontend artifact. The ownership build does not repeat browser tests or typechecking.

# app-template example

[values.example.yaml](../deploy/values.example.yaml) was linted/rendered against published **app-template 5.3.0**, including its common 5.3.0 library. Obtain the versioned chart through its public HTTPS repository:

```sh
helm repo add bjw-s https://bjw-s-labs.github.io/helm-charts/
helm repo update bjw-s
helm pull bjw-s/app-template --version 5.3.0 --destination /tmp
helm lint /tmp/app-template-5.3.0.tgz -f deploy/values.example.yaml
helm template example-guide /tmp/app-template-5.3.0.tgz \
  --namespace example --values deploy/values.example.yaml
```

The render uses UID/GID 10000, a read-only root, `/tmp` emptyDir, probes and a ClusterIP service. Its all-zero image digest is an intentionally unusable placeholder. Ingress and the existing read-only source PVC are disabled. For a chosen environment, discover its actual chart version, trusted immutable image, storage permissions, ingress auth and additive network policies before applying anything. Review and fill the [private-release form](../skills/build-game-guide/references/private-release.md), including admission and a real authenticated login-to-import session. Render validation alone proves no cluster acceptance. See the [chart documentation](https://bjw-s-labs.github.io/helm-charts/docs/app-template/) for version-specific fields.

Enable a read-only **directory** source mount and select an exact `SAVE_FILE` only after storage review. Fixed battery-file adapters watch its parent for rename/replacement and rescan periodically. Memory-card adapters validate candidate format/card/slot eligibility and use a documented timestamp/tie rule, rather than newest filesystem mtime. Both read bounded stable bytes and atomically write the selected original save/slot bytes to a separate writable directory using a same-filesystem temporary file then rename. `/save` serves this documented browser-supported byte format; normalized bytes require an implemented and validated game/profile decoder. Decoded fact JSON and source freshness/status APIs are separate explicit extensions, not included here. Retain the last good supported bytes when candidates fail; any selection/error/freshness reporting needs its own defined interface. A single-file `subPath` may pin an old inode. Game format selection/normalization belongs in the game adapter; the runtime does not choose slots or edit synchronized saves. Detailed acceptance slots are in the [adapter contract](../skills/build-game-guide/references/adapter-contract.md).

# Trusted publisher integration

Keep each app's canonical public repository and immutable release bundle as its source. After public source/history audit, create a versioned source archive from the reviewed tag and record its SHA-256. Supply that bundle/digest and this Docker recipe to the environment's existing trusted publisher; adapt its temporary build workspace, not a second permanent app tree. Move the app version, immutable source tag/revision and release-bundle digest together for each release. `APP_VERSION` is the first `*_VERSION` Docker argument because the existing publisher uses that argument for its image tag; the runtime stage redeclares it for OCI metadata. Pass source URL, exact source revision and app version as OCI label build args. Accept the resulting immutable image digest only with the expected publisher signature/attestation/provenance and actual environment admission result. Public pull success does not prove trusted-publisher acceptance. This repository does not push images, distribute private accounts or install a cluster release.
