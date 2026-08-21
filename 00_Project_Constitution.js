// ============================================================
//  00_Project_Constitution.gs
//  News OS — 核心原则 · 架构规则 · Coding Laws
//
//  PURPOSE: 任何 AI / 开发者接手必须先读这个文件
//  RULE:    本文件只写原则，不写代码
//  UPDATE:  每次架构变动必须更新本文件
// ============================================================

// ─────────────────────────────────────────────────────────────
// §1  SYSTEM IDENTITY
// ─────────────────────────────────────────────────────────────
//
//  Name    : News OS v1.4
//  Purpose : Auto-collect Malaysian news → score → Telegram brief —
//            now extending into a personal Knowledge OS (Layer 4+)
//  Runtime : Google Apps Script (V8 engine)
//  Database: Google Sheets (10 sheets, 1 spreadsheet)
//  Output  : Telegram bot (HTML parse_mode)
//  Schedule: 4× / day — 07:00 | 12:00 | 18:00 | 21:00 (KL Time)
//  AI used : L1-L3 (core pipeline) — NONE, 100% rule-based, by design
//            L4 Knowledge Engine — Gemini (structured-output entity
//            extraction), hard-isolated from L1-L3 per rule A7 below
//  AI next : L5 Trend (NO AI — pure counting) → L6 Insight (AI,
//            pattern→meaning) → L7 Decision (AI, personalized
//            ranking). Each layer gated behind the previous one
//            proving out first — see Project_State §5/§6.

// ─────────────────────────────────────────────────────────────
// §2  LAYER ARCHITECTURE STATUS  (v1.4 — Steven's CTO ruling)
// ─────────────────────────────────────────────────────────────
//
//  News OS is no longer just "a news bot" — it's the foundation of
//  a personal Knowledge OS. The end goal (Steven's own framing):
//  Personal AI / Investment OS / Property OS should never need to
//  read raw News_Archive. They should query Knowledge_Library /
//  Trend_Library / Insight_Library and get back things like "Johor
//  SEZ has come up 213 times in 18 months" — structured intelligence,
//  not a pile of headlines. THIS is why Knowledge_Library's schema
//  matters more than it looks like it should for "a news bot."
//
//  Full planned architecture, L1-L7:
//
//  ┌──────┬──────────────┬───────────────────────┬─────────────┐
//  │ Layer│ Name         │ Sheet (in → out)       │ STATUS      │
//  ├──────┼──────────────┼───────────────────────┼─────────────┤
//  │  L1  │ Collection   │ RSS → News_Inbox        │ ✅ DONE     │
//  │  L2  │ Filter       │ News_Clean → Filtered   │ ✅ DONE     │
//  │  L3  │ Brief        │ Filtered → Daily_Brief  │ ✅ DONE     │
//  │      │              │   → Telegram            │             │
//  │  L4  │ Knowledge    │ Filtered →              │ 🚧 BUILT,   │
//  │      │              │   Knowledge_Library     │   7-day     │
//  │      │              │                         │   TRIAL     │
//  │  L5  │ Trend        │ Knowledge_Library →     │ ⏳ NOT      │
//  │      │              │   Trend_Library         │   BUILT     │
//  │  L6  │ Insight      │ Trend_Library →         │ ⏳ NOT      │
//  │      │              │   Insight_Library       │   BUILT     │
//  │  L7  │ Decision     │ Insight_Library →       │ ⏳ NOT      │
//  │      │              │   Decision_Library      │   BUILT     │
//  └──────┴──────────────┴───────────────────────┴─────────────┘
//
//  L1-L3 = "News OS"      (the original system, production-stable)
//  L4-L7 = "Knowledge OS" (the new direction, built incrementally,
//                          one layer at a time, never all at once)
//
//  ── WHY ONE LAYER AT A TIME (Steven's explicit instruction) ────
//  Do NOT build L5/L6/L7 alongside or ahead of L4. Until L4 has run
//  for real, nobody knows if entities extract cleanly, if cost is
//  reasonable, or if Gemini's classification holds up. Building L7
//  on an unproven L4 means debugging four layers at once when
//  something looks wrong — impossible to isolate. Each layer is
//  gated behind the previous one being validated. See the trial
//  rule below and Project_State §5/§6 for the live status.
//
//  ── WHY L4 DIDN'T WAIT FOR THE OLD 30-DAY RULE ─────────────────
//  P8 below (NO AI UNTIL STABLE) was written to protect L1-L3 from
//  AI-introduced instability. Steven's ruling: that protection is
//  about BLAST RADIUS, not a calendar. L4 only ever reads from
//  News_Filtered and writes to its own Knowledge_Library table — it
//  is structurally incapable of corrupting L1-L3, even on day one,
//  PROVIDED the isolation guarantee in A7 actually holds (own
//  try/catch, runs after the brief, never writes back into pipeline
//  sheets). That's a different risk profile than "add AI to the
//  scoring engine itself," which is exactly the kind of change the
//  30-day rule still fully applies to.
//
//  ── THE ACTUAL GATE: 7 DAYS, NOT 30 ─────────────────────────────
//  Steven's explicit ruling, replacing the original 30-day default
//  for the Knowledge Layer specifically:
//    "7天已经足够发现：Entity乱不乱 / 成本高不高 / 分类准不准"
//  7 days is enough to learn what 30 days would also tell you here,
//  because the three things that matter — entity quality, cost,
//  classification sanity — show up fast and don't need a calendar
//  month of repetition to become visible. L5 (13_TrendEngine.gs)
//  does not start until this trial is reviewed and Steven signs off.
//  See Project_State §5 for the trial checklist and live dates.
//
//  ── WHAT KNOWLEDGE_LIBRARY IS FOR (the actual point of L4) ──────
//  Steven's framing, worth keeping verbatim in spirit: Trend_Library
//  is just counts — useful, but not the asset. Knowledge_Library is
//  the asset. It's structured, queryable, and is what every future
//  system (Personal AI, Investment OS, Property OS) will read
//  instead of raw news. Schema design on this sheet should be
//  treated with the weight of "this is what 2027-you queries," not
//  "this is a side table for a news bot."

