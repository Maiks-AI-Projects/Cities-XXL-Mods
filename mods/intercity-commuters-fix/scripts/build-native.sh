#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
tool_root="${CXXL_MINGW_ROOT:-}"
compiler="${CXXL_COMMUTERS_CC:-}"
output_dir="$project_root/dist"
output="$output_dir/cxxlcommuters.dll"
smoke_host="$output_dir/cxxlcommuters-smoke.exe"

if [[ -z "$compiler" && -n "$tool_root" ]]; then
  compiler="$tool_root/usr/bin/i686-w64-mingw32-gcc-posix"
fi
if [[ -z "$compiler" ]]; then
  compiler="$(command -v i686-w64-mingw32-gcc-posix || command -v i686-w64-mingw32-gcc || true)"
fi
if [[ -z "$compiler" || ! -x "$compiler" ]]; then
  echo "Missing 32-bit MinGW compiler. Set CXXL_COMMUTERS_CC or CXXL_MINGW_ROOT." >&2
  exit 1
fi

mkdir -p "$output_dir"
compiler_args=()
compiler_path="$PATH"
if [[ -n "$tool_root" ]]; then
  gcc_lib="$tool_root/usr/lib/gcc/i686-w64-mingw32/13-posix"
  target_root="$tool_root/usr/i686-w64-mingw32"
  compiler_args+=("-B$gcc_lib/" "-I$target_root/include" "-L$target_root/lib" "-L$gcc_lib")
  compiler_path="$tool_root/usr/bin:$PATH"
fi

common=(
  "${compiler_args[@]}"
  -std=c11
  -Os
  -Wall
  -Wextra
  -Werror
  -static-libgcc
  -Wl,--no-insert-timestamp
)

PATH="$compiler_path" "$compiler" \
  "${common[@]}" \
  -shared \
  -o "$output" \
  "$project_root/native/cxxlcommuters.c" \
  -lbcrypt

PATH="$compiler_path" "$compiler" \
  "${common[@]}" \
  -o "$smoke_host" \
  "$project_root/native/smoke-host.c"

file "$output" "$smoke_host"
sha256sum "$output" "$smoke_host"
