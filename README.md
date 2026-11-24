# Sales Pipeline

One screen for a 20-person sales team sharing a pipeline of 50,000 deals.

**Live demo:** https://crmsalespipeline.netlify.app

## Run it

```bash
npm install && npm run dev   # http://localhost:5173
npm test                     # 84 unit tests (Vitest)
npm run build                # type-check + production build
```

There is no backend. A fake API in the browser holds 50,000 generated deals and simulates network delay, failed saves and teammates editing deals. Open **Simulator** in the header to change these, or to switch between the Sales Representative and Sales Manager roles.

## The problems and how I solved them

**1. "I don't know which deals to work on today."**
Stage cards show the count and ₹ value per stage, and tabs above the table (Active, Overdue, Due today, Updated today) answer "what now?". Overdue sorts the most urgent deal first.
*Why a table, not a board:* a stage can hold 10,000 deals, and a column of 10,000 cards can't be scanned, sorted or bulk-selected.

**2. "I moved a deal, but it didn't save, and nobody told me."**
A move updates the row instantly and shows *Saving…*. If the save fails, the row rolls back and keeps a red **Not saved · Retry** marker until you act.
*Why:* waiting a second on every move feels broken, but a failure must never be silent. A per-deal queue keeps quick repeated moves in order.

**3. "Deals keep jumping around because teammates are editing."**
Teammate changes update a row in place and flash it; rows never re-sort while you work, and **Refresh view** appears when you're ready. Every deal has a version, so a save based on an old version is refused, and you see who changed it with **Apply mine** or keep theirs.
*Why:* nobody's work is overwritten without them seeing it.

**4. "At quarter end I need to move thousands of old deals to Lost."**
Tick rows or select every deal in the view, then move them in one action with a confirm step, progress, Cancel, Retry, **Apply mine** for conflicts and Undo. Results name each deal and the reason it didn't move.
*Why server-confirmed, not instant:* showing thousands as moved and then rolling back 10% would flicker and mislead.

**5. "I can't use a mouse for long."**
Everything works from the keyboard: ↑/↓ to move, Space to select, **1–7** to move deals, **Shift+1–7** to filter a stage, **[ ]** to switch tabs, Enter to open, `/` to search, Home to jump to the first deal, Ctrl+Z to undo, `?` for all shortcuts.

**Also built in**
- **50,000 deals stay fast:** only the ~20 visible rows are drawn, rows load in batches of 200 before you reach them, and the fake server uses a stage index and a result cache.
- **Roles:** a representative sees and changes only their own deals; a manager sees the whole team. The fake server enforces this, not just the screen.

## How the code is organised

The code in `src/features/deals/` is split into four layers. Each one only talks to the layer below it:

1. **Screen** (`components/`, `hooks/`): React components draw the table, tabs, panel and bulk bar. Hooks such as `useDealFilters`, `useRowSelection` and `useGlobalShortcuts` hold the screen's state and wire up the keyboard, so `App.tsx` only lays out the page.
2. **State and actions** (`store/`, `actions/`): Zustand stores keep the shared data (loaded deals, save status, selection, bulk progress). Actions such as `moveDeal` and `requestBulkMove` do the work when you press a key: update the row, call the server, and handle success, failure or conflict.
3. **Logic** (`logic/`): pure functions with no React and no network, such as filtering and sorting, dashboard counts, the per-deal save queue, bulk chunking and row batches. This is where the tricky rules live, so this is what the 84 unit tests cover.
4. **Fake server** (`services/`): `dealService.ts` plays the backend. It stores the deals, adds delays and random failures, checks versions and permissions, and simulates teammates.

Because only the fake server knows where the data comes from, replacing it with a real API means changing `services/` alone. The screen, state and logic stay the same.

## What I'd add next

- **A real backend:** database with indexes and cursor paging, logins with the role taken from the token, and bulk moves run as server jobs.
- **Live updates over WebSockets**, sent only for the rows on screen.
- **More than one undo**, plus a change history on each deal.
- **Saved views and more filters:** owner, value range, close date, chosen columns.
- **Offline queue:** keep saves made without a connection and send them when it returns.
- **End-to-end tests** (Playwright) for the keyboard, bulk-move and conflict flows, and a screen-reader accessibility check.