// ─────────────────────────────────────────────────────────────
// §3  CORE PRINCIPLES  (不可违反)
// ─────────────────────────────────────────────────────────────
//
//  P1. PIPELINE ONLY
//      Data flows in ONE direction only:
//      Collect → Dedup → Score → Brief → Telegram
//                                  ↓
//                   Archive → Truncate → Knowledge (housekeeping,
//                   runs AFTER Brief is sent, each step isolated —
//                   see A8. Brief delivery never waits on these.)
//      No backwards flow. No skipping stages.
//      (v1.4 reorder: Brief used to run after Archive. Moved earlier
//      because generateBrief() only ever reads News_Filtered — it
//      has no dependency on Archive/Truncate/Knowledge at all. A
//      360s trigger timeout in housekeeping previously meant the
//      brief silently never sent that run. See Project_State §4.)
//
//  P2. STATELESS FUNCTIONS
//      Every function reads its own state from Sheets.
//      No in-memory state between function calls.
//      All persistent state = Google Sheets.
//
//  P3. BATCH WRITES ONLY
//      All Sheets writes: range.setValues(2D_array)
//      NEVER:            cell.setValue(value)  ← causes timeout
//      Exception:        single status fix (max 1 cell)
//
//  P4. DATE-SAFE ALWAYS
//      NEVER: String(date).startsWith('2026-')
//      ALWAYS: _ds(date) === '2026-06-07'
//      WHY: Sheets silently converts date strings to Date objects
//
//  P5. HTML TELEGRAM ONLY
//      NEVER MarkdownV2 — one wrong char = entire message fails
//      ALWAYS HTML mode: escHtml() for text, raw URL for links
//      ALWAYS fallback: HTML fail → strip tags → plain text
//
//  P6. ARCHIVE IS PERMANENT
//      News_Archive is NEVER truncated, NEVER deleted
//      Inbox + Clean = 7 days only (operational buffer)
//      (Originally written as "powers v3.0 RAG/Personal Memory" — as
//      of v1.4, Knowledge_Library is the more direct target for that,
//      since it's already structured; News_Archive remains the
//      permanent raw-headline backstop underneath it. See
//      Project_State §7.)
//
//  P7. LOG EVERYTHING
//      Every function: sysLog() on success, errLog() in catch
//      System_Log sheet = the source of truth for debugging
//
//  P8. NO AI UNTIL STABLE  (scoped exception added v1.4 — see A7)
//      Rule: run 30 days stable → then add AI to the CORE pipeline
//      v1.1 is rule-based by design, not by limitation
//      EXCEPTION (v1.4): the Knowledge Layer (12_KnowledgeEngine.gs
//      onward) is explicitly exempt from the 30-day wait. This rule
//      exists to protect L1-L3 (Collect/Dedup/Filter/Brief) from
//      AI-introduced instability — but the Knowledge Layer only ever
//      READS from News_Filtered and WRITES to its own tables, so it
//      structurally cannot destabilize L1-L3 even on day one. The
//      isolation guarantee in A7 is what makes this exception safe —
//      it is not a relaxation of caution, it's a different risk
//      profile. The 30-day rule still fully applies to any AI work
//      that would touch the core pipeline itself.

