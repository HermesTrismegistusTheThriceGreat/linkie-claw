# Handover: LinkedIn Post Text Truncation Issue

## Status: RESOLVED

### Root Cause
LinkedIn's Posts API `commentary` field uses the **`little` text format**, which requires
all reserved characters (`| { } @ [ ] ( ) < > # \ * _ ~`) to be backslash-escaped.
Unescaped `(` was being interpreted as MentionElement syntax, causing silent truncation.

### Fix Applied
`escapeForLinkedIn()` function added to `/api/internal/posts/[id]/route.ts` (the endpoint
n8n fetches content from). All reserved characters are escaped with `\` before the content
reaches n8n and LinkedIn's API. Verified working — full 1062-char post published without
truncation (URN: `urn:li:share:7428834655279153152`).

### Reference
- Official docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
- Research: `docs/research/linkedin-api-character-rules.md`

Date: 2026-02-15
Previous session: Phase 1 E2E Publishing Test (phase1-e2e-test team)

---

## What We Were Doing

Executing Phase 1 of the n8n image post fix & e2e test plan (`docs/plans/n8n-image-post-fix-and-e2e-test.md`). The goal was to verify the full publishing pipeline: scheduler → cron → n8n → LinkedIn → callback.

## What Works

- **Full pipeline is functional**: Posts go from `draft` → `scheduled` → `publishing` → `published` in ~2-23 seconds
- **Dev scheduler** (`npm run scheduler:dev`) runs reliably, triggers cron every 60s
- **n8n workflow** receives posts, fetches content, posts to LinkedIn, calls back with URN
- **Callback system** correctly updates post status and LinkedIn URN in DB
- **DB has full content** (1062 chars verified)
- **Internal API** (`/api/internal/posts/[id]`) returns full content to n8n
- **n8n Fetch Post node** receives full content (verified in execution log)

## What's Broken: Text Truncation on LinkedIn

### The Problem

Posts published via the LinkedIn API have their text content **silently truncated**. LinkedIn returns HTTP 201 Created and provides a valid post URN, but the actual post on LinkedIn contains only a fraction of the submitted text.

### Test Results

**Test 1** (original n8n expression template):
- Post: "AI Impact on the Grid" (1062 chars)
- LinkedIn URN: `urn:li:share:7428809700097372162`
- Result: Text truncated at `"up from 4% today"` — right before `(EPRI, 2024)`
- No "see more" link to reveal more text

**Test 2** (after Code node fix — bypassed n8n expression parser):
- Same content, same result
- LinkedIn URN: `urn:li:share:7428818487961227264`
- Result: **Identical truncation** at the same point
- "See more" link appears after "what it's doing to the grid." but expanded text still truncates at `(EPRI, 2024)`

### What This Tells Us

The truncation is **NOT** caused by n8n's expression template parser. We proved this by replacing the expression body with a Code node that builds the JSON payload in pure JavaScript — same truncation. The issue is at the **LinkedIn API level**.

### The Pattern

- Truncation happens at parentheses: `(EPRI, 2024)` contains `(`, `,`, `)`
- The user reports this has been an **ongoing, variable problem** — "some posts get full text, some get more, some get less"
- The amount of text that survives varies by post content — suggesting it depends on which special characters appear and where

### Suspect Characters

- Parentheses: `(` and `)`
- Percent sign: `%` (appears right before the truncation point: "4% today")
- Commas inside parentheses: `(EPRI, 2024)`
- Possibly smart quotes, em dashes, or other Unicode characters in other posts

---

## Fixes Already Applied (Keep These)

### 1. Code Nodes in n8n Workflow (KEEP)

Two new Code nodes were added to the live n8n workflow (`Mn5iz3aOx2dQdNmY`):

- **"Build Text Post Body"** — between IF Has Image (false) and HTTP Request - Text Post
- **"Build Image Post Body"** — between Upload Binary and Create Post With Image

These construct the LinkedIn API JSON payload in pure JavaScript using `JSON.stringify()`, replacing the previous raw expression body templates. While this didn't fix the truncation, it:
- Eliminates any potential n8n expression parser issues
- Uses `.first().json` everywhere (fixes the original `.item` linking bug for image posts)
- Is cleaner and more maintainable

The HTTP Request nodes ("HTTP Request - Text Post" and "Create Post With Image") now have simplified bodies: `={{ $json.requestBody }}`

### 2. Access Token Gate Workaround (KEEP)

`user_settings.linkedin_access_token` = `'n8n-manages-oauth-directly'` for user `qyfk4hx6vdpkr60riz3xjexx`. This passes the cron gate check; n8n uses its own managed OAuth credential.

### 3. Dev Scheduler (WORKING)

`npm run scheduler:dev` calls `/api/cron/publish-scheduled` every 60 seconds. Works reliably.

### 4. `scheduled_at` Type Fix (IMPORTANT)

The `scheduled_at` column is `integer("scheduled_at", { mode: "timestamp" })` — must store **Unix epoch integers**, not ISO strings. Drizzle's `lt()` comparison fails silently with text values.

---

## What the Next Team Needs to Do

### Priority 1: LinkedIn API Research

The missing piece is understanding **how LinkedIn's Posts API handles special characters** in the `commentary` field. Specifically:

1. **Research the LinkedIn Posts API documentation** — look for:
   - Character encoding requirements for `commentary`
   - Known issues with parentheses, percent signs, or other special characters
   - Whether content needs URL encoding, HTML encoding, or specific escaping
   - Maximum character limits and how they interact with special characters
   - The difference between `commentary` field in v2 vs REST API

2. **Search for community reports** — other developers have likely hit this:
   - Stack Overflow: LinkedIn API text truncation
   - n8n community forums: LinkedIn posting issues
   - LinkedIn developer forums
   - GitHub issues on LinkedIn API libraries

3. **Test hypotheses**:
   - Post the same content but with parentheses removed — does full text come through?
   - Post with `%` removed — does that fix it?
   - Try escaping parentheses differently (URL encoding, HTML entities, Unicode escapes)
   - Try the LinkedIn UGC API vs the REST Posts API — different behavior?

### Priority 2: Recommended Team Structure

| Agent | Role | Tools Needed |
|-------|------|-------------|
| **linkedin-researcher** | Deep dive into LinkedIn API docs, community forums, Stack Overflow | WebSearch, WebFetch |
| **n8n-specialist** | Test fixes in the live n8n workflow | n8n MCP, Bash (n8n API) |
| **db-ops** | Manage test posts, monitor status transitions | Drizzle MCP |

### Priority 3: Test Posts to Create

- **Test with no parentheses**: Same AI Grid content but `(EPRI, 2024)` removed → does full text post?
- **Test with encoded parentheses**: Try `\(EPRI, 2024\)` or `&#40;EPRI, 2024&#41;`
- **Test with short content + parentheses**: "Hello world (test)" — does this truncate?
- **Test with other special chars**: em dashes, smart quotes, etc.

