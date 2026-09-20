#!/bin/sh
set -eu

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
	printf '%s\n' 'Not inside a Git worktree; hooks were not installed.' >&2
	exit 1
}

cd "$repo_root"

if [ ! -x .githooks/pre-commit ]; then
	printf '%s\n' 'Expected executable hook at .githooks/pre-commit.' >&2
	exit 1
fi

hooks_path=$(git config --get core.hooksPath || true)
case "$hooks_path" in
	"")
		git config --local core.hooksPath .githooks
		;;
	.githooks|./.githooks)
		;;
	*)
		printf 'Refusing to replace existing core.hooksPath: %s\n' "$hooks_path" >&2
		exit 1
		;;
esac

printf '%s\n' 'Git hooks installed from .githooks.'
