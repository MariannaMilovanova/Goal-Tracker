#!/bin/bash
set -euo pipefail

watch_test_root="$(cd "$(dirname "$0")/../.." && pwd)"
watch_test_developer_dir="$(xcode-select -p)/Platforms/MacOSX.platform/Developer"
watch_test_binary="$(mktemp "${TMPDIR:-/tmp}/one-goal-watch-tests.XXXXXX")"
trap 'rm -f "$watch_test_binary"' EXIT

xcrun swiftc \
  -I "$watch_test_developer_dir/usr/lib" \
  -F "$watch_test_developer_dir/Library/Frameworks" \
  -L "$watch_test_developer_dir/usr/lib" \
  -Xlinker -rpath -Xlinker "$watch_test_developer_dir/Library/Frameworks" \
  -Xlinker -rpath -Xlinker "$watch_test_developer_dir/Library/PrivateFrameworks" \
  -Xlinker -rpath -Xlinker "$watch_test_developer_dir/usr/lib" \
  "$watch_test_root/ios/onegoal/OneGoalWatch/WatchModels.swift" \
  "$watch_test_root/ios/Tests/WatchModelsTests.swift" \
  -o "$watch_test_binary"
"$watch_test_binary"