---

## Key File Paths

| File | Purpose |
|------|---------|
| `docs/plans/n8n-image-post-fix-and-e2e-test.md` | Original 3-phase test plan |
| `n8n/workflows/linkedin-publish.json` | Local workflow JSON (updated by n8n-updater) |
| `src/app/api/cron/publish-scheduled/route.ts` | Cron route that dispatches to n8n |
| `src/app/api/internal/posts/[id]/route.ts` | Internal API for n8n to fetch post content |
| `src/app/api/webhooks/publish-status/route.ts` | Callback endpoint for n8n to report results |
| `src/scripts/dev-scheduler.ts` | Dev scheduler script |
| `src/lib/db/queries.ts` | Database query helpers |

## Key IDs & Values

| Item | Value |
|------|-------|
| Live n8n workflow ID | `Mn5iz3aOx2dQdNmY` |
| Test user ID | `qyfk4hx6vdpkr60riz3xjexx` |
| Test post ID | `test1_txt_ai_grid` (currently `published` status) |
| LinkedIn person URN sub | `4bIxylM5Ro` |
| n8n webhook URL | `http://localhost:5678/webhook/linkedin-post` |
| LinkedIn API version | `202511` |
| LinkedIn API endpoint | `https://api.linkedin.com/rest/posts` |

## Environment

- Windows 11, no WSL/tmux
- n8n running in Docker (uses `host.docker.internal:3000` to reach Next.js)
- SQLite dev database
- Agent teams via Claude Code with MCP access (n8n + Drizzle)

---

## Phase 1 Verdict

**Pipeline: PASS** — Infrastructure works end-to-end.
**Content integrity: FAIL** — LinkedIn API truncates text with special characters.

Do NOT proceed to Phase 2 (image posts) until the text truncation issue is resolved. The `.first()` fix for image posts is already applied via the Code nodes, but we need reliable text content delivery before testing images.
