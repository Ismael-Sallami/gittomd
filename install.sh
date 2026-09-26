#!/usr/bin/env bash
# Installs gittomd for the current user, without sudo.
#
#   curl -fsSL https://raw.githubusercontent.com/Ismael-Sallami/gittomd/main/install.sh | bash
#
# Options (as environment variables or arguments):
#   GITTOMD_VERSION=v1.0.0   install a given tag instead of the latest release
#   GITTOMD_HOME=<dir>       where the code goes (default ~/.local/share/gittomd)
#   GITTOMD_BIN=<dir>        where the command goes (default ~/.local/bin)
#   GITTOMD_SOURCE=<dir>     install from a local copy instead of downloading
#   --uninstall              remove gittomd

set -euo pipefail

REPO="Ismael-Sallami/gittomd"
APP_DIR="${GITTOMD_HOME:-$HOME/.local/share/gittomd}"
BIN_DIR="${GITTOMD_BIN:-$HOME/.local/bin}"

say() { printf '%s\n' "$*"; }
fail() { printf 'gittomd: %s\n' "$*" >&2; exit 1; }

if [ "${1:-}" = "--uninstall" ]; then
  rm -f "$BIN_DIR/gittomd"
  rm -rf "$APP_DIR"
  say "gittomd removed. The saved token, if any, is in ~/.config/gittomd (delete it with: rm -rf ~/.config/gittomd)."
  exit 0
fi

command -v node >/dev/null 2>&1 || fail "Node.js 18 or newer is needed. Install it from https://nodejs.org and run this again."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 18 or newer is needed (you have $(node -v))."
command -v tar >/dev/null 2>&1 || fail "tar is needed."

download() {
  if command -v curl >/dev/null 2>&1; then curl -fsSL "$1"
  elif command -v wget >/dev/null 2>&1; then wget -qO- "$1"
  else fail "curl or wget is needed."
  fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -n "${GITTOMD_SOURCE:-}" ]; then
  say "Installing gittomd from $GITTOMD_SOURCE..."
  cp -R "$GITTOMD_SOURCE/." "$TMP/"
else
  VERSION="${GITTOMD_VERSION:-}"
  if [ -z "$VERSION" ]; then
    VERSION="$(download "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null \
      | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1 || true)"
  fi
  if [ -n "$VERSION" ]; then
    URL="https://github.com/$REPO/archive/refs/tags/$VERSION.tar.gz"
  else
    VERSION="main"
    URL="https://github.com/$REPO/archive/refs/heads/main.tar.gz"
  fi
  say "Installing gittomd $VERSION..."
  download "$URL" | tar -xz -C "$TMP" --strip-components=1 || fail "could not download $URL"
fi
[ -f "$TMP/bin/gittomd.js" ] || fail "the download does not look like gittomd"

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR" "$BIN_DIR"
cp -R "$TMP/bin" "$TMP/src" "$TMP/package.json" "$APP_DIR/"
if [ -f "$TMP/LICENSE" ]; then cp "$TMP/LICENSE" "$APP_DIR/"; fi
chmod +x "$APP_DIR/bin/gittomd.js"
ln -sf "$APP_DIR/bin/gittomd.js" "$BIN_DIR/gittomd"

say "Installed: $BIN_DIR/gittomd ($("$BIN_DIR/gittomd" --version))"
case ":$PATH:" in
  *":$BIN_DIR:"*) say "Try it: gittomd Ismael-Sallami/gittomd   (or any owner/repo, a GitHub URL or a folder)" ;;
  *)
    say ""
    say "$BIN_DIR is not in your PATH. Add this line to ~/.bashrc or ~/.zshrc:"
    say "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac
