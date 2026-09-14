# Studio shell layout + empty state

**Goal:** Make the Studio document list usable at desktop width: horizontal headings, a real two-column workspace (folder sidebar + main), and a coherent empty state with a primary new-document CTA. Do not change brand/logo/title, visual tokens, or the header 「登录」 session chrome.

**Architecture:** `StudioClient` already owns the two-column layout via `.studio-workspace` (sidebar `.studio-filter-panel` + `.studio-main-panel`). The page wrapper `.studio-shell` must be a centered block shell, not a second 250px/1fr grid. Stage 0 rules in `globals.css` currently win the cascade over `connected.css` and squeeze the single child into the first column, which wraps CJK titles one glyph per line and collapses filter `<select>`s into chevron pills. Empty-state copy stays in `src/messages/*.json` and is read through `getMessages`. Create/rename/delete continue to use existing `Button` + `AppDialog` (no `window.prompt` / `confirm`). Browser auth remains the same-origin BFF with HttpOnly cookies.

**Tech Stack:** Next.js App Router, CSS cascade in `src/app/globals.css` + `src/app/connected.css`, React Query `StudioClient`, Vitest + Testing Library, `getMessages` / JSON locales.

**Out of scope**
- Brand / logo / site title (HappyLadySauce vs Knowledge Core)
- Color tokens / design-system restyle
- Header still showing 「登录」 on Studio (session/BFF/cookie). `SiteHeader` reads `GET /api/bff/auth/session` with default same-origin `fetch` and renders Sign in when `user` is missing; that is not a layout one-liner and is left for a follow-up track.

---

## File structure

- Modify: `src/app/globals.css` — neutralize Stage 0 `.studio-shell` grid; keep heading/empty/orbit; tighten empty-state spacing
- Modify: `src/app/[locale]/studio/page.tsx` — wrap `StudioClient` in `.studio-shell` only (drop `.container-shell` so 1180px does not fight 1440px)
- Modify: `src/components/studio/studio-client.tsx` — empty vs filtered-empty IA; primary CTA
- Modify: `src/messages/en.json`, `src/messages/zh-CN.json` — filtered-empty copy
- Modify: `src/components/studio/studio-client.test.tsx` — empty copy, workspace class, filter visibility
- Create: `src/app/studio-shell.css.test.ts` — regression: `.studio-shell` is not a 250px grid

---

### Task 1: Confirm the cascade (done in investigation)

- [x] Verify `globals.css` `@import "./connected.css"` then later Stage 0 `.studio-shell { display: grid; grid-template-columns: 250px 1fr }`
- [x] Verify `page.tsx` is a single child `StudioClient` inside `.studio-shell.container-shell`
- [x] Verify `StudioClient` root is `.studio-workspace` with `grid-template-columns: 240px minmax(0, 1fr)`
- [x] Match screenshot: sidebar ~full first column, titles wrap vertically, filters collapse, empty-orbit stranded

### Task 2: Neutralize Stage 0 `.studio-shell` grid

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/[locale]/studio/page.tsx`

- [x] Replace Stage 0 `.studio-shell { display: grid; grid-template-columns: 250px 1fr; ... }` with a block shell: `display: block; width: min(1440px, calc(100% - 32px)); margin: 0 auto; min-height: calc(100vh - 74px)` so it wins over `connected.css` without reintroducing a competing grid
- [x] Remove the 820px media-query `.studio-shell { grid-template-columns: 1fr }` (and unused `.studio-sidebar` / `.studio-content` tweaks). Keep `.studio-heading { flex-direction: column }` for small screens
- [x] Keep `.studio-heading`, `.studio-empty`, `.empty-orbit` (still used). Leave unused Stage 0 sidebar/nav rules inert rather than a visual-token restyle
- [x] Change the page wrapper to `className="studio-shell"` only so `.container-shell` (1180px) does not override the Studio max width
- [x] Do not change `.studio-workspace` column template in `connected.css`

### Task 3: Empty-state information architecture

**Files:**
- Modify: `src/components/studio/studio-client.tsx`
- Modify: `src/messages/en.json`
- Modify: `src/messages/zh-CN.json`

- [x] True empty (no search / access / publication / folder): hide `.studio-filters` so chrome is not the focus; keep heading + orbit + `emptyTitle` / `emptyBody` + primary `Button` that opens the existing `AppDialog`
- [x] Filtered empty: keep filters visible; use `emptyFilteredTitle` / `emptyFilteredBody`; primary new-document CTA still available
- [x] Empty-state CTA uses default `Button` (not `secondary`)
- [x] No hardcoded Chinese/English in the component; add keys in both message files
- [x] Tighten `.studio-empty` top margin so the orbit sits with the heading instead of at the viewport bottom
- [x] Do not introduce `window.prompt` / `confirm`

### Task 4: Tests

**Files:**
- Modify: `src/components/studio/studio-client.test.tsx`
- Create: `src/app/studio-shell.css.test.ts`

- [x] Assert `.studio-workspace` is the workspace root
- [x] Assert true-empty copy + New document control; search combobox hidden
- [x] Assert selecting a folder with no docs shows filtered-empty copy and reveals search
- [x] Keep existing dialog-cancel and debounce tests; debounce needs a non-empty list so the search field is mounted
- [x] CSS regression: `globals.css` `.studio-shell` uses `display: block` and does not set `grid-template-columns: 250px`

### Task 5: Verify and PR against `dev`

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] Open PR with base `dev` (not `main`). CI/CD fast-forwards `dev` → `main`; do not merge to `main` from this branch
- [ ] PR summary: cascade cause, before/after, brand + session chrome out of scope
