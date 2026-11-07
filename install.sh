#!/bin/sh
set -eu
bundle_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
[ -f "$bundle_root/extension/manifest.json" ] || { echo 'Extract the complete download before starting the installer.' >&2; exit 1; }
[ ! -e "$bundle_root/extension/data/bootstrap.json" ] || { echo 'This bundle contains a private bootstrap. Use an official clean release.' >&2; exit 1; }
case $(uname -s) in
 Darwin) install_dir=${BOOKS_MOVIES_INSTALL_DIR:-"$HOME/Applications/BooksAndMovies"} ;;
 *) install_dir=${BOOKS_MOVIES_INSTALL_DIR:-"${XDG_DATA_HOME:-$HOME/.local/share}/books-and-movies"} ;;
esac
case "$install_dir" in /*) ;; *) echo 'Installation directory must be an absolute path.' >&2; exit 1 ;; esac
mkdir -p "$install_dir"
install_dir=$(CDPATH= cd -- "$install_dir" && pwd)
[ "$install_dir" != "$bundle_root" ] || { echo 'Choose a different installation directory.' >&2; exit 1; }
staging="$install_dir/extension.new.$$"
mkdir "$staging"
cp -R "$bundle_root/extension/." "$staging/"
if [ -e "$install_dir/extension" ]; then
 mv "$install_dir/extension" "$install_dir/extension.previous.$(date +%Y%m%d%H%M%S).$$"
fi
mv "$staging" "$install_dir/extension"
cp "$bundle_root/install/INSTALL.html" "$install_dir/INSTALL.html"
printf 'Extension prepared at:\n%s\n' "$install_dir/extension"
printf '%s\n' 'In Chrome: chrome://extensions > Developer mode > Load unpacked.' 'Choose the extension folder above. Then open Books & Movies and connect Douban.' 'Chrome requires these final clicks; this helper does not silently install extensions.'
[ "${1:-}" = '--prepare-only' ] && exit 0
case $(uname -s) in
 Darwin)
  printf '%s' "$install_dir/extension" | pbcopy
  if ! open -a 'Google Chrome' "$install_dir/INSTALL.html" 'chrome://extensions'; then
   open "$install_dir/INSTALL.html"
  fi
  ;;
 *)
  if command -v google-chrome >/dev/null 2>&1; then google-chrome "$install_dir/INSTALL.html" 'chrome://extensions' >/dev/null 2>&1 &
  elif command -v chromium >/dev/null 2>&1; then chromium "$install_dir/INSTALL.html" 'chrome://extensions' >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$install_dir/INSTALL.html" >/dev/null 2>&1 &
  fi
  ;;
esac
