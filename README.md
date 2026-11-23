# Sales Pipeline

A single screen for a 20-person sales team that shares one pipeline of 50,000 deals.

## Run it

```bash
npm install && npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app at http://localhost:5173 |
| `npm test` | Runs the unit tests (Vitest, 82 tests) |
| `npm run measure` | Times the query engine against a plain full scan on 50,000 deals and prints a table |
| `npm run build` | Type-checks and builds for production |
| `npm run lint` | Runs oxlint |

There is no backend. A fake API inside the app (`src/features/deals/services/dealService.ts`) holds 50,000 generated deals in memory. It simulates network delay, failed saves and teammates editing deals. Click **Simulator** in the header to change the delay range, the failure rate and how often teammates edit deals. Inside any open deal, **Simulate a teammate edit** creates a conflict on purpose: raise Min delay to 3000 ms, press Move, then press it before the save finishes. Every simulated edit shows a toast with a **Show row** button. A browser refresh regenerates the data.

---

## Write-up

### What I built and why

The screen is organised around the five things the team said:

| What the team said | What the screen does |
|---|---|
| "I don't know which deals to work on today." | A one-row overview of the seven stages (deal count and ₹ value each) and **tabs above the table with live counts**: *All deals · Active · Overdue · Due today · Updated today*. Choosing Overdue or Due today sorts by follow-up date, so the most urgent deal is the first row. Clicking a stage card filters the table to that stage. |
| "I moved a deal, but it didn't save, and nobody told me." | Each save shows **Saving…** on the row. A failure rolls the row back and leaves a red **Not saved · Retry** marker on it, plus a toast that stays until you act. A failure is never silent. |
| "Deals keep jumping around because teammates are editing." | Teammate changes update the row **in place**, flash it and say who changed it. Rows are never re-sorted or removed while you work. A pill offers **Refresh view** when you are ready. |
| "At quarter end I need to move thousands of old deals to Lost." | Tick rows anywhere in the list, or **select every deal in the current view** (for example all 8,292 of mine). Move them in one action, with a confirm step for Won/Lost, a progress bar, Cancel, a result summary, Retry for failures and Undo. |
| "I can't use a mouse for long." | The whole flow works from the keyboard: arrows/j k, Space to select, Shift+arrows, 1–7 to move (the focused row, or the ticked rows), Enter to open, `/` to search, Ctrl+Z to undo, `?` for help. |

**Table, not a board.** A board is the obvious picture of a pipeline, but some stages hold 10,000 deals, and a column of 10,000 cards can't be scanned, sorted or selected in bulk. A table gives dense rows, sorting, multi-select and natural keyboard movement. The board's useful part, seeing how many deals sit in each stage, is kept as a row of stage cards above the table. Those cards also filter the table.

### Key UX decisions and alternatives I rejected

- **Saves are optimistic for single moves and confirmed for bulk moves.** A single move changes the row immediately, because waiting 0.3–1.5 s for every keypress feels broken. For thousands of deals, showing them all as moved and then putting back about 10% of them would flicker and mislead. So bulk rows show *Queued → Lost* and change only when the server confirms. A selection of exactly **one** deal is treated as a single move (instant, with Undo), not as a "bulk move of 1" with a progress bar. Moving a deal from its detail panel closes the panel straight away, because the row already shows the new stage and the toast reports the outcome.
- **Live updates never move rows.** I rejected re-running the query on every teammate change, which is exactly the "jumping around" complaint. A changed row that no longer matches the filter stays, greyed out, with "Moved by Priya · not in this view".
- **Confirmation only where it protects you.** Moving to Won or Lost in bulk asks once, and the confirm button gets focus so Enter confirms. Everything else goes straight through, with Undo available instead of an "Are you sure?" popup.
- **One continuous scrolling list, not pages.** I started with pagination, then changed it once it was clear the users **browse** long lists (all 1,200 Negotiation deals) rather than only filtering. Paging meant 24 clicks and 24 network waits for one stage, which is exactly the "excessive manual actions". Now the table scrolls inside its own area with the filters, tabs and column header always visible. Only the ~20 rows on screen exist in the page (`@tanstack/react-virtual`), rows load in batches of 200 **before you reach them**, and the footer says where you are: *"Rows 201–215 of 1,235"*, with **Back to top**. I rejected plain infinite scroll (appending rows forever), because thousands of real rows on the page would get slow.
- **One place to work, not two.** Overdue and due-today deals used to appear in a separate list as well as the table. They're now **tabs on the table itself**, each with a live count. The rows are then sortable and selectable, so you can bulk-move them and page through them with the keyboard. I rejected keeping a separate list, because it only showed 8 deals and none of the table's tools worked on it.
- **The work comes first.** The overview is a single row of seven stage cards with a **Hide overview** button that's remembered, so the table starts on the first screen. At 1280×800 the first row is at y≈343, or y≈289 with the overview hidden. The simulator is a test tool, so it lives behind a header button.
- **No number shown twice.** An earlier version had a second row of four summary tiles (Overdue, Due today, Active, Won). I removed it: each tile repeated a tab count or the Won stage card, and clicking it did the same as clicking that tab. The cost is the ₹ totals for Overdue, Due today and Active, which only those tiles showed.
- **Least privilege: each role sees only what it needs.** A **Sales Representative** sees and changes only their own deals, and their overview shows only their own numbers. The "Whole team" switch and the Owner column don't exist for them. A **Sales Manager** sees the whole team and can change any deal. **The fake server enforces this, not just the screen:**
  - a rep asking for team data gets their own;
  - saving a teammate's deal returns *"You don't have permission"* and changes nothing;
  - live updates about deals a rep can't see are never sent.

  Login is out of scope, so the Simulator has a "Signed in as" switch for testing.
- **Search covers what the row shows.** The search box matches deal name, company, or the exact deal ID (`deal-23` finds deal-23, not deal-230). It runs after the access check, so a representative searching a teammate's deal ID gets the same "no match" as for an ID that doesn't exist.
- **Native dropdowns, styled.** I kept native `<select>` elements, with consistent styling, instead of building custom ones: they get keyboard, screen-reader and mobile behaviour for free. Stage counts live on the stage cards and tab badges, not inside the dropdown, where they got cut off.
- **Money next to every stage count.** Each stage card shows its total deal value in lakhs and crores (e.g. *5. Negotiation 1,167 · ₹593 Cr*), because value matters as much as count when deciding what to chase. The amounts update live when deals move, and reps see totals for their own deals only.
- **Managers get a "My deals / Whole team" switch** for the shared pipeline and the 50k-deal case.
- **The keyboard moves through the whole list.** ↑/↓ move row by row and the list follows; Page Up / Page Down move one screen (from anywhere on the page, not while typing); Home / End jump to the first / last deal, even 8,000 rows away. Focus is never lost when a row loads in.
- **Quiet colours, one hue per meaning.** Neutral greys for structure. Each stage card has its own colour (indigo, cyan, violet, deep orange, pink, teal and slate for the seven stages), and the stage badges in the table use the same colours. The view tabs have their own: blue Active, red Overdue, amber Due today, green Updated today. Lost is slate, not red: red is kept for Overdue, the thing that needs action. Small uppercase table headers, very light row striping, a blue bar on selected rows, right-aligned money, and the Overdue/Today badge stacked under the follow-up date.

### How I handled failed saves and teammates' changes

- **Every deal has a `version`.** Every save sends the version the user saw. The fake server rejects a save whose version is old with a `conflict` and returns the latest deal. So a teammate's newer change is never overwritten without the user seeing it.
- **Failed save:** the optimistic stage is an *overlay* on top of the server's copy of the deal, so rollback just removes the overlay. Retry sends the move again with version checking, so a retry can't create a duplicate or overwrite a teammate.
- **Conflict:** the latest values are shown, and the user picks **Apply mine** (sent again on top of the latest version) or **Keep theirs**. If the teammate already moved the deal to the same stage, this is reported as done, not as a conflict.
- **Several quick moves on one deal** go through a per-deal queue. A second move made while the first is still saving waits for it and then uses the version the first save produced. Without this, a quick A→B→C would fail as a conflict with your own earlier save.
- **Undo** is a normal, version-checked save. If a teammate changed the deal after your move, Undo reports a conflict instead of overwriting their change.
- **Bulk moves** go in chunks of 200, three requests at a time, and every deal is reported separately: moved, failed, changed by a teammate, already in that stage, or not sent (cancelled). Retry sends only the failed and unsent deals. Undo moves back only the deals that actually moved.
- **Stale responses are ignored:** the client never replaces a deal with an older version than the one it already has.
- **Selection survives live updates.** Each selected deal remembers the version the user saw. If a teammate changes it before the bulk move, it comes back as a conflict, not a silent overwrite.

### Performance

**Virtual scrolling with batch loading.** The brief allows *"pagination or virtualisation"*. Because users browse, I chose virtualization:
- only the rows on screen (plus a few extra) are on the page, about 16–25 table rows whether the list has 50 or 50,000 deals;
- rows arrive from the fake API in batches of 200 by offset, and the next batch is requested about 60 rows before you reach it;
- batches more than two away from what you're looking at are dropped, so memory stays flat even after scrolling through everything;
- the first batch returns a **snapshot id**, and later batches use the same frozen order, so a teammate's edit between batches can't make a row appear twice or go missing. This is what a cursor does on a real API.

Measured on the production build: a fast scroll through 36,000 px of rows caused **zero long tasks**, and no placeholder rows were left once the batches arrived.

**How it stays fast:**

- The client holds only the loaded batches around the visible rows, the open deal and deals with an unfinished save. The store never holds 50,000 rows.
- Each row subscribes only to its own deal (Zustand selector + `memo`), so a teammate update re-renders one row.
- The fake server works like a small database (`src/features/deals/logic/queryEngine.ts`):
  - a **stage index**, so "Negotiation" reads ~7,000 deals instead of scanning 50,000
  - **pre-computed sort keys** (dates as numbers, lowercase names), so sorting and searching never re-parse text
  - a **query cache** plus snapshots, so each new batch of a list is a slice of a ready sorted result; any change to any deal clears the cache for new lists, so results are never stale
- Date and currency formatters are created **once** and reused (`Intl.DateTimeFormat`, `Intl.NumberFormat`) instead of building a new formatter on every `toLocaleString` call.
- Dashboard counts are updated locally after a move, without a refetch.
- Bulk moves go in chunks of 200, three at a time, so the main thread stays free.

**Measured** in headless Chromium, counting *long tasks* (main-thread blocks over 50 ms, which users feel as a freeze), on the production build:

| Action (50,000 deals) | Before | After |
|---|---|---|
| Switch to Whole team | none | none |
| Sort by value | none | none |
| Sort by last updated | 62 ms freeze | **none** |
| Type a search | none | none |
| Quick filter / stage filter | none | none |
| 60 × ↓ through the list | none | none |
| Bulk move of a whole stage (~7,200 deals) | none | none |
| First load | 186 ms | 245 ms |

The first-load block is the fake server starting up: generating 50,000 deals (~140 ms) and building its index once (~50 ms). A real backend does neither in the browser. I chose to build the index eagerly, because building it lazily moved the cost onto the first "Whole team" click instead (64 + 53 ms freezes there). The query itself takes ~7 ms.

In dev mode (`npm run dev`) interactions show 60–90 ms blocks. Profiling shows that is React's development runtime (`jsxDEV`), which the production build removes. The formatter fix above took ~30 ms off each dev page turn.

**Scaling to millions** (not required by the brief, so designed, not built). Data moves to a real database and the client design stays the same:

| Concern | At 50k (built) | At millions (design) |
|---|---|---|
| Storage and querying | In-memory fake server with index + cache | Database with indexes, e.g. `(stage, next_follow_up_at, id)` |
| Loading rows | Offset + snapshot id (frozen order per list) | Cursor ("200 rows after the last one I saw") served by the database |
| Browsing a huge stage | Virtualized list + batches of 200 (built) | Same, with batches served by a database cursor |
| Stage counts | Computed + updated locally | Pre-computed counters; "≈1.28M" for big filtered views |
| Select all | Filter + exclusions (already scale-free) | Same |
| Bulk move | Browser sends chunks | Server bulk job with progress, idempotency key, retry and undo endpoints |
| Live updates | All changes to every client | Subscribe only to the visible window, plus count deltas |
| Search | In-memory `includes` | Search index (Postgres trigram / full-text, or Elasticsearch) |

### Tests

`npm test` runs 82 unit tests over the business logic:

- version conflicts and failed saves in the fake API, and that it returns copies, not shared objects
- the per-deal save queue and version chaining for quick repeated moves
- the bulk runner: partial results, a whole chunk failing, cancel, progress and the concurrency limit
- selecting individual rows anywhere in the list, and "select everything in this view"
- filters (including search by exact deal ID), sorting and dashboard counts
- the query engine returns exactly the same rows as a plain full scan, serves repeats from cache, and is never stale after a change
- the cached formatters produce the same text as `toLocaleString`
- which batches of rows to load ahead and which to drop, and that later batches of a list keep the same order even if a teammate edits in between
- access rules for representatives and managers, enforced by the fake server

I also checked these flows in a real browser: load, keyboard navigation (including keeping focus while rows load in, Home/End across 8,000 rows, and returning focus after closing a deal deep in the list), bulk move with confirm and undo, teammate updates, a failed save with retry, a conflict, both roles, and fast scrolling.

### Known limitations

- Undo covers the most recent action only.
- A single move and a bulk move on the *same* deal at the same moment are not queued against each other. The second one comes back as a conflict and is reported.
- "Select everything in this view" is resolved when you press Move. Deals a teammate moves into the view before then are included, and the screen says so.
- Tab counts refresh about half a second after any change (plus the simulated network delay), so for a moment a count can lag the table.
- Rows have a fixed height (52 px), which the virtual list needs to place rows exactly. Long text is cut with "…" and shown in full on hover (or in the deal panel).
- **Refresh view** (after teammate changes) reloads the list from the top, so you lose your scroll position.
- On a 1280×800 screen about 7 rows are visible with the overview open, and about 8 with it hidden. Larger screens show more (13 at 1920×1080).
- The fake server keeps the 12 most recent list snapshots. If a list's snapshot expires while you scroll, the list reloads from the top.
- In the manager's Whole team view (one extra column), the table scrolls sideways inside its area on screens narrower than about 1,330 px.
- Teammate simulation changes stages only. Simulated failures apply to saves, as the brief describes; page loads always succeed.
- No offline queue: a save made while "offline" fails and has to be retried by hand.
- The browser checks were manual. There are no automated end-to-end tests in the repo.
- First load blocks the page for about 245 ms (production build), because the fake server generates 50,000 deals and builds its index in the browser.
- Access control is **simulated**: the "server" runs in the same browser tab and reads the role from a client-side store, so a determined user could change it. A real backend would take the role from the login token on every request. The rules themselves (`src/features/session/permissions.ts`) are written to move to the server unchanged.
- Only two roles exist (representative, manager). Real teams often need more, such as a manager who sees only their own team, or read-only finance access.
