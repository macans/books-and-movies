#!/bin/sh
bundle_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec /bin/sh "$bundle_root/install.sh" "$@"
