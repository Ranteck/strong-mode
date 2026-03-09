#!/bin/sh

set -eu

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

detect_package_manager() {
  if [ -n "${SLOP_FREE_PACKAGE_MANAGER:-}" ]; then
    printf '%s\n' "$SLOP_FREE_PACKAGE_MANAGER"
    return 0
  fi

  if [ -f package-lock.json ]; then
    printf 'npm\n'
    return 0
  fi

  if [ -f pnpm-lock.yaml ]; then
    printf 'pnpm\n'
    return 0
  fi

  if [ -f yarn.lock ]; then
    printf 'yarn\n'
    return 0
  fi

  if [ -f bun.lockb ]; then
    printf 'bun\n'
    return 0
  fi

  case "${npm_config_user_agent:-}" in
    npm/*)
      printf 'npm\n'
      return 0
      ;;
    pnpm/*)
      printf 'pnpm\n'
      return 0
      ;;
    yarn/*)
      printf 'yarn\n'
      return 0
      ;;
    bun/*)
      printf 'bun\n'
      return 0
      ;;
  esac

  printf 'npm\n'
}

add_bin_dir_to_path() {
  bin_dir="$1"
  executable_name="$2"

  if [ -x "$bin_dir/$executable_name" ]; then
    PATH="$bin_dir:$PATH"
    export PATH
    return 0
  fi

  return 1
}

resolve_executable() {
  executable_name="$1"

  if command -v "$executable_name" >/dev/null 2>&1; then
    return 0
  fi

  for bin_dir in \
    "$HOME/.bun/bin" \
    "$HOME/.volta/bin" \
    "$HOME/.asdf/shims" \
    "$HOME/.mise/shims" \
    "$HOME/.local/share/fnm/current/bin" \
    "$HOME"/.local/share/fnm/node-versions/*/installation/bin \
    "$HOME"/.nvm/versions/node/*/bin \
    /opt/homebrew/bin \
    /usr/local/bin \
    /usr/bin
  do
    if add_bin_dir_to_path "$bin_dir" "$executable_name"; then
      return 0
    fi
  done

  return 1
}

package_manager="$(detect_package_manager)"

if resolve_executable "$package_manager"; then
  exec "$package_manager" "$@"
fi

case "$package_manager" in
  pnpm|yarn)
    if resolve_executable corepack; then
      exec corepack "$package_manager" "$@"
    fi
    ;;
esac

printf 'Could not find `%s` for git hooks. Install it or expose your Node toolchain to GUI git clients. Looked from `%s`.\n' \
  "$package_manager" \
  "$ROOT_DIR" >&2
exit 127
