# Phase 5: LinkedIn OAuth via n8n (Multi-User)

## Goal
Enable multiple users to independently complete LinkedIn OAuth through n8n, storing per-user tokens that allow each user to publish posts under their own LinkedIn account.

## Done When
Both Joseph and Maryam can independently approve LinkedIn OAuth from their own browsers, and both tokens are stored and functional in the same n8n instance.

## Depends On
Phase 4 (Settings page with `user_settings` table and OAuth UI)

---

## Step-by-Step Plan

### 5.1 — Understand the Current OAuth Flow

**Current flow (single-user):**
1. n8n has a single LinkedIn OAuth2 credential configured manually
2. Scheduler triggers n8n webhook with `{ postId: "..." }`
3. n8n uses its stored credential to call LinkedIn API
4. n8n calls back to `/api/webhooks/publish-status` with result

**Problem:** Only one user's LinkedIn account is configured. Adding a second user requires a different approach.

---

### 5.2 — Design Multi-User OAuth Architecture

**Recommended approach:** Store per-user OAuth tokens in the app's database (not in n8n), and pass them to n8n at publish time.

```
┌──────────────────────────────────────────┐
│  User's Browser                          │
│  1. User clicks "Connect LinkedIn"       │
│  2. Redirected to LinkedIn OAuth consent │
│  3. LinkedIn redirects back with code    │
│  4. App exchanges code for access token  │
│  5. Token stored in user_settings table  │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  At Publish Time                         │
│  1. Scheduler sends { postId, userId }   │
│  2. App looks up user's LinkedIn token   │
│  3. App passes token to n8n webhook      │
│  4. n8n uses provided token to publish   │
└──────────────────────────────────────────┘
```

This avoids the complexity of managing per-user credentials inside n8n itself.

---

### 5.3 — Implement OAuth Authorization Flow (App-Side)

#### 5.3.1 — Create OAuth initiation endpoint
`src/app/api/settings/linkedin/connect/route.ts`:

```typescript
export async function POST() {
  const userId = await getAuthUserId();
  
  // Generate a state parameter (random + userId for CSRF protection)
  const state = encodeState({ userId, nonce: generateNonce() });
  
  // Store the state in the database for verification
  await upsertUserSettings(userId, {
    linkedin_oauth_status: "pending",
  });
  
  // Build LinkedIn authorization URL
  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_URL}/api/settings/linkedin/callback`);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "openid profile email w_member_social r_organization_social rw_organization_admin r_basicprofile");
  
  return NextResponse.json({ authUrl: authUrl.toString() });
}
```

> **Note on scopes:** `w_member_social` is required for posting. `r_organization_social` and `rw_organization_admin` are needed for analytics (Phases 6-7). Request all needed scopes upfront.

#### 5.3.2 — Create OAuth callback endpoint
`src/app/api/settings/linkedin/callback/route.ts`:

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  
  // 1. Verify state parameter (CSRF protection)
  const { userId } = decodeState(state);
  
  // 2. Exchange code for access token
  const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/settings/linkedin/callback`,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });
  
  const tokenData = await tokenResponse.json();
  // tokenData: { access_token, expires_in, refresh_token, ... }
  
  // 3. Fetch the user's LinkedIn profile to get their person URN
  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileResponse.json();
  
  // 4. Store encrypted tokens in user_settings
  await upsertUserSettings(userId, {
    linkedin_access_token: encrypt(tokenData.access_token),
    linkedin_refresh_token: encrypt(tokenData.refresh_token),
    linkedin_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000),
    linkedin_person_urn: profile.sub, // LinkedIn person URN
    linkedin_oauth_status: "connected",
  });
  
  // 5. Redirect back to Settings page with success
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?linkedin=connected`);
}
```

