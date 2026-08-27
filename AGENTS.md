<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- skill-constructor:start -->
## Project Skill Harness

- This repository is enrolled. Read only task-relevant English generated references under
  `.agents/skills/<project>-project/references/en/` before planning or editing.
- Do not read `references/zh/` unless `$sync-project-skill-locales` reports locale drift. Humans may
  open the Chinese copies; they are translations, not the agent default.
- Invoke `$maintain-project-skill` only when the user asks to maintain project knowledge, required
  facts are unresolved or in conflict, or the task changes architecture, constraints, conventions,
  environment, services, or workflows.
- During those domain tasks, do not record, render, or edit the generated project skill until the
  original work is finished. Then update English facts, render, and invoke
  `$sync-project-skill-locales` when `skill-constructor locales` is not fully synced.
- Do not begin requested work while required manifest facts are unknown, candidate, or conflict.
- Ask the user to resolve every onboarding question; never infer constraints without evidence.
- Invoke `$design-distributed-transactions` for cross-service state changes, MQ publishing or
  consumption, compensation, or MQ selection, and do not complete while its reliability gates fail.
- Continue until the post-task status is `ready` or `skipped`, even when the host's Stop hook is
  advisory. Ordinary implementation edits do not require a rescan.
- Keep `.skill-constructor/manifest.json` and the generated project Skill directory under version
  control, and include their synchronized updates with the related engineering commit unless this
  repository records a verified manifest exception.
- Never edit generated English project-skill files or stage, commit, or push harness updates without
  an explicit user request.
<!-- skill-constructor:end -->
