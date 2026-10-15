# Review and tweak without committing

Use steps 1–5 of [review-and-tweak.md](review-and-tweak.md#review-pass), including
its mandatory reads, independent scores, offline verification, preservation of
the staged loop baseline, and unstaged fixes. Replace its handoff action with
the following; never include its commit authorization.

## Handoff action: stage previous work, keep new tweaks unstaged

Return a brief, ready-to-paste prompt containing the actual run/report path
(or explicitly state that no loop has run),
task, delivery, first review, fixes, scores, and check results. Ask the next
manual agent to assess the combined task independently and give quality/KISS
scores. It may make scoped fixes and rescore after verification.

The prompt must explicitly authorize staging **only the previous pass's scoped
changes** when both final scores are at least 9, no required finding remains,
and relevant checks pass. Preserve the loop's existing staged changes and leave
all tweaks made by this next agent unstaged for the user to compare. Record the
entry-state patch and contents of task-owned untracked files before editing;
if both passes touch the same file, stage its saved entry state rather than
the whole edited file. Check that
the staged diff contains the previous work and the unstaged diff retains the
new tweaks. Never stage unrelated edits or reports.

If either score is below 9 or verification is blocked, report exactly what
prevents approval; keep the index unchanged and any new fixes unstaged.
Never commit, push, clean up runs, launch another agent, or invoke Git-mutating
scripts. These staging permissions belong to the user-sent manual handoff,
never to loop agents.
