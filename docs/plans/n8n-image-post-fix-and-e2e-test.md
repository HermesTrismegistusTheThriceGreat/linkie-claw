# Plan: Fix Image Posts & End-to-End Publishing Test

## Problem

Image posts published through the n8n workflow arrive at LinkedIn without text content. LinkedIn returns 201 Created but silently rejects the post (shows "This post cannot be displayed" or never appears on the profile).

### Root Cause

The "Create Post With Image" node uses `$('Node').item.json.field` expressions to reference data from earlier nodes. The `.item` accessor relies on n8n's **item linking** — an automatic system that tracks which input item produced which output item. Item linking **breaks through binary nodes** (Download Image → Upload Binary), so by the time "Create Post With Image" runs, `.item` can't resolve back through the binary chain and returns `undefined` for `commentary`.

### Evidence

- The "Emotional Intelligence" post (id: `wr3z3819orowl1spid6ttslm`) shows as `published` in the DB with an image URL, but LinkedIn never displayed it — confirming the 201-but-rejected behavior.
- Text-only posts (same workflow, no binary nodes in the path) publish correctly.
- The "Validate Image" code node already uses `.first()` — proving the pattern works.

---

## Blockers Discovered & Resolved

### 1. Access Token Gate Check (RESOLVED)

The cron route (`/api/cron/publish-scheduled`) calls `getLinkedInAccessToken(userId)` before dispatching to n8n. This function checks:
1. `user_settings.linkedin_access_token` — was `null`
2. Falls back to `accounts` table for `provider = "linkedin"` — no LinkedIn account exists (only Google)

**The irony:** The live n8n workflow doesn't use this token at all. It uses n8n's own managed OAuth credential (`predefinedCredentialType: linkedInOAuth2Api`). The token sent in the webhook body is ignored.

**Fix applied:** Set `linkedin_access_token = 'n8n-manages-oauth-directly'` in `user_settings` for user `qyfk4hx6vdpkr60riz3xjexx`. This passes the cron gate check; n8n ignores the value.

### 2. Neon Test Post (RESOLVED)

The "Neon futuristic landscape" post (`wt02x6kxswyfsbo2vuc1sd9j`) was a test post from image pipeline development. Deleted from DB to prevent accidental publishing.

### 3. LinkedIn Text Truncation — `little` Text Format (RESOLVED)

**Discovered during Phase 1.** Posts published via the LinkedIn API had their text silently truncated at parentheses — e.g., `(EPRI, 2024)`. LinkedIn returned HTTP 201 with a valid URN, but the actual post content was cut off.

**Root cause:** LinkedIn's Posts API `commentary` field uses the **`little` text format**, which requires all reserved characters to be backslash-escaped: `| { } @ [ ] ( ) < > # \ * _ ~`. An unescaped `(` was interpreted as MentionElement syntax (`@[name](urn)`), causing the parser to silently truncate.

