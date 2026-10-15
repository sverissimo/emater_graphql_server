#!/usr/bin/env bash
# Stage a task on main without committing; preserve its branch, worktree, and reports.
# Usage: bash scripts/finish-run.sh <name> [--stage | --cleanup | --discard]
# --cleanup removes a completed run after its changes are committed on main.
# --discard removes the run without changing main's files, index, or commits.
# User-run only; agents must not invoke Git-mutating scripts (AGENTS.md).
set -euo pipefail

name="${1:?usage: bash scripts/finish-run.sh <name> [--stage | --cleanup | --discard]}"
mode="${2:---stage}"
if [[ ! "$name" =~ ^[a-z0-9][a-z0-9-]{0,63}$ ]] || [ "$#" -gt 2 ]; then
  echo "Invalid task name or arguments." >&2
  exit 1
fi
case "$mode" in
  --stage|--cleanup|--discard) ;;
  *) echo "Expected --stage, --cleanup, or --discard; this script never commits." >&2; exit 1 ;;
esac
branch="ai/$name"
run_dir=".agent-runs/$name"

# Disable hooks for coordinator mutations, as in agent-loop.py.
git() { command git -c core.hooksPath=/dev/null -c core.fsmonitor=false "$@"; }

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if ! git rev-parse --verify --quiet "refs/heads/$branch" >/dev/null; then
  echo "Branch $branch does not exist." >&2
  exit 1
fi

if [ "$mode" != --discard ]; then
  if [ "$(git branch --show-current)" != main ] || [ -n "$(git status --porcelain)" ]; then
    echo "Check out a clean main before staging or cleanup." >&2
    exit 1
  fi
  if [ ! -d "$run_dir/worktree" ] || [ -n "$(git -C "$run_dir/worktree" status --porcelain)" ]; then
    echo "$run_dir/worktree has unfinished edits; commit or discard them first." >&2
    exit 1
  fi
  patch_file="$(mktemp)"
  trap 'rm -f "$patch_file"' EXIT
  git diff --no-ext-diff --no-textconv --binary "main...$branch" > "$patch_file"
  if [ "$mode" = --cleanup ]; then
    if [ -s "$patch_file" ] && ! git apply --reverse --check --cached "$patch_file"; then
      echo "Task changes are not committed on main; retaining the run." >&2
      exit 1
    fi
  else
    if [ ! -s "$patch_file" ]; then
      echo "No changes to stage from $branch."
    elif git apply --reverse --check --cached "$patch_file" 2>/dev/null; then
      echo "Task changes are already committed on main; use --cleanup when ready."
    else
      # Apply atomically to files and index; conflicts leave main unchanged.
      git apply --index "$patch_file"
      echo "Staged $branch on main without committing. Review and commit manually."
    fi
    echo "Retained $branch, $run_dir/worktree, and reports."
    exit 0
  fi
fi

if [ -d "$run_dir/worktree" ]; then
  if [ "$mode" = --discard ]; then
    git worktree remove --force "$run_dir/worktree"
  else
    git worktree remove "$run_dir/worktree"
  fi
fi
git branch -D "$branch"
git worktree prune
rm -rf "$run_dir"
echo "Finished $branch; removed $run_dir, including its reports."
