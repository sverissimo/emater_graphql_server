# Review and tweak

Manual routine for an explicit user request. Creating or reading this file alone
does not run it. Follow [AGENTS.md](../../AGENTS.md)
and [the workflow guide](../agent-workflow.md). The gateway architecture and
contract rules are in AGENTS.md; this repo has no backend/frontend subpackages.
Read the relevant aggregate, schema fragment, repository, resolver, and REST
routes for the task. Preserve ESM imports and BigInt/DateTime wire formats.
For existing contract changes, inspect PNAE and other consumers as required by
AGENTS.md and obtain sign-off before changing the contract.
Never launch a real loop, mutate sibling files, or run prohibited operations.

## Review pass

1. **Preserve the baseline.** Read `git status --short`, `git diff --cached`,
   `git diff`, and relevant untracked files. Record the staged patch identity
   and existing unstaged edits. Keep the index unchanged throughout this pass;
   preserve user work and distinguish it from your changes. If edits overlap
   ambiguously, clarify ownership before replacing them.
2. **Identify the run.** Inspect `.agent-runs/` (the actual folder name), its
   reports and relevant worktree files read-only. Use timestamps to find
   candidates, then match `input.json` task/acceptance, base/head, branch, and
   delivered diff to the staged changes. Identify the latest executed task and
   whether it is the run represented in the index; report both if different.
   If no loop has run, review the user-identified working changes directly and
   state that run evidence is unavailable; do not invent a run or scores.
   Inspect each round's inputs when present, `result.json` or provider output,
   check reports, and relevant diagnostics. State missing evidence rather than guessing.
3. **Review independently.** Assess the original task and acceptance against the
   staged delivery, related code/docs, and actual run evidence before comparing
   with the loop's scores. Give quality and KISS scores out of 10, supported by
   concrete findings and optional polish. Explain missed issues or score gaps
   with evidence; check what context/tools the reviewer actually received.
   Two rounds or high scores alone do not prove a broken loop.
4. **Tweak and verify.** Address justified findings within scope in the main
   working tree. Leave your edits unstaged and the loop's staged patch intact;
   do not edit its retained worktree/reports. Record non-blocking unknowns using
   [open-questions.md](../open-questions.md). Run appropriate permitted offline
   checks and distinguish fresh results from saved loop results. For TypeScript,
   use `node node_modules/typescript/bin/tsc --noEmit --incremental false`; run
   focused mocked tests with `node --import tsx --test <explicit-test-paths>`.
   `npm test` is a failing placeholder; there is no `typecheck` npm script.
   Use `python3 -B -m unittest discover -s tests` for coordinator changes.
   Never build, start servers, access databases, or test live endpoints. Recheck the
   index identity, report files changed and before/after scores without inflating
   them to meet a threshold. Do not stage or commit in this pass.
5. **Hand off.** Return a brief, ready-to-paste prompt for a separate agent.
   Fill in the actual run name/report path (or explicitly state there was no run),
   requested scope, delivered result, findings, edits, scores, and verification.
   Include the action below.
   Do not launch the next agent yourself.

## Handoff action: review, then possibly commit

Ask the next agent to read the instructions and run evidence, inspect staged
and unstaged task changes together, and give its own impartial review and
quality/KISS scores. It may make scoped fixes, rerun relevant checks, and rescore.
Prior scores are context, not targets.

The prompt must explicitly authorize this manual agent to stage the combined
task changes and commit **only when both final scores are at least 9, no
required finding remains, and relevant checks pass**. Stage only the identified
task files/hunks, preserving unrelated work, and use a pt-BR commit message.
Do not push, clean up runs, or invoke Git-mutating scripts. If either score is
below 9, report the specific findings/nits and leave the index unchanged and any
new edits unstaged. If verification is blocked, report that and do not commit.
These Git permissions belong to the user-sent handoff, never to loop agents.

For a handoff that never commits, use
[review-and-tweak-but-dont-commit.md](review-and-tweak-but-dont-commit.md).
