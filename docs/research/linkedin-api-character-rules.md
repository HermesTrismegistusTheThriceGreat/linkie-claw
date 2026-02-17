# LinkedIn API Character Encoding & Truncation Research

## Executive Summary

**Likely Root Cause:** The LinkedIn Posts API uses the **`little` text format**, which requires escaping all reserved characters (including `*`, `_`, `~`, `<`, `>`, `#`, `@`, `[`, `]`, `(`, `)`, `{`, `}`, `|`, and `\`) with backslashes. If these characters are not properly escaped in the JSON body, LinkedIn's `little` text parser may misinterpret the content and truncate at the first unescaped reserved character.

In the test case, the `%` character (followed by space) is **not** listed as a reserved character in the `little` format specification, but the truncation occurs right after `"4% today"` — before the `(EPRI, 2024)` section. The `(` parenthesis IS a reserved character and requires escaping.

**Hypothesis:** The parenthesis in `(EPRI, 2024)` is being interpreted as the start of a MentionElement URN syntax (format: `@[text](urn:...)`), causing the parser to fail and truncate.

---

## 1. LinkedIn Posts API Documentation

### Commentary Field Specification
- **Field Type:** `little` text format (mandatory for Posts API)
- **Official Docs:** [Posts API - LinkedIn | Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2025-11)
- **Character Limit:** 3,000 characters (test content at 1,062 chars is well within limits)
- **Endpoint:** `POST https://api.linkedin.com/rest/posts`
- **API Version Header:** `LinkedIn-Version: 202511` (version in YYYYMM format)
- **Required Headers:**
  - `X-Restli-Protocol-Version: 2.0.0`
  - `Content-Type: application/json`

### Key Quote from Official Documentation:

> "The commentary field is of type `little` text. The Posts API replaces the ugcPosts API."

---

## 2. The `little` Text Format Specification

### Critical Finding: Reserved Characters MUST Be Escaped

**Official Docs:** [little Text Format - LinkedIn | Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format?view=li-lms-2025-01)

#### Reserved Characters Requiring Escaping:
```
( ) [ ] { } @ # * ~ < > | \ _
```

### Official Specification Quote:

> "Characters reserved for little elements must be escaped to be treated as plaintext. All reserved characters need to be escaped with a backslash, even if those characters are not used in one of the supported elements or templates."

#### Text Grammar Definition:
```
Text ::= ( NON_RESERVED_CHAR_SEQUENCES | '"\\|" | "\\{" | "\\}" | "\\@" |
           "\\[" | "\\]" | "\\(" | "\\)" | "\\<" | "\\>" | "\\#" |
           "\\\\" | "\\*" | "\\_" | "\\~"' )+
```

### Supported Elements That Can Cause Parsing Issues:

1. **MentionElement:**
   ```
   MentionElement ::= '@' FallbackText? '(' 'Urn' ')'
   ```
   Format: `@[DisplayName](urn:li:organization:2414183)`

2. **HashtagElement:**
   ```
   HashtagElement ::= '#' SINGLE_WORD
   ```
   Format: `#hashtag`

3. **HashtagTemplate:**
   ```
   HashtagTemplate ::= '{hashtag|' ( # | ＃) '|' Text}'
   ```
   Format: `{hashtag|#|mytag}`

---

## 3. The Truncation Root Cause Analysis

### Test Case Details:
```
Full text: "...up from 4% today (EPRI, 2024)..."
Truncated at: Right after "up from 4% today"
Position: Truncates right before "("
```

### Analysis:

1. **The `%` is NOT a reserved character** — it should pass through without issues.

2. **The `(` parenthesis IS a reserved character** — it requires escaping as `\(` in the JSON body.

3. **The `little` text parser sees:**
   - Plain text: `"up from 4% today "`
   - **Unescaped `(`:** Interprets as start of MentionElement syntax
   - **Expects:** `@[text](urn:...)` pattern
   - **Finds:** `(EPRI, 2024)` — invalid URN format
   - **Result:** Parser fails, truncates at the error point

### Why Both Tests Truncated At The Same Position:
- **n8n expression template approach:** No escaping applied
- **JavaScript JSON.stringify approach:** Also no escaping of reserved characters
- Both sent unescaped parenthesis to LinkedIn API
- LinkedIn's parser failed identically in both cases

---

## 4. Rest.li Protocol Context

**API Protocol:** LinkedIn uses Rest.li Protocol 2.0

**Relevant Rules:**
- Special characters in query params use tilde-encoding (~) for reserved chars `.[]`
- **Resource keys** must be URL encoded: `(` → `%28`, `)` → `%29`, `:` → `%3A`, `,` → `%2C`
- **JSON body content** (commentary) must use `little` text escaping (backslash-based), NOT URL encoding

**Source:** [LinkedIn API Protocol Versions - LinkedIn | Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/protocol-version)

---

## 5. URL Encoding vs. `little` Text Escaping - CRITICAL DISTINCTION

### This Is The KEY ISSUE:

| Context | Escaping Method | Example |
|---------|-----------------|---------|
| **Query Parameters / Resource Keys** | URL encoding (`%##`) | `urn:li:organization:2414183` → URL encoded in path |
| **JSON Body / Commentary Field** | Backslash escaping (`\char`) | `(EPRI, 2024)` → `\\(EPRI, 2024\\)` |

**Common Mistake:** Using `encodeURIComponent()` or URL encoding on the commentary field.
- **Correct:** Escape with backslash in JSON: `\\(`
- **Incorrect:** URL encode in JSON: `%28`

---

## 6. Community Reports & Related Issues

### Similar Issues Found:

**"Issues when mentioning URNs with special characters using LinkedIn API"**
- [Microsoft Q&A Discussion](https://learn.microsoft.com/en-us/answers/questions/5741122/issues-when-mentioning-urns-with-special-character)
- **Issue:** When special characters (underscore, parenthesis, square brackets) appear in mention URNs, content gets silently dropped from the post
- **Cause:** Unescaped reserved characters confusing the parser
- **Solution:** Proper escaping with backslashes

**"n8n LinkedIn API truncation issues"**
- Community reports mention text getting cut off when special characters aren't properly escaped
- Both expression templates and raw JSON suffer if escaping is omitted

---

## 7. Why This Happens with `(EPRI, 2024)` Specifically

The `little` text parser processes the commentary field looking for:
1. Plain text (anything without reserved chars)
2. Mention syntax: `@[name](urn)`
3. Hashtag syntax: `#word` or `{hashtag|#|word}`

When it encounters an **unescaped `(`**, it enters MentionElement parsing mode:
```
Expects pattern: '@' [ text ] '(' URN ')'
Sees: '(EPRI, 2024)'  ← No @ prefix, invalid URN format
Result: Parse error → Truncate at error point
```

---

## 8. Recommended Fix Approaches

### Option 1: Escape Reserved Characters in n8n (RECOMMENDED)
In the n8n workflow's Expression step, before sending commentary to LinkedIn API:

```javascript
// Escape all little format reserved characters
const escapeLinkedInCommentary = (text) => {
  const reserved = /[()[\]{}@#*~<>|\\\_]/g;
  return text.replace(reserved, (char) => '\\' + char);
};

const safeCommentary = escapeLinkedInCommentary(postText);
```

### Option 2: Escape in Application Code (Alternative)
Update the Next.js API route that sends data to n8n to pre-escape commentary.

### Option 3: Post-Process in n8n Workflow
Add a transformation step in the n8n LinkedIn Posts node to escape reserved characters before posting.

---

## 9. Testing Recommendations

**Test Cases:**
1. Text with `()` — must escape: `"from 4% today \\(EPRI, 2024\\)"`
2. Text with `[]` — must escape: `"[Test]"` → `"\\[Test\\]"`
3. Text with `#` — must escape: `"#hashtag"` (plain text) → `"\\#hashtag"`
4. Text with `@` — must escape: `"email@example.com"` → `"email\\@example.com"`
5. Mix of reserved chars to verify comprehensive escaping

**Validation:**
- Verify full 1,062-char test post publishes completely
- Check LinkedIn feed displays entire text
- Inspect n8n execution logs to confirm escaped JSON is sent correctly

---

## 10. Character Encoding & Content-Type

- **Content-Type:** `application/json` (required)
- **Character Set:** UTF-8 (standard for JSON)
- **Percent Signs:** NOT reserved in `little` format — can be literal `%`
- **Special Note:** Empty strings in Rest.li must be represented as `''` (two single quotes)

---

## Key References

1. **Posts API Official Docs:** [https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2025-11](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2025-11)

2. **little Text Format Spec:** [https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format?view=li-lms-2025-01](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format?view=li-lms-2025-01)

3. **LinkedIn Protocol Versions:** [https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/protocol-version](https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/protocol-version)

4. **URN Issues with Special Characters:** [https://learn.microsoft.com/en-us/answers/questions/5741122/issues-when-mentioning-urns-with-special-character](https://learn.microsoft.com/en-us/answers/questions/5741122/issues-when-mentioning-urns-with-special-character)

5. **Rest.li Protocol Spec:** [https://linkedin.github.io/rest.li/spec/protocol](https://linkedin.github.io/rest.li/spec/protocol)

---

## Summary

The LinkedIn API's `little` text format parser **silently fails** when encountering unescaped reserved characters, truncating the post at the error point. The solution is to escape all reserved characters (`()[]{}@#*~<>|\_`) with backslashes in the JSON body before sending to LinkedIn's API. This is separate from URL encoding and must be done in the JSON body itself.
