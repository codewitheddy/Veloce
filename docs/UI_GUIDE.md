# Ropenix UI & Design System Guide

> **Version:** 2.0.0  
> **Status:** Active Standard  
> **Scope:** Entire Ropenix Storefront, Checkout, Account, and Admin Management Dashboards.

This document establishes the single source of truth for all visual tokens, typographic components, color semantics, spacing scales, and interactive behaviors across Ropenix. **Every page and component must strictly comply with this guide.**

---

## 1. Design Token Hierarchy

### 1.1 Typography System

All text must use one of the 3 defined font families. No custom `@font-face` or inline `font-family` styles are permitted outside of printable thermal invoices.

| Purpose | Font Family | CSS Variable | Tailwind Utility |
| :--- | :--- | :--- | :--- |
| **Display / Headings** | `Space Grotesk`, `Poppins`, sans-serif | `var(--font-display)` | `font-display` |
| **Body / UI Copy** | `Inter`, `Poppins`, system-ui, sans-serif | `var(--font-sans)` | `font-sans` |
| **Numeric / SKU / Price** | `Inter`, `Poppins`, system-ui, sans-serif | `var(--font-mono)` | `font-mono` |

#### Font Implementation & Performance Rules
1. **Load only required weights (400, 500, 600, 700):** Avoid loading unused thin (100, 200, 300) or ultra-black (800, 900) weights to keep page load times fast and payload under 45kB.
2. **`font-display: swap`:** Always append `&display=swap` to font queries so browser renders fallback text immediately without blank flash (FOIT).
3. **Robust Fallback Stack:** Always provide system font fallbacks: `font-family: "Inter", "Poppins", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;`.
4. **Form Element Inheritance:** Always set `button, input, optgroup, select, textarea { font-family: inherit; }` in `@layer base` to prevent browser form controls reverting to default serif or system fonts.
5. **Clean Zeroes (No Dots/Slashes):** Use `font-variant-numeric: normal` with standard Inter/Poppins digits so prices (e.g. `KES 83,018`) render solid, clean zeroes without internal dots or slashes.

#### Font Scale (Major Third - 1.25 Ratio)
Never use arbitrary pixel sizes (e.g. `13.5px`, `11px`, `15px`, `22px`). Use the defined scale:

| Token | REM / Size | Computed PX | Target Usage |
| :--- | :--- | :--- | :--- |
| `text-[10px]` | `0.625rem` | `10px` | Micro badges, SKU codes, monospace kickers, timestamps |
| `text-xs` | `0.8rem` | `12.8px` | Secondary metadata, helper text, input values, table headers |
| `text-sm` | `0.875rem` | `14px` | Standard body copy, buttons, form labels, card descriptions |
| `text-base` | `1.0rem` | `16px` | Featured lead copy, H5 headings, modal body text |
| `text-lg` | `1.25rem` | `20px` | H4 headings, section subtitles, prominent price figures |
| `text-xl` | `1.5625rem` | `25px` | H3 headings, modal titles, card highlight headers |
| `text-2xl` | `1.953rem` | `31.25px` | H2 section headings, drawer titles |
| `text-3xl` | `2.441rem` | `39px` | H1 page titles (tablet/desktop) |
| `text-4xl` | `3.052rem` | `48.8px` | Hero display banners and storefront headlines |
| `text-5xl` | `3.815rem` | `61px` | Brand hero impact numbers |

#### Shared Typography Components (`src/components/ui/Typography.tsx`)
Always import and use the standardized typography primitives:
- `<H1>` to `<H6>`: Space Grotesk with automatic responsive clamp, optical tracking, and dark-mode adaptation.
- `<Paragraph size="sm" | "base" | "lg" muted={true | false}>`: Standard reading container with `max-w-prose` line length limit.
- `<SectionEyebrow>`: JetBrains Mono uppercase tracking kicker for section intros.
- `<FormLabel required={boolean}>`: Accessible uppercase form input title with required asterisk.
- `<MonoCaption>`: Subtle uppercase mono tag for SKUs, dates, or technical metadata.
- `<PriceDisplay priceFormatted="..." originalPriceFormatted="..." isOnSale={boolean}>`: Unified price formatting with discount strike-through.

---

### 1.2 Color Semantics

Colors must be referenced by their semantic intention, never as arbitrary hex codes inside components.

