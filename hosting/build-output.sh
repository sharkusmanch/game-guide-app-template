#!/bin/sh
# Copy read-only source into container-local work; return only mounted output ownership.
set -eu
build_source=$1
build_output=$2
runner_uid=$3
runner_gid=$4
build_work=$(mktemp -d)
cleanup() {
  chown -R "$runner_uid:$runner_gid" "$build_output"
  rm -rf "$build_work"
}
trap cleanup EXIT
cp -R "$build_source/." "$build_work/"
cd "$build_work"
npm ci
npm run build
cp -R dist/. "$build_output/"
