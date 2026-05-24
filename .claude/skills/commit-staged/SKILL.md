---
name: commit-staged
description: Gera mensagem de commit pt-BR para as mudanças em stage (apenas staged)
disable-model-invocation: true
---

Use the commit-message-writer agent to inspect staged changes only and produce a commit message.

Scope is always staged only. Run `git diff --cached --stat` and `git diff --cached --name-only` — do not inspect unstaged, untracked, or committed changes.

Do not run `git commit` or any command that modifies the repository. Return the commit message text only, without commentary.
