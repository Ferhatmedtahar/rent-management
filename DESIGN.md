# Design System

Calm, trustworthy, Apple-like UI for a money product. Blue accent, neutral
surfaces, generous whitespace, light and dark themes. Tokens live in
`app/globals.css`; this file explains how to use them. Components come from
shadcn/ui (Radix) and are styled only through these tokens.

## Principles

1. **Trust over decoration.** One accent (blue). Color carries meaning (status),
   never ornament. No gradients, no heavy shadows.
2. **Numbers first.** Amounts are the product. They are aligned, tabular and
   unambiguous, and always formatted by `formatMoney()` (AGENTS.md section 5).
3. **Every screen has four states:** loading, error, empty (with a CTA),
   success. A blank screen is a bug.
4. **Accessible by default.** WCAG AA contrast, visible keyboard focus, labels
   on every input, no information by color alone.
5. **Appearance-adaptive.** Every color is a `light-dark()` pair. Never hardcode
   a hex in a component; use a token.

## Theme

- Follows the system by default (`color-scheme: light dark`).
- A user choice pins it with `<html data-theme="light|dark">`. The Tailwind
  `dark:` variant follows the same rule (pinned theme wins over the system).
- A theme toggle (system / light / dark) is added with the app shell; it only
  sets `data-theme` and persists the choice.
- `<html data-density="desktop">` switches the type scale to compact macOS sizes
  for dense tables if needed.

## Color

All values are tokens in `app/globals.css`. Use the Tailwind class
(`bg-card`, `text-label-2`, `text-tint`...), never the hex.

### Surfaces and text

| Token                     | Light → Dark      | Use                                   |
| ------------------------- | ----------------- | ------------------------------------- |
| `bg` / `bg-grouped`       | white → black     | Page background                       |
| `card` (`secondary-1100`) | #f5f5f7 → #1c1c1e | Content cards, table containers       |
| `card-hover` / `card-2`   | lighter / pressed | Hover / nested surface                |
| `inset`                   | white → #2c2c2e   | Tiles and controls inside a card      |
| `popover`                 | white → #242426   | Menus, dialogs, selects               |
| `label`                   | black → white     | Primary text                          |
| `label-2`                 | #6e6e73 → #98989f | Secondary text (≥ 4.5:1)              |
| `label-3` / `label-4`     | decorative        | Placeholders, disabled (not for body) |
| `separator` / `outline`   | hairline          | Dividers, card borders                |
| `fill` … `fill-4`         | translucent gray  | Control backgrounds, hover            |

### Accent (trust blue)

| Token       | Light → Dark      | Contrast                        | Use                        |
| ----------- | ----------------- | ------------------------------- | -------------------------- |
| `tint`      | #0a5bd6 → #4da3ff | 6.0:1 on white · 8.0:1 on black | Links, icons, active text  |
| `tint-fill` | #0a5bd6 → #0b5fe0 | white text 6.0:1 / 5.6:1        | Primary button background  |
| `on-tint`   | white             |                                 | Text on `tint-fill`        |
| `tint-soft` | 10% / 18% tint    |                                 | Selected rows, soft badges |

One primary button per view. Everything else is secondary (`fill-3`) or a text
link.

### Status colors (money states)

Always pair color with a text label or icon.

| Meaning                        | Token    | Soft bg       | Example states              |
| ------------------------------ | -------- | ------------- | --------------------------- |
| Paid / success                 | `green`  | `green-soft`  | `PAID`, `SUCCESS`           |
| In progress / needs attention  | `orange` | `orange-soft` | `PARTIALLY_PAID`, `PENDING` |
| Overdue / failed / destructive | `red`    | `red-soft`    | `OVERDUE`, `FAILED`, delete |
| Neutral / inactive             | `gray`   | `gray-soft`   | `VOID`, ended lease         |
| Informational / selected       | `tint`   | `tint-soft`   | active filter, current step |

## Typography

System font stack: SF Pro on Apple devices; Geist (`next/font`) elsewhere, then
Segoe UI / Roboto. Mono: SF Mono → Geist Mono.