// ─────────────────────────────────────────────────────────────
// §4  ARCHITECTURE RULES
// ─────────────────────────────────────────────────────────────
//
//  A1. MODULE ISOLATION
//      Each .gs file = one responsibility
//      Modules do NOT call each other directly
//      Only 03_Orchestrators.gs chains modules
//
//  A2. CONFIG IS THE API
//      User customizes via Config sheet (A:J), not code
//      keepKw (A) | filterKw (C) | settings (E:F) | sources (H:J)
//      New user-facing settings go in Config, not in code
//
//  A3. SCORE ENGINE OWNS FILTERING
//      06_ScoreEngine.gs is the ONLY place that decides pass/fail
//      filterKw = hard reject (skip immediately)
//      score < 1 = soft reject (failed scoring)
//      Do NOT add filtering logic in other modules
//
//  A4. ORCHESTRATORS OWN SCHEDULING
//      03_Orchestrators.gs is the ONLY file that chains modules
//      Trigger functions live here only
//      runMorningBrief() owns the autoTruncateTables() call — runs
//      AFTER generateBrief() now, not before (see A7)
//
//  A5. TELEGRAM OWNS SENDING
//      09_Telegram.gs is the ONLY file that calls Telegram API
//      No other file makes HTTP calls to Telegram directly
//
//  A6. SINGLE SPREADSHEET
//      All data in one Google Spreadsheet, 10 named sheets
//      Sheet names are CONSTANTS — never rename without updating code
//
//  A7. BRIEF DELIVERY HAS PRIORITY OVER ALL HOUSEKEEPING  (v1.4,
//      generalized after a real 360s trigger timeout — see
//      Project_State §4)
//      generateBrief() only ever reads News_Filtered — it has NO
//      dependency on archiveNews(), autoTruncateTables(), or the
//      Knowledge Layer. So inside runMorningBrief()/runEveningBrief():
//        - collect → dedup → filter → generateBrief() run FIRST,
//          together in ONE try/catch — this is the critical path
//        - archiveNews(), autoTruncateTables(), and any Knowledge-
//          Layer module (12_KnowledgeEngine.gs and future siblings
//          13_TrendEngine / 14_InsightEngine / 15_DecisionEngine)
//          run AFTER, each in ITS OWN separate try/catch
//        - each housekeeping step's public entry point should ALSO
//          wrap its own body in try/catch internally and never
//          re-throw (belt-and-suspenders — see extractKnowledge()
//          in 12_KnowledgeEngine.gs for the pattern)
//        - Knowledge-Layer modules specifically: read FROM pipeline
//          sheets but never write back INTO them — one-way branch
//          only, same spirit as P1
//      WHY: a hard GAS execution timeout is NOT a catchable
//      exception — no try/catch *inside* a step protects anything
//      that was supposed to run *after* it if that earlier step
//      times out the whole trigger. The only real protection is
//      ORDER: put the one thing that actually matters (the brief)
//      ahead of anything that's merely "nice to keep working."
//      This is also what makes the P8 Knowledge-Layer exception
//      safe — if this ordering/isolation is ever violated, P8's
//      exception no longer holds.