```
┌─────────────────────────────────────────────────────────────┐
│                      SEMANTIC PALETTE                       │
├───────────────────┬───────────────────┬─────────────────────┤
│ Meaning           │ Light Mode        │ Dark Mode           │
├───────────────────┼───────────────────┼─────────────────────┤
│ Brand Primary     │ #4F46E5 (Indigo)  │ #6366F1 / #818CF8   │
│ Primary Hover     │ #4338CA           │ #4F46E5             │
│ Commercial Accent │ #F59E0B (Amber)   │ #FBBF24             │
│ Neutral Surface   │ #FFFFFF / #F8FAFC │ #0F172A / #020617   │
│ Neutral Border    │ #E2E8F0 / #CBD5E1 │ #1E293B / #334155   │
│ Text Primary      │ #0F172A           │ #FFFFFF             │
│ Text Secondary    │ #475569           │ #94A3B8             │
│ Success / Paid    │ #10B981 (Emerald) │ #34D399             │
│ Error / Danger    │ #EF4444 (Red)     │ #F87171             │
│ Warning / Pending │ #F97316 (Orange)  │ #FB923C             │
│ WhatsApp Contact  │ #25D366           │ #20BD5A             │
└───────────────────┴───────────────────┴─────────────────────┘
```

#### Contrast Rule (WCAG AA)
- All normal text against backgrounds must maintain at least **4.5:1** contrast ratio.
- Large text (18pt / 24px or bold 14pt / 18.6px) must maintain at least **3.0:1** contrast ratio.
- Interactive outlines (focus rings) use `ring-2 ring-indigo-500/20` or `outline-2 outline-indigo-500`.

---

### 1.3 Spacing, Radii, and Elevation Scales

#### Border Radius Standards
Each component type has **one** fixed border radius:
- **Buttons, Inputs, Textareas, Selects**: `rounded-xl` (`0.75rem` / `12px`). Micro buttons: `rounded-lg` (`0.5rem` / `8px`).
- **Cards, Panels, Dropdown Menus**: `rounded-2xl` (`1.0rem` / `16px`).
- **Modals & Hero Presentation Containers**: `rounded-3xl` (`1.5rem` / `24px`).
- **Badges, Status Pills, Avatars, Checkboxes/Radios**: `rounded-full` (`9999px`) / `rounded-md` (`4px` for checkboxes).

#### Spacing System (4px Base Grid)
- Micro padding/gaps: `gap-1` (4px), `gap-1.5` (6px), `gap-2` (8px).
- Component inner padding: `p-3` (12px), `p-4` (16px), `p-5` (20px), `p-6` (24px).
- Section separation: `py-8` (32px), `py-12` (48px), `py-16` (64px), `py-20` (80px).
- Standard Container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.

#### Shadows & Elevation
- Subtle / Card Idle: `shadow-3xs` or `shadow-xs` (`0 1px 2px 0 rgb(0 0 0 / 0.05)`).
- Hover / Floating Card: `shadow-md` or `shadow-lg` (`0 10px 15px -3px rgb(0 0 0 / 0.1)`).
- Dialogs / Modals / Toast Viewports: `shadow-xl` or `shadow-2xl`.

---

## 2. Component Behavior Standards

### 2.1 Buttons (`src/components/ui/Button.tsx`)
- **Height & Padding**:
  - `xs`: `h-7`, `px-2 py-1`, `text-[10px]`
  - `sm`: `h-8.5`, `px-3 py-1.5`, `text-xs`
  - `md`: `h-10`, `px-4 py-2`, `text-xs font-semibold`
  - `lg`: `h-11`, `px-5 py-2.5`, `text-sm font-semibold`
- **Variants**:
  - `primary`: Solid Indigo `#4F46E5`, white text, subtle hover lift.
  - `secondary`: Soft Slate surface, dark slate text.
  - `outline`: Bordered Indigo with subtle hover fill.
  - `ghost`: Transparent with subtle neutral background hover.
  - `danger`: Solid Rose/Red `#E11D48` for destructive confirmation.
  - `brand`: Gradient accent for high-priority marketing CTA.
- **States**:
  - Hover: Background tint shift.
  - Active: Micro-compression (`active:scale-[0.98]`).
  - Loading: Replaces left icon with spinning dual-ring indicator, disables pointer events.
  - Disabled: `opacity-50 cursor-not-allowed`.