#### 5.3.3 — Create token encryption utilities
`src/lib/encryption.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "base64");
const ALGORITHM = "aes-256-gcm";

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

---

### 5.4 — Update n8n Workflow to Accept Tokens

#### 5.4.1 — Modify the n8n webhook payload

Instead of n8n looking up its own stored credential, it should receive the access token in the webhook request:

**Current payload:**
```json
{ "postId": "abc123" }
```

**New payload:**
```json
{
  "postId": "abc123",
  "userId": "user-xyz",
  "accessToken": "encrypted-token-here",
  "personUrn": "urn:li:person:abc",
  "content": "Post content...",
  "imageUrl": "https://..."
}
```

#### 5.4.2 — Update `scheduler/app/jobs.py`

The `trigger_linkedin_publish` function must now:
1. Fetch the post from the app's API (already does this)
2. Fetch the user's LinkedIn token from the app's API (new)
3. Pass both to the n8n webhook

```python
def trigger_linkedin_publish(post_id: str) -> None:
    with httpx.Client() as client:
        # Fetch post details (including user_id)
        post_response = client.get(f"{settings.sunday_api_url}/posts/{post_id}")
        post_data = post_response.json()
        
        # Fetch user's LinkedIn token
        token_response = client.get(
            f"{settings.sunday_api_url}/settings/linkedin/token",
            params={"userId": post_data["userId"]},
            headers={"Authorization": f"Bearer {settings.internal_api_secret}"}
        )
        token_data = token_response.json()
        
        # Send to n8n with token
        response = client.post(
            settings.n8n_webhook_url,
            json={
                "postId": post_id,
                "accessToken": token_data["accessToken"],
                "personUrn": token_data["personUrn"],
                "content": post_data["content"],
                "imageUrl": post_data.get("imageUrl"),
            },
        )
```

#### 5.4.3 — Create internal token API endpoint
`src/app/api/settings/linkedin/token/route.ts`:

This is an **internal-only** endpoint used by the scheduler. It must be protected with the shared secret, not user auth:

```typescript
export async function GET(request: NextRequest) {
  // Verify internal API secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const userId = request.nextUrl.searchParams.get("userId");
  const settings = await getUserSettings(userId);
  
  return NextResponse.json({
    accessToken: decrypt(settings.linkedin_access_token),
    personUrn: settings.linkedin_person_urn,
  });
}
```

#### 5.4.4 — Update n8n workflow JSON
Export the updated workflow to `n8n/workflows/linkedin-publish.json` reflecting the new payload structure. The workflow should:
1. Receive the webhook with token included
2. Use an HTTP Request node (not the LinkedIn credential node) to post to LinkedIn
3. Use the provided `accessToken` in the Authorization header
4. Handle image uploads to LinkedIn's image API if an image URL is provided
5. Callback to the app's publish-status webhook

---

### 5.5 — Handle Token Refresh

LinkedIn access tokens expire (typically in 60 days). Implement a refresh mechanism:

#### 5.5.1 — Create a token refresh utility
`src/lib/linkedin/token-refresh.ts`:

```typescript
export async function refreshLinkedInToken(userId: string): Promise<string> {
  const settings = await getUserSettings(userId);
  const refreshToken = decrypt(settings.linkedin_refresh_token);
  
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });
  
  const tokenData = await response.json();
  
  await upsertUserSettings(userId, {
    linkedin_access_token: encrypt(tokenData.access_token),
    linkedin_refresh_token: encrypt(tokenData.refresh_token),
    linkedin_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000),
    linkedin_oauth_status: "connected",
  });
  
  return tokenData.access_token;
}
```

#### 5.5.2 — Check token expiry before each publish
In the internal token endpoint, check if the token is expired or near-expired and refresh it automatically.

---

### 5.6 — Handle Remote OAuth Approval

**Scenario:** Maryam is on her phone and wants to connect her LinkedIn account.

**Solution:** The OAuth URL generated in step 5.3.1 can be opened from **any browser** — it doesn't need to be the same session or device. The `state` parameter contains the user ID, so the callback knows which user to associate the token with.

**Flow for remote approval:**
1. Maryam logs into the Linkie Claw app
2. Clicks "Connect LinkedIn" on Settings page
3. Gets the OAuth authorization URL
4. Opens it on her phone/another browser
5. Approves on LinkedIn
6. LinkedIn redirects to the callback URL with `code` and `state`
7. Callback decodes `state` to find Maryam's userId, stores her token
8. Maryam refreshes Settings page and sees "Connected"

> **Important:** The callback URL must be publicly accessible (deployed Vercel URL), not `localhost`.

---

### 5.7 — Preserve Existing Templates and Workflows

- Keep the existing n8n workflow file at `n8n/workflows/linkedin-publish.json`
- Create a new version that accepts tokens in the payload
- Document both approaches in the workflow file comments

---

## Verification Checklist

- [ ] User clicks "Connect LinkedIn" → redirected to LinkedIn consent page
- [ ] After approving, redirected back to Settings page with "Connected" status
- [ ] Token is stored encrypted in `user_settings` table
- [ ] Second user can independently connect their own LinkedIn account
- [ ] Both users' tokens are stored in the same database
- [ ] Token refresh works when token is near expiry
- [ ] n8n webhook receives the user's specific access token
- [ ] Publishing a post uses the correct user's token
- [ ] OAuth flow works from a different device/browser (remote approval)
- [ ] Existing n8n workflow still works (backward compatible)