| Class              | Size / line | Weight | Use                       |
| ------------------ | ----------- | ------ | ------------------------- |
| `text-large-title` | 34 / 41     | 700    | Page title (one per page) |
| `text-title-1`     | 28 / 34     | 700    | Section title             |
| `text-title-2`     | 22 / 28     | 700    | Card title                |
| `text-title-3`     | 20 / 25     | 600    | Sub-section               |
| `text-headline`    | 17 / 22     | 600    | Row title, button label   |
| `text-body`        | 17 / 22     | 400    | Default text              |
| `text-callout`     | 16 / 21     | 400    | Secondary body            |
| `text-subheadline` | 15 / 20     | 400    | Table cells, helper text  |
| `text-footnote`    | 13 / 18     | 400    | Captions, metadata        |
| `text-caption`     | 12 / 16     | 400    | Badges, fine print        |

- **Money and any column of numbers use `tabular`** (equal-width digits) and are
  right-aligned in tables. Negative amounts show a minus sign and `red` text;
  never parentheses.
- Don't set `font-size` in arbitrary values; use the scale.
- Max line length for prose: ~70 characters (`container-mid`).

## Shape, spacing, layout

- Radii: `rounded-md` 10 · `rounded-lg` 12 (controls) · `rounded-xl` 16 ·
  `rounded-card` 20 (cards) · `rounded-sheet` 28 (sheets, dialogs).
- Spacing: Tailwind 4px scale; card padding `p-4` mobile, `p-6` desktop;
  vertical rhythm between sections `gap-6`.
- Page width: `container-max` (1128px) for dashboards, `container-mid` (768px)
  for forms and reading.
- Borders are hairlines (`outline`, `hairline-b/t`), not shadows. Floating
  layers (nav bars, sheets) may use `material-bar` / `material-thick`; content
  never does.
- Touch targets ≥ 44×44px on touch devices.

## shadcn/ui mapping

shadcn's semantic classes resolve to our tokens (bridge at the end of the
`@theme` block): `bg-background`, `text-foreground`, `bg-primary` (`tint-fill`),
`text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `bg-accent`,
`bg-destructive`, `border-border`, `ring-ring`, `bg-popover`, `bg-card`.
Primitives live in `shared/ui/`; compose them, don't fork them. If
`shadcn init` rewrites `globals.css`, restore the token and bridge blocks.

## Screen states (required)

| State   | Pattern                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading | Skeleton matching the final layout (`animate-shimmer` on `fill-4`). `role="status"` + `aria-busy`. Never a spinner-only blank page.                     |
| Error   | Plain-language message (what happened, what to do) in a `red-soft` banner with `role="alert"` and a **Try again** button. Never show raw errors or ids. |
| Empty   | Icon, one-line explanation of why it's empty, and a **primary CTA** that fixes it ("Create your first lease"). Filtered-empty offers "Clear filters".   |
| Success | Content. After a mutation, a toast confirms ("Payment of $500.00 recorded") and the data refreshes.                                                     |

## Forms

- Label above input, always visible (placeholder is not a label).
- Helper text under the field in `label-2`; error text replaces it in `red`,
  linked with `aria-describedby`, input marked `aria-invalid`.
- Validate on blur, re-validate on change after the first error. Server errors
  (`ApiError.fields`) map onto fields; a form-level error uses the error banner.
- Submit button: label describes the action ("Record payment"), shows a
  spinner and is disabled while submitting. Destructive or irreversible actions
  (void, refund) require a confirmation dialog stating the amount.
- Money inputs: text input with `inputMode="decimal"`, parse with `toCents`,
  show the formatted value on blur, reject more than 2 decimals with a clear
  message. Never `type="number"` (it drops precision and trims zeros).
- Date inputs for due dates are date-only; show the property's timezone where it
  affects meaning.

## Money and dates in the UI

- Display money with `formatMoney()` only. Never compute display amounts inline.
- Show status as a badge (soft background + `label`-colored text + icon), e.g.
  `Overdue · 3 days`, derived with the date helpers in the property's timezone.
- Show absolute dates unambiguously (`May 1, 2026`), relative text only as a
  supplement.

## Motion

Short and functional: `animate-pop-in` for popovers/dialogs, `animate-sheet-up`
for sheets, `animate-fade-in` for toasts, `animate-rise` for first paint of lists.
All animation is disabled under `prefers-reduced-motion`.

## Accessibility checklist

- Text contrast ≥ 4.5:1 (large text ≥ 3:1). Tokens above are measured.
- Visible `:focus-visible` ring (`tint`, 2px) on every interactive element.
- Full keyboard path for every flow; dialogs trap focus and restore it.
- Status is never color-only (text or icon accompanies it).
- Tables use real `<table>`, `<th scope>`, and a caption or `aria-label`.
- Respect `prefers-contrast: more` and `prefers-reduced-transparency`.