### 2.2 Form Fields (`Input.tsx`, `Textarea.tsx`)
- Universal explicit typography inheritance: `button, input, select, textarea { font-family: inherit; }`.
- Height: Standard text inputs `h-10` or `p-3` with `text-xs` size.
- Focus Style: `focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`.
- Error State: `border-rose-300 dark:border-rose-900/60 text-rose-600 focus:ring-rose-500/20`.
- Label Placement: Always top-aligned, uppercase tracking `font-sans text-[10px] font-bold text-slate-500`.

### 2.3 Badges & Status Indicators (`Badge.tsx`)
- Shape: Always `rounded-full` with `font-mono text-[10px] font-bold uppercase tracking-wider`.
- Variants: `default` (Indigo), `secondary` (Slate), `success` (Emerald), `warning` (Amber), `danger` (Rose), `info` (Sky).

### 2.4 Modals & Overlays (`Modal.tsx`)
- Backdrop: `bg-slate-950/40 backdrop-blur-xs` with fade transition.
- Window: `rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl`.
- Escape Key & Outside Click: Always enabled by default, locking `document.body.style.overflow = 'hidden'`.

### 2.5 Icons & Media
- **Icon Set**: Exclusively `lucide-react`. Never mix icon libraries.
- **Icon Sizes**:
  - Inline Micro / Badges: `h-3 w-3` or `h-3.5 w-3.5`
  - Standard UI / Button: `h-4 w-4`
  - Nav / Header / Tabs: `h-5 w-5`
  - Hero / Feature Callouts: `h-6 w-6` to `h-8 w-8`
- **Product Images**: Fixed aspect ratios (`aspect-square` 1:1 or `aspect-[4/5]` fashion portrait), object-cover, background placeholder skeleton (`bg-slate-100 dark:bg-slate-800 animate-pulse`).

---

## 3. Standardization Decisions (Consolidations)

When auditing legacy variations, the following standards were established:

1. **Heading Fonts:** Legacy views that used default browser headings or arbitrary font declarations are standardized to `Space Grotesk` (`var(--font-display)`) via `<H1>` - `<H6>` components.
2. **Form Control Typography:** Browser default fonts (e.g. Courier or Tahoma on Windows) inside inputs and textareas are eliminated with `@layer base { button, input, optgroup, select, textarea { font-family: inherit; } }`.
3. **Sub-12px Font Sizes:** Arbitrary font sizes like `11px`, `13px`, and `13.5px` are consolidated into either `text-xs` (`12.8px`), `text-sm` (`14px`), or the `text-[10px]` monospace micro token.
4. **Card Radius:** Legacy mixed radii (`rounded-lg`, `rounded-xl`, `rounded-3xl`) on cards and widgets are unified to `rounded-2xl` (`1rem`).
5. **Color Palette Mapping:** Hardcoded `#111827`, `#1f2937`, `#374151` are unified to the official Tailwind Slate palette (`--color-slate-900`, `--color-slate-800`, `--color-slate-700`).

---

## 4. Consistency Checklist (Mandatory for Every New View/Component)

Before submitting any new component, page, or modal, verify each item:

- [ ] **Typography**: Does every heading use `<H1>`–`<H6>` or `font-display`? Does body text use `font-sans`? Do SKU/dates use `font-mono`?
- [ ] **Font Scale**: Are all font sizes using predefined Tailwind tokens (`text-[10px]`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`) with zero arbitrary sizes?
- [ ] **Form Fields**: Do all form controls inherit font families and use standard `rounded-xl` corners with `focus:ring-2 focus:ring-indigo-500/20`?
- [ ] **Colors**: Are all colors mapped to semantic tokens (`indigo` primary, `slate` neutrals, `amber` accent, `emerald` success, `red/rose` error)? No hardcoded hex strings.
- [ ] **Contrast**: Does body text meet WCAG AA (4.5:1) in both light and dark modes?
- [ ] **Radii**: Are buttons/inputs `rounded-xl`, cards `rounded-2xl`, modals `rounded-3xl`, and badges `rounded-full`?
- [ ] **Icons**: Are all icons imported exclusively from `lucide-react` using the 3.5, 4, 5, or 6 size scale?
- [ ] **Mobile Responsiveness**: Does the component render without causing horizontal scrolling (`max-w-full`, responsive padding, no fixed pixel widths > 320px)?