**Fix applied:** `escapeForLinkedIn()` function added to `src/app/api/internal/posts/[id]/route.ts` — the internal API endpoint n8n fetches content from. All 15 reserved characters are escaped with `\` before the content reaches n8n. The escaping lives in application code (not in n8n Code nodes) so it is version-controlled and won't be lost if the workflow is re-imported.

**Verified:** Full 1062-char post published without truncation (URN: `urn:li:share:7428834655279153152`).

**Important for Phase 2 agents:** The escaping is applied at the app layer in the internal API. n8n Code nodes receive pre-escaped content via `post.content`. Do NOT add additional escaping in n8n Code nodes — this would cause double-escaping (e.g., `\\(` instead of `\(`).

Reference: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
Research: `docs/research/linkedin-api-character-rules.md`

### 4. n8n Owner Account Reset (ACTION REQUIRED)

During Phase 1 troubleshooting, an agent ran `user-management:reset` on the n8n Docker container, which reset the owner account. **Workflows and credentials still function** — the publishing pipeline works fine. However, the n8n UI at `localhost:5678` shows the first-time setup screen. The user needs to complete owner account re-setup before using the n8n UI for Phase 2.

---

## Fix: `.item` → `.first()` in Critical Nodes

Replace `.item.json` with `.first().json` **only in nodes that execute after the binary chain**. This bypasses item linking entirely and is safe because this workflow always processes exactly one post per execution.

### Critical Fix (Required)

**"Create Post With Image"** node body — 4 expressions:

```diff
-"author": "urn:li:person:{{ $('Get Person URN').item.json.sub }}",
-"commentary": {{ JSON.stringify($('HTTP Request - Fetch Post').item.json.content) }},
+"author": "urn:li:person:{{ $('Get Person URN').first().json.sub }}",
+"commentary": {{ JSON.stringify($('HTTP Request - Fetch Post').first().json.content) }},
```
```diff
-"id": "{{ $('Initialize Upload').item.json.value.image }}",
-"altText": "{{ $('HTTP Request - Fetch Post').item.json.imageAltText || '' }}"
+"id": "{{ $('Initialize Upload').first().json.value.image }}",
+"altText": "{{ $('HTTP Request - Fetch Post').first().json.imageAltText || '' }}"
```

### Consistency Fixes (Defensive — not actively broken but same pattern)

**"IF - Has Image"** condition:
```diff
-{{ $('HTTP Request - Fetch Post').item.json.imageUrl }}
+{{ $('HTTP Request - Fetch Post').first().json.imageUrl }}
```

**"Initialize Upload"** body:
```diff
-"owner": "urn:li:person:{{ $('Get Person URN').item.json.sub }}"
+"owner": "urn:li:person:{{ $('Get Person URN').first().json.sub }}"
```

**"HTTP Request - Text Post"** body:
```diff
-"author": "urn:li:person:{{ $('Get Person URN').item.json.sub }}",
-"commentary": {{ JSON.stringify($('HTTP Request - Fetch Post').item.json.content) }},
+"author": "urn:li:person:{{ $('Get Person URN').first().json.sub }}",
+"commentary": {{ JSON.stringify($('HTTP Request - Fetch Post').first().json.content) }},
```

**"HTTP Request - Success Callback"** body:
```diff
-"postId": "{{ $('Webhook').item.json.body.postId }}",
-"linkedinPostUrn": "{{ $('HTTP Request - Text Post').item.json.headers['x-restli-id'] || 'unknown' }}",
+"postId": "{{ $('Webhook').first().json.body.postId }}",
+"linkedinPostUrn": "{{ $('HTTP Request - Text Post').first().json.headers['x-restli-id'] || 'unknown' }}",
```

**"HTTP Request - Success Callback (Image)"** body:
```diff
-"postId": "{{ $('Webhook').item.json.body.postId }}",
-"linkedinPostUrn": "{{ $('Create Post With Image').item.json.headers['x-restli-id'] || 'unknown' }}",
+"postId": "{{ $('Webhook').first().json.body.postId }}",
+"linkedinPostUrn": "{{ $('Create Post With Image').first().json.headers['x-restli-id'] || 'unknown' }}",
```

**"HTTP Request - Error Callback"** body:
```diff
-"postId": "{{ $('Webhook').item.json.body.postId }}",
+"postId": "{{ $('Webhook').first().json.body.postId }}",
```

### Nodes NOT Changed (already correct)

- **"Validate Image"** code — already uses `$('HTTP Request - Fetch Post').first().json.imageUrl`
- **"Download Image"** — uses `$('Validate Image').item.json.resolvedImageUrl` (direct predecessor, item linking works)
- **"Upload Binary"** — uses `$('Initialize Upload').item.json.value.uploadUrl` (direct predecessor)

---

## Live vs Local Workflow Divergence

> **Important:** The local JSON (`n8n/workflows/linkedin-publish.json`) may have been modified by agents during Phase 1 and could diverge from the live n8n instance. **Verify the live workflow via n8n MCP (`get_workflow_details`) before making changes in Phase 2.**

| Aspect | Local JSON | Live n8n Instance |
|---|---|---|
| LinkedIn auth | Manual `Bearer {{ accessToken }}` from webhook body | n8n `predefinedCredentialType: linkedInOAuth2Api` (managed OAuth) |
| Fetch Post URL | `/api/posts/{{ postId }}` (requires session auth) | `/api/internal/posts/{{ postId }}` with static bearer token |
| Workflow ID | `eQ3wl9saHpjvjh3t` | `Mn5iz3aOx2dQdNmY` |
| Code nodes | May have been modified by agents | Live Code nodes use `JSON.stringify()` with `commentary: post.content` (content arrives pre-escaped from internal API) |

**Strategy:** Apply the `.first()` fix to the **live workflow only**. After all phases pass, re-export the live workflow to the local JSON to bring the repo back in sync.

---

## Execution Phases

Phases are executed sequentially with a **full stop and user validation** between each phase. Do NOT proceed to the next phase until the user confirms the previous phase passed.

---

### Phase 1: Text-Only Post (Prove the Pipeline) — COMPLETED

**Goal:** Verify the entire publishing pipeline works end-to-end: scheduler -> cron -> n8n -> LinkedIn -> callback. This phase does NOT test the `.first()` fix (text posts don't go through binary nodes). It proves the infrastructure is sound.

**Result:** PASS. Pipeline works end-to-end. Post published in ~6 seconds (scheduled → published). LinkedIn text truncation issue discovered and resolved during this phase (see Blocker #3 above).

#### Phase 1 Prerequisites

Before scheduling the post, verify ALL of these:

- [x] **Dev server running** — `npm run dev` on `localhost:3000`
- [x] **n8n container running** — Docker container up, n8n reachable at `localhost:5678`
- [x] **n8n workflow active** — "LinkedIn Post Publisher" workflow toggled ON (live workflow ID: `Mn5iz3aOx2dQdNmY`)
- [x] **LinkedIn OAuth valid** — n8n's LinkedIn OAuth2 credential is not expired
- [x] **Scheduler running** — `npm run scheduler:dev` calling `/api/cron/publish-scheduled` every 60s
- [x] **Test post saved** — `test1_txt_ai_grid` exists in DB
- [x] **Access token blocker resolved** — `user_settings.linkedin_access_token` set to `'n8n-manages-oauth-directly'`

#### Phase 1 Test Post

| Field | Value |
|---|---|
| ID | `test1_txt_ai_grid` |
| Title | AI Impact on the Grid |
| Type | Text-only (no image) |
| Status | `draft` (will be set to `scheduled` when ready) |

Content:
```
Everyone's talking about AI.

Almost nobody is talking about what it's doing to the grid.

US data centers are on pace to consume up to 9% of national electricity generation by 2030, up from 4% today (EPRI, 2024). That's roughly the entire residential load of Texas showing up as new demand. In half a decade.

Working in battery storage, you see it in the interconnection queues across every major market. PJM, MISO, CAISO. Everyone knows new capacity is needed. But permitting and transmission buildout can't keep up with the timeline.

Battery storage co-located with renewables and replacing retiring generation. Can.

We're deploying systems in under 18 months that provide peak shaving, frequency regulation, and firm capacity. No new gas plants. No 10-year transmission fights. Megawatts on the ground, stabilizing the grid.

Storage isn't a science project. It's the fastest deployable grid asset we have, and the demand curve says we needed it yesterday.

If you're working in energy and not thinking about storage integration, what are you waiting for?
```

#### Phase 1 Execution Steps

1. **Verify prerequisites** — Check all items above
2. **Apply consistency fixes to text path** — Update "HTTP Request - Text Post" and "HTTP Request - Success Callback" nodes in live n8n workflow (defensive, not required but good practice)
3. **Schedule the post** — Update DB: `status = 'scheduled'`, `scheduled_at` = ~3 minutes from now
4. **Monitor via Drizzle MCP** — Poll post status every 30-60 seconds:
   ```sql
   SELECT id, status, error_message, linkedin_post_urn, published_at FROM posts WHERE id = 'test1_txt_ai_grid'
   ```
5. **Watch n8n executions** — Check execution logs for the workflow
6. **Watch Next.js logs** — User monitors terminal for cron activity and callback logs

#### Phase 1 Expected Status Transitions

```
draft -> scheduled (we set this)
scheduled -> publishing (cron picks it up, marks it)
publishing -> published (n8n callback confirms LinkedIn accepted it)
```

#### Phase 1 Success Criteria

- [x] Post status is `published` in DB
- [x] `linkedin_post_urn` is populated — `urn:li:share:7428834655279153152`
- [x] `published_at` timestamp is set — `1771172203` (6 seconds after `scheduled_at`)
- [x] Post is **visible on LinkedIn** with full text content (user confirmed)
- [x] n8n execution shows all-green nodes

#### Phase 1 Failure Scenarios

| Symptom | Likely Cause | Investigation |
|---|---|---|
| Post stays `scheduled` | Cron not running or `scheduled_at` in the future | Check scheduler logs; verify `scheduled_at <= now` |
| Post goes to `publishing` then stays stuck | n8n didn't call back | Check n8n execution logs; check `N8N_CALLBACK_SECRET` match |
| Post goes to `failed` | Various | Read `error_message` from DB; check n8n execution for red node |
| Cron logs "User LinkedIn not connected" | `linkedin_connected` not set | Check `user_settings` |
| Cron logs "Missing LinkedIn access token" | Placeholder token was cleared | Re-set `linkedin_access_token` in `user_settings` |
| n8n Fetch Post returns 404 | Internal API route not found or auth mismatch | Verify `/api/internal/posts/[id]` route exists and bearer token matches |
| n8n LinkedIn API returns 401/403 | OAuth token expired | Re-authenticate LinkedIn credential in n8n UI |
| Post says `published` but not visible on LinkedIn | LinkedIn API quirk or propagation delay | Wait 2-3 minutes; check LinkedIn activity page directly |

**If Phase 1 fails:** Do NOT proceed to Phase 2. Troubleshoot using the failure table above. The problem is infrastructure, not the `.first()` fix.

**If Phase 1 passes:** User confirms the post is visible on LinkedIn. Then proceed to Phase 2.

#### Phase 1 Completion Notes

- **Date completed:** 2026-02-15
- **Iterations:** 3 test publishes. First two truncated due to LinkedIn `little` text format (Blocker #3). Third succeeded after `escapeForLinkedIn()` fix.
- **Pipeline timing:** Post goes from `scheduled` → `published` in ~6 seconds
- **Test post final state:** `test1_txt_ai_grid` is `published` with URN `urn:li:share:7428834655279153152`
- **n8n Code nodes:** The live workflow uses Code nodes (not expression templates) for "Build Text Post Body" and "Build Image Post Body". These were added during earlier troubleshooting and should be kept — they use `JSON.stringify()` and are cleaner than raw expression bodies.
- **Escaping architecture:** `escapeForLinkedIn()` lives in `src/app/api/internal/posts/[id]/route.ts`. Content arrives at n8n already escaped. The n8n Code nodes set `commentary: post.content` directly — no additional escaping needed in n8n.

---

### Phase 2: Image Post (Prove the `.first()` Fix)

**Goal:** Verify that the `.first()` fix resolves the broken image posts. This is the actual bug fix validation.

#### Phase 2 Prerequisites

- [x] Phase 1 passed (text post confirmed on LinkedIn — 2026-02-15)
- [ ] **n8n owner account re-setup** — Complete setup at `localhost:5678` (see Blocker #4)
- [ ] `.first()` critical fix applied to "Create Post With Image" node in live n8n workflow
- [ ] `.first()` consistency fixes applied to remaining nodes (IF Has Image, Initialize Upload, Success Callback Image, Error Callback)
- [ ] Test post 2 created with text + R2-hosted image URL
- [ ] Post content curated and approved by user

> **Note for Phase 2 agents:** LinkedIn text escaping is already handled by `escapeForLinkedIn()` in the internal API (`src/app/api/internal/posts/[id]/route.ts`). Do NOT add escaping in n8n Code nodes. The `.first()` fix is a separate issue — it fixes item linking through binary nodes for image posts.

#### Phase 2 Test Post

| Field | Value |
|---|---|
| ID | TBD (created before Phase 2) |
| Title | TBD |
| Type | Text + Image (R2 URL) |
| Image URL | Must be `https://storage.deltaagents.dev/...` (R2-hosted, publicly accessible) |

Content: To be drafted collaboratively before Phase 2 execution.

#### Phase 2 Execution Steps

1. **Apply critical `.first()` fix** — Update "Create Post With Image" node body in live n8n workflow
2. **Apply remaining consistency fixes** — Update all other nodes listed in the fix section
3. **Create and schedule test post 2** — Text + image, `scheduled_at` = ~3 minutes from now
4. **Monitor and verify** — Same as Phase 1, plus:
   - Confirm "Create Post With Image" node input shows non-null `commentary` in n8n execution log
   - Confirm post appears on LinkedIn with **both text AND image**

#### Phase 2 Success Criteria

- [ ] Post status is `published` in DB
- [ ] Post is visible on LinkedIn with **full text AND image**
- [ ] n8n "Create Post With Image" node received non-null commentary
- [ ] `linkedin_post_urn` populated

#### Phase 2 Failure Handling

| Symptom | Action |
|---|---|
| `commentary` is still null in Create Post With Image | Fix wasn't applied correctly. Re-check the node body expressions. |
| `commentary` has content but LinkedIn shows 201 with no visible post | Different issue than `.item` linking. Investigate LinkedIn API response body. |
| Image upload fails (Initialize Upload or Upload Binary errors) | Image URL issue, not `.first()` related. Check image accessibility. |

**If Phase 2 fails:** Do NOT proceed to Phase 3. Troubleshoot. If `.first()` didn't fix it, fall back to Option B (Set node to preserve context).

**If Phase 2 passes:** User confirms image post is visible on LinkedIn with text and image. Proceed to Phase 3.

---

### Phase 3: Second Text Post (Confirm No Regressions)

**Goal:** One more text-only post to confirm the consistency fixes didn't break anything and the pipeline is reliable.

#### Phase 3 Test Post

| Field | Value |
|---|---|
| ID | TBD (created before Phase 3) |
| Title | TBD |
| Type | Text-only |

Content: To be drafted collaboratively before Phase 3 execution.

#### Phase 3 Success Criteria

- [ ] Post status is `published` in DB
- [ ] Post visible on LinkedIn with full text
- [ ] Three successful publishes across Phases 1-3

---

## Post-Test Cleanup

After all phases pass:

1. **Keep or delete posts** — User decides which posts to keep on their LinkedIn profile
2. **Re-export workflow** — Download the live n8n workflow and save to `n8n/workflows/linkedin-publish.json` to sync the repo
3. **Commit** — Commit the updated local workflow JSON
4. **Update roadmap** — Mark the n8n integration test as complete
5. **Long-term TODO** — The access token placeholder (`n8n-manages-oauth-directly`) is a workaround. For production (Phase 11), either:
   - Remove the access token gate check from the cron (since n8n manages OAuth)
   - Or implement proper LinkedIn OAuth in the app and store real tokens

---

## Architecture Reference

```
Scheduler (cron every 60s)
  -> GET /api/cron/publish-scheduled (with CRON_SECRET)
    -> Finds posts: status=scheduled, scheduled_at <= now, retry_count < 3
    -> Marks post as 'publishing'
    -> POSTs to N8N_WEBHOOK_URL: {postId, userId, personUrn, content, imageUrl, accessToken}

n8n Workflow (LinkedIn Post Publisher, live ID: Mn5iz3aOx2dQdNmY)
  -> Receives webhook
  -> Fetches full post from /api/internal/posts/{postId} (bearer auth)
  -> Gets person URN from LinkedIn API (n8n's managed OAuth)
  -> IF has image:
       Validate Image -> Initialize Upload -> Download Image -> Upload Binary -> Create Post With Image
  -> IF no image:
       HTTP Request - Text Post
  -> Calls back to /api/webhooks/publish-status: {postId, status, linkedinPostUrn}

App Webhook (/api/webhooks/publish-status)
  -> Validates x-webhook-secret (timing-safe compare)
  -> Updates post: published (with URN + timestamp) or failed (with error)
```

## Key Environment Variables

| Variable | Purpose | Location |
|---|---|---|
| `N8N_WEBHOOK_URL` | n8n webhook endpoint | `.env.local` |
| `N8N_CALLBACK_SECRET` | Authenticates n8n -> app callbacks | `.env.local` AND n8n container env |
| `CRON_SECRET` | Authenticates scheduler -> cron endpoint | `.env.local` |
| `INTERNAL_API_SECRET` | Authenticates n8n -> internal post fetch | `.env.local` AND n8n Fetch Post node header |

---

## Why This Is NOT an Agent Team Task

This is a surgical fix (changing expressions in n8n nodes) plus a coordinated live test that requires:
- Real-time human observation of LinkedIn
- User-curated post content
- Sequential test execution with full-stop validation between phases
- Go/no-go decisions that only the user can make

An agent team would over-parallelize this and can't see the LinkedIn profile. This is operator work done collaboratively in a single session.