// ─────────────────────────────────────────────────────────────
// §5  CODING LAWS  (违反会产生 Bug)
// ─────────────────────────────────────────────────────────────
//
//  L1. FORBIDDEN PARAMETER NAMES
//      NEVER use as function parameters:
//        type, date, time, name, value, text, event, data
//      WHY: GAS V8 runtime conflicts → ReferenceError
//      USE INSTEAD:
//        type → briefType
//        date → briefDate  OR  dateStr  OR  rowDate
//        time → briefTime  OR  timeStr
//        name → sheetName  OR  feedName
//
//  L1b. NO RAW getUi() OUTSIDE onOpen() / confirm dialogs
//      ❌ SpreadsheetApp.getUi().alert('...')
//      ✅ _alert('Title', 'message')   ← from 01_Utils.gs
//      WHY: getUi() throws if function is run from the Apps Script
//           editor (▶ Run) instead of a Sheet menu click.
//           _alert() console.log()s always (visible in Execution log)
//           and tries getUi().alert() in try/catch as a bonus popup.
//      EXCEPTION: YES/NO confirmation dialogs (e.g. clearAllData)
//           genuinely need menu context — wrap in try/catch and
//           print instructions if no UI context exists.
//
//  L2. DATE COMPARISON PATTERN
//      ✅ if (_ds(row[0]) === today) { ... }
//      ✅ var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
//      ❌ if (String(row[0]).startsWith(today)) { ... }
//      ❌ if (row[0] == today) { ... }
//
//  L3. DATE STORAGE PATTERN
//      ✅ Utilities.formatDate(dt, TZ, 'yyyy-MM-dd HH:mm:ss')
//      ❌ new Date().toString()
//      ❌ dt.toISOString()
//      WHY: toString()/ISO format causes Sheets auto-convert
//
//  L4. BATCH WRITE PATTERN
//      ✅ sheet.getRange(startRow, 1, rows.length, cols).setValues(array2D)
//      ❌ rows.forEach(r => sheet.appendRow(r))  ← slow, timeout risk
//      Exception: appendRow() OK for single rows (log, brief record)
//      ❌ ALSO APPLIES TO DELETES: for(...) sh.deleteRow(i) in a loop
//         is the same anti-pattern — each call reflows the whole
//         sheet. This actually happened: autoTruncateTables() did
//         exactly this, sat as dead/unreachable code for an unknown
//         stretch (see Constitution history / Project_State §4), and
//         on its first real run — with a large backlog — caused a
//         real 360s trigger timeout that silently skipped a brief.
//      ✅ To delete many rows by a filter condition: read the whole
//         range once, filter in memory, then ONE clearContent() +
//         ONE setValues() of just the rows to keep. See
//         autoTruncateTables() in 07_Archive.gs for the pattern.
//
//  L5. TELEGRAM MESSAGE PATTERN
//      ✅ escHtml(title) inside <a href="url">...</a>
//      ✅ sendTg(token, chatId, htmlText, optionalKeyboard)
//      ❌ MarkdownV2 formatting (*bold*, _italic_, [text](url))
//      ❌ Direct UrlFetchApp to Telegram outside 09_Telegram.gs
//
//  L6. ERROR HANDLING PATTERN
//      ✅ try { ... } catch(e) { errLog('Module', e.message); }
//      ✅ if (!token || token.startsWith('PASTE_')) { errLog(); return; }
//      ❌ Silent failures (no log, no return)
//
//  L7. SCORE TABLE LOCATION  (changed in v1.2)
//      SCORE_TABLE + IMPACT_LABELS live in 06_ScoreEngine.gs
//      NOT in 00_Config.gs — large objects were moved out to
//      isolate parse-error risk (a single typo in a 50-entry
//      object must not break TZ/NEWS_FEEDS/getConfig() for
//      every other file in the project)
//      To change scoring: edit SCORE_TABLE in 06_ScoreEngine.gs
//      Do NOT duplicate scoring logic in other files
//      Do NOT move SCORE_TABLE back into 00_Config.gs
//
//  L8. NO DUPLICATE FUNCTION DEFINITIONS  (v1.2 lesson learned)
//      GAS does NOT error on two functions with the same name —
//      it silently keeps only the LAST one defined in load order.
//      This already happened once: 06_ScoreEngine.gs had
//      filterNews() defined twice (copy-paste accident while
//      moving SCORE_TABLE around). No error was thrown — it just
//      silently used the second copy.
//      RULE: before pasting a function into a file, grep the file
//      first to confirm it doesn't already exist there.
//      Every pipeline file should have exactly ONE definition of
//      its main function: collectNews, dedupNews, filterNews,
//      archiveNews, generateBrief — one each, no exceptions.
//
//  L9. ALWAYS SET timeoutSeconds ON UrlFetchApp CALLS  (v1.4.2,
//      two real production timeouts before this was caught)
//      ✅ UrlFetchApp.fetch(url, { muteHttpExceptions:true, timeoutSeconds: 12 })
//      ✅ UrlFetchApp.fetchAll(requests) — for 2+ URLs, ALWAYS prefer
//         this over a fetch()-in-a-loop. It fires every request
//         CONCURRENTLY; total time becomes close to the SLOWEST
//         single request, not the SUM of all of them. Each request
//         object in the array takes the same params as fetch(),
//         including timeoutSeconds — set it on every one.
//      ❌ UrlFetchApp.fetch(url, { muteHttpExceptions:true })  ← no
//         bound — defaults to 360s, i.e. the ENTIRE trigger ceiling,
//         per single call
//      ❌ Looping fetch() calls for N URLs — even WITH timeoutSeconds
//         set, this is O(N) sequential network round-trips. Use
//         fetchAll() instead whenever fetching more than one URL.
//      WHY: timeoutSeconds IS a real, documented UrlFetchApp
//      parameter (confirmed against the current official docs:
//      developers.google.com/apps-script/reference/url-fetch/
//      url-fetch-app) — but it is NOT set by default, and its
//      default if omitted is 360s. A single hanging external request
//      (rate-limiting, a dead server, whatever) can silently consume
//      the WHOLE 6-minute trigger ceiling. This caused two separate
//      real production timeouts (Jun 18 and Jun 20, 2026) before the
//      second one's investigation actually found the real cause —
//      the first attempt assumed (wrongly, without checking docs)
//      that no such parameter existed at all, and "fixed" it with a
//      between-iterations elapsed-time check instead — which cannot
//      interrupt a request already in flight, so it didn't actually
//      work. See Project_State §4 for the full incident writeup.
//      Suggested values by call type (adjust if real-world latency
//      proves these wrong): RSS/news feeds 10-15s, REST APIs you
//      control or trust (Telegram, etc.) 15-20s, LLM/batched AI
//      calls 30-60s (legitimately slower, still must be bounded).

