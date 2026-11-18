# workflows

Shared GitHub Actions workflows and repository templates for my projects.

## Reusable workflows

Call them by full commit SHA, never a branch, so a change here only reaches a repository through a reviewed bump in that repository.

| Workflow | What it does | Caller needs |
| --- | --- | --- |
| `code-quality.yml` | Runs the package's `format:check`, `lint` and `typecheck` scripts, then `test` and `build` when present. Optional Playwright job (`e2e: true`). Node.js comes from `.nvmrc`, pnpm from `packageManager`. | `contents: read` |
| `dotnet.yml` | Locked-mode restore, Release build and test. | `contents: read` |
| `claude-review.yml` | Reviews each pushed commit with the repository's `.claude/commands/pr-review.md` and `REVIEW.md`, and fails if Claude reports issues or posts nothing. | `CLAUDE_CODE_OAUTH_TOKEN` secret; `contents`, `pull-requests`, `issues: read`; `id-token: write` |
| `claude-mention.yml` | Runs Claude when an issue, comment or review mentions `@claude`. | Same as above, plus `actions: read` |
| `auto-merge.yml` | Turns auto-merge on for same-repository PRs, and off when a PR touches a path in the base branch's CODEOWNERS. | `contents: write`, `pull-requests: write` |
| `codex-approval.yml` | Waits up to 10 minutes for a Codex 👍 on the PR head, and fails on Codex feedback. | `contents`, `pull-requests`, `issues: read` |

Check runs are named `<caller job name> / <workflow job name>`, for example `CI / Check formatting and lint rules`. Required status checks in rulesets must use those names.

### Example callers

```yaml
# .github/workflows/code-quality.yml
name: Code Quality
on:
  pull_request:
permissions:
  contents: read
jobs:
  ci:
    name: CI
    uses: zenzontle/workflows/.github/workflows/code-quality.yml@<sha>
    with:
      e2e: true
```

```yaml
# .github/workflows/claude-code-review.yml
name: Claude Code Review
on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]
# A new push makes the review of the previous commit obsolete.
concurrency:
  group: claude-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true
jobs:
  claude:
    name: Claude
    uses: zenzontle/workflows/.github/workflows/claude-review.yml@<sha>
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

## Templates

`templates/` holds files that should be identical in every repository: Prettier, line endings, Node.js version, the pnpm supply-chain policy, and Claude Code configuration. Copy them in, or check a repository for drift:

```sh
node scripts/sync.mjs ../my-repo                      # copy templates in
node scripts/sync.mjs ../my-repo --check              # exit 1 if anything differs
node scripts/sync.mjs ../my-repo --package client-app # package.json lives in a subfolder
```

`templates/repo/` files go to the repository root and `templates/package/` files next to `package.json`. `.gitattributes`, `pnpm-workspace.yaml` and `.claude/CLAUDE.md` must start with the template and may add repository-specific lines after it. `pr-review.*` and `.mcp.json` are only synced where a repository already has them.

`templates/repo/.claude/commands/pr-review.md` is adapted from Anthropic's code-review plugin under the Apache License 2.0; see `pr-review.LICENSE` next to it.

## License

MIT, except as noted above.
