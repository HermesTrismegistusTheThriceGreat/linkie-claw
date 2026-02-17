# Phase 4: OpenClaw Bot Compatibility

## Goal
Optimize all architecture, naming conventions, component structure, and UI elements so OpenClaw can navigate, read, and interact with the app (click buttons, fill forms) without ambiguity.

## Done When
OpenClaw can navigate every page, click all buttons, and fill all forms without ambiguity.

## Depends On
Phase 3 (Multi-User Support)

---

## Step-by-Step Plan

### 4.1 — Add `data-testid` Attributes to All Interactive Elements

Apply `data-testid` to every clickable, fillable, or visible-state element across the entire app. Use a consistent, hierarchical naming convention.

#### Naming Convention
```
data-testid="[page]-[section]-[element]-[qualifier]"
```

Examples:
- `data-testid="sidebar-nav-dashboard"`
- `data-testid="sidebar-nav-calendar"`
- `data-testid="sidebar-nav-analytics"`
- `data-testid="sidebar-nav-settings"`
- `data-testid="sidebar-nav-ai-writer"`
- `data-testid="sidebar-btn-new-post"`
- `data-testid="sidebar-user-card"`
- `data-testid="login-btn-google"`
- `data-testid="login-btn-github"`

#### 4.1.1 — Sidebar (`src/components/layout/sidebar.tsx`)
Add `data-testid` to every navigation link and button:
```tsx
<Link data-testid={`sidebar-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`} ... >
```

Add to the New Post button:
```tsx
<Link data-testid="sidebar-btn-new-post" href="/create" ... >
```

Add to the user card:
```tsx
<div data-testid="sidebar-user-card" ... >
```

#### 4.1.2 — Login Page (`src/app/login/page.tsx`)
```tsx
<button data-testid="login-btn-google">Sign in with Google</button>
<button data-testid="login-btn-github">Sign in with GitHub</button>
```

#### 4.1.3 — Dashboard (`src/app/page.tsx`)
```tsx
<StatCard data-testid={`dashboard-stat-${card.label.toLowerCase().replace(/\s+/g, '-')}`} ... />
<div data-testid="dashboard-recent-drafts" ... />
<div data-testid="dashboard-follower-chart" ... />
<div data-testid="dashboard-planner" ... />
<div data-testid="dashboard-ai-inspiration" ... />
```

#### 4.1.4 — Calendar Page (`src/app/calendar/page.tsx`)
```tsx
<button data-testid="calendar-btn-prev-month" ... />
<button data-testid="calendar-btn-next-month" ... />
<div data-testid="calendar-month-label" ... />
<div data-testid="calendar-grid" ... />
<div data-testid={`calendar-day-${dayKey}`} ... />
<div data-testid={`calendar-post-${post.id}`} ... />
```

#### 4.1.5 — Create / AI Writer Page (`src/app/create/page.tsx`)
```tsx
<textarea data-testid="writer-input-idea" ... />
<button data-testid="writer-btn-generate" ... />
<div data-testid={`writer-variation-${variation.id}`} ... />
<div data-testid={`writer-image-${image.id}`} ... />
<div data-testid="writer-linkedin-preview" ... />
<button data-testid="writer-btn-schedule" ... />
```

#### 4.1.6 — Schedule Modal
```tsx
<input data-testid="schedule-input-date" ... />
<input data-testid="schedule-input-time" ... />
<button data-testid="schedule-btn-confirm" ... />
<button data-testid="schedule-btn-cancel" ... />
```

#### 4.1.7 — Settings Page (Phase 5)
```tsx
<input data-testid="settings-input-linkedin-url" ... />
<button data-testid="settings-btn-connect-linkedin" ... />
<div data-testid="settings-linkedin-status" ... />
<button data-testid="settings-btn-save" ... />
```

#### 4.1.8 — Analytics Page (Phase 8)
```tsx
<div data-testid="analytics-chart-impressions" ... />
<div data-testid="analytics-chart-engagement" ... />
<div data-testid="analytics-chart-followers" ... />
<div data-testid="analytics-table-posts" ... />
```

---

### 4.2 — Semantic HTML Improvements

#### 4.2.1 — Use proper HTML5 landmarks

Ensure every page follows this structure:
```html
<main data-testid="page-[name]">
  <header data-testid="page-[name]-header">...</header>
  <section data-testid="page-[name]-content">...</section>
</main>
```

#### 4.2.2 — Replace div-based buttons with `<button>` elements
Audit all components for `<div onClick={...}>` patterns and replace with semantic `<button>` elements.

#### 4.2.3 — Ensure heading hierarchy
- Each page should have exactly one `<h1>`
- Subsections use `<h2>`, `<h3>`, etc. in order
- No skipped heading levels

#### 4.2.4 — Use `<nav>` for navigation
The sidebar already uses `<nav>` ✅. Verify this is preserved.

#### 4.2.5 — Form labels
Every `<input>`, `<textarea>`, and `<select>` must have an associated `<label>` element (or `aria-label` if visually hidden).

---

### 4.3 — Predictable Layouts

#### 4.3.1 — No overlapping elements
Ensure no absolutely positioned elements overlap interactive targets. This is especially important for:
- Calendar day cells (posts must not overflow)
- Tooltip positioning
- Modal z-indexing

#### 4.3.2 — Consistent element ordering
Navigation items, form fields, and action buttons should appear in the same order across all pages.

#### 4.3.3 — Visible focus indicators
Ensure all interactive elements have visible `:focus-visible` styles so keyboard/bot navigation is clear.

---

### 4.4 — ARIA Attributes for Dynamic Content

#### 4.4.1 — Loading states
```tsx
<div aria-busy={isLoading} aria-live="polite" data-testid="calendar-grid">
  {isLoading ? <p>Loading...</p> : <CalendarGrid ... />}
</div>
```

#### 4.4.2 — Modals
Ensure the schedule modal uses `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the modal title.

#### 4.4.3 — Toast notifications
The Sonner toaster already handles ARIA. Verify `role="alert"` is present.

#### 4.4.4 — Status indicators
LinkedIn connection status on the Settings page should use `aria-label` to describe the state:
```tsx
<div data-testid="settings-linkedin-status" aria-label="LinkedIn: Connected">
```

---

## Verification Checklist

- [ ] Every interactive element has a unique `data-testid`
- [ ] All `data-testid` values follow the naming convention
- [ ] No duplicate `data-testid` values across the app
- [ ] All forms use `<label>` or `aria-label` for inputs
- [ ] All pages have a single `<h1>` with proper heading hierarchy
- [ ] All buttons use `<button>` elements (not click-handler divs)
- [ ] All modals have proper ARIA attributes
- [ ] No overlapping interactive elements
- [ ] Focus indicators are visible on tab navigation
- [ ] OpenClaw can navigate from Dashboard → Calendar → Create → Settings → Analytics using sidebar links
- [ ] OpenClaw can fill the AI Writer form and click Generate
- [ ] OpenClaw can open and complete the Schedule modal