// ─────────────────────────────────────────────────────────────
// §6  NEVER DO  (hard stops)
// ─────────────────────────────────────────────────────────────
//
//  ✗  Delete rows from News_Archive
//  ✗  Use MarkdownV2 in Telegram messages
//  ✗  Call setValue() OR deleteRow() in a loop — batch instead (L4)
//  ✗  Use type / date / time as parameter names
//  ✗  Compare dates without _ds()
//  ✗  Call AI APIs in the CORE pipeline (L1-L3 stay rule-based) —
//     the Knowledge Layer (L4+) is the sole, explicit exception,
//     and only because it's isolated per A7/P8
//  ✗  Put user-facing config in .gs code (use Config sheet) —
//     this includes AI model names (Gemini 2.0 Flash was shut down
//     a few months after launch; whatever model is current WILL
//     need to change again)
//  ✗  Call Telegram API outside 09_Telegram.gs
//  ✗  Store state in global JS variables between runs
//  ✗  Call UrlFetchApp.fetch()/fetchAll() without an explicit
//     timeoutSeconds — see L9. Caused two real production timeouts.
//  ✗  Loop fetch() for multiple URLs — use fetchAll() (L9)

// ─────────────────────────────────────────────────────────────
// §7  TIMEZONE RULE
// ─────────────────────────────────────────────────────────────
//
//  ALL time operations use TZ = 'Asia/Kuala_Lumpur'
//  Defined in 00_Config.gs as:  var TZ = 'Asia/Kuala_Lumpur';
//  NEVER hardcode timezone string anywhere else
//  ALWAYS:  Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')

// ─────────────────────────────────────────────────────────────
// §8  CONSTANT PLACEMENT RULE  (v1.2)
// ─────────────────────────────────────────────────────────────
//
//  00_Config.gs holds ONLY:
//    VERSION, TZ, TOP_N           — simple primitives
//    NEWS_FEEDS                   — array of {name,url}, built-in feeds
//    getConfig(), verifyConfig()  — functions
//
//  06_ScoreEngine.gs holds:
//    SCORE_TABLE, IMPACT_LABELS   — large objects (parse-risk isolated)
//
//  04_Collector.gs holds:
//    GN_SEARCH_BASE, GN_LOC       — local to this file only,
//                                   used ONLY for building Config H:J
//                                   domain-based site: search URLs
//
//  RULE: when adding a new constant, ask "how big is this object,
//  and which file actually uses it?" Large objects (10+ entries)
//  go in the file that uses them, not in 00_Config.gs. Small
//  primitives shared by everything go in 00_Config.gs.

// ─────────────────────────────────────────────────────────────
// §9  ENGINEERING / AI-ASSISTED DEVELOPMENT GOVERNANCE
//     (added 2026-08-19 — Universal Governance Propagation)
// ─────────────────────────────────────────────────────────────
//
//  PURPOSE: governs how changes to THIS repository's own files get
//  made and saved during development. Separate from §3 P1-P8
//  (product behavior), §4 A1-A7 (module boundaries), and §5 L1-L9
//  (runtime correctness) — this section is a development-PROCESS
//  rule, not a product rule. Does not modify, gate, or reopen any
//  of those, the L4 trial, or the L5-L7 build restriction.
//
//  SOURCE: canonical rule is Universal_Engineering_Framework v1.12
//  §0.6 items 3-4 (Universal/Master repo; see Universal-Recovery-
//  Manifest.md). This section locally adopts that rule's operational
//  obligation for News OS — it intentionally does not restate the
//  full Universal text. v1.12 remains authoritative if the two ever
//  appear to diverge.
//
//  G1. NO END-OF-SESSION-ONLY EXPORT
//      Any material change to this project's own files — made by a
//      human developer or an AI coding assistant — must not depend
//      on a single export at the end of a work session as its only
//      save point.
//      For each materially changed file:
//        MODIFY → VALIDATE → PERSIST TO THE APPROVED LOCATION
//        IMMEDIATELY → INDEPENDENTLY VERIFY THE PERSISTED COPY IS
//        READABLE → RECORD A CHECKPOINT → only then move to the
//        next file.
//      A higher-level checkpoint (Engine: several files that form
//      one cohesive unit; Sprint: several Engines) is additive on
//      top of this file-level discipline — it never replaces it.
//      Most single News OS changes ARE the Engine for practical
//      purposes, given A1's one-file-one-responsibility boundary;
//      the Engine/Sprint levels matter once a change spans several
//      of this project's own files as one unit.
//
//  G2. NOT THE SAME AS THIS PROJECT'S OTHER USES OF SIMILAR WORDS
//      This section's "checkpoint" = a record that a FILE CHANGE was
//      saved and confirmed readable. It is explicitly NOT:
//        - P2's "persistent state" (Google Sheets holding the app's
//          own RUNTIME data — a different, already-existing concept)
//        - the "checkpoints" in File_Map §6 troubleshooting (sysLog()
//          markers inside a single trigger execution, used to debug
//          360s timeouts)
//        - P7 / the Knowledge Layer's "source of truth" (which SHEET
//          is authoritative for a piece of data)
//        - "verified" as used elsewhere in Project_State (confirming
//          a technical claim against Apps Script's own docs)
//      SCOPE: saving/persisting/recovering this repository's OWN
//      files during development. Does not cover deployment, testing,
//      or Sheets/data migration.
