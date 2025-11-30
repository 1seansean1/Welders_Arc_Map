# WA_map Style Guide

> **Version**: 1.0.0
> **Last Updated**: 2025-11-29
> **Live Preview**: `/static/style-guide.html`

---

## Quick Reference

### Design Tokens File
All design values are defined in:
```
/static/styles/design-tokens.css
```

Import in HTML:
```html
<link rel="stylesheet" href="/static/styles/design-tokens.css">
```

---

## Color System

### Dark Theme (Default)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#0a0a0a` | Main app background |
| `--bg-secondary` | `#1a1a1a` | Panels, modals, cards |
| `--bg-tertiary` | `#2a2a2a` | Hover states, inputs |
| `--text-primary` | `#f5f5f5` | Main content text |
| `--text-secondary` | `#a3a3a3` | Labels, descriptions |
| `--text-muted` | `#666666` | Disabled, hints |
| `--border-color` | `#333333` | Standard borders |

### Accent Colors

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--accent-blue-grey` | `#9dd4ff` | `#0066cc` | Focus, selection, primary actions |
| `--accent-orange` | `#ffa500` | `#e68a00` | Analysis features (Lambert) |
| `--accent-green` | `#00ff66` | `#00994d` | Success, real-time mode |
| `--accent-yellow` | `#ffeb3b` | `#cc9900` | Warnings, simulation mode |
| `--accent-red` | `#ff4444` | `#cc3333` | Errors, destructive actions |
| `--accent-cyan` | `#00c8ff` | `#0088aa` | Special highlights |

### Semantic Aliases

Use these for clarity in code:
```css
var(--color-success)  /* alias for accent-green */
var(--color-warning)  /* alias for accent-yellow */
var(--color-error)    /* alias for accent-red */
var(--color-info)     /* alias for accent-cyan */
var(--color-focus)    /* alias for accent-blue-grey */
```

---

## Typography

### Font Stacks

```css
--font-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Consolas', monospace;
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**When to use each:**
- **Monospace**: Input fields, TLE data, coordinates, log output, timestamps
- **Sans-serif**: Labels, buttons, UI text, descriptions

### Font Sizes

| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | 7px | Tiny labels |
| `--text-sm` | 8px | Button text (compact), small labels |
| `--text-base` | 9px | Default body text |
| `--text-md` | 10px | Inputs, select options |
| `--text-lg` | 11px | Nav labels, form labels |
| `--text-xl` | 12px | Section headers |
| `--text-2xl` | 13px | Modal titles |

### Font Weights

| Token | Weight | Usage |
|-------|--------|-------|
| `--font-normal` | 400 | Body text |
| `--font-medium` | 500 | Nav labels |
| `--font-semibold` | 600 | Headers, buttons, labels |
| `--font-bold` | 700 | Strong emphasis |

---

## Spacing

### Scale (4px base)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 2px | Tight gaps |
| `--space-2` | 4px | Standard gap |
| `--space-3` | 6px | Medium gap |
| `--space-4` | 8px | Section gaps |
| `--space-5` | 12px | Large gaps |
| `--space-6` | 16px | Modal padding |
| `--space-7` | 24px | Large sections |

### Named Spacing

```css
--gap-tight: 2px    /* Between tightly packed elements */
--gap-small: 4px    /* Standard button groups */
--gap-medium: 8px   /* Form groups */
--gap-large: 16px   /* Section separation */
--padding-compact: 4px   /* Compact controls */
--padding-normal: 8px    /* Standard padding */
--padding-modal: 16px    /* Modal content */
```

---

## Button System

### Height Tiers

| Token | Height | Usage |
|-------|--------|-------|
| `--btn-height-xs` | 18px | Tiny controls |
| `--btn-height-sm` | 20px | Compact buttons (nav, time bar) |
| `--btn-height-md` | 22px | Standard navigation |
| `--btn-height-lg` | 24px | Standard actions |
| `--btn-height-xl` | 28px | Primary modal actions |
| `--btn-height-touch` | 44px | Mobile touch targets |

### Button Variants

#### Primary Button (filled)
```css
.btn-primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-color);
  border: 1px solid var(--btn-primary-border);
}
```
**Use for**: Save, Apply, Compute, primary actions

#### Secondary Button (ghost)
```css
.btn-secondary {
  background: var(--btn-secondary-bg);
  color: var(--btn-secondary-color);
  border: 1px solid var(--btn-secondary-border);
}
```
**Use for**: Cancel, navigation, non-primary actions

#### Danger Button
```css
.btn-danger {
  background: var(--btn-danger-bg);
  color: var(--btn-danger-color);
  border: 1px solid var(--btn-danger-border);
}
```
**Use for**: Delete, destructive actions

#### Special Button (orange)
```css
.btn-special {
  background: var(--btn-special-bg);
  color: var(--btn-special-color);
  border: 1px solid var(--btn-special-border);
}
```
**Use for**: Analysis features (Lambert solver)

### Button States

#### Hover
```css
/* Standard hover */
.btn:hover {
  background: var(--bg-primary);
  border-color: var(--accent-blue-grey);
}

/* Primary hover */
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-accent);
}
```

#### Active/Press
```css
.btn:active {
  transform: scale(0.95);
}
```

#### Disabled
```css
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Input Fields

### Standard Input
```css
.input {
  height: var(--input-height-md);
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-md);
  color: var(--input-color);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: 0 var(--space-2);
}

.input:focus {
  outline: none;
  border-color: var(--input-focus-border);
}

.input.pending {
  border-color: var(--input-pending-border);
}
```

### Select/Dropdown
```css
.select {
  height: var(--input-height-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
}
```

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 2px | Subtle rounding |
| `--radius-md` | 3px | Standard (buttons, inputs) |
| `--radius-lg` | 4px | Cards, panels |
| `--radius-xl` | 6px | Modals, large cards |
| `--radius-full` | 50% | Circles, avatars |

---

## Shadows

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Subtle elevation |
| `--shadow-md` | Modal, dropdown |
| `--shadow-lg` | Large overlays |
| `--shadow-accent` | Primary button hover glow |
| `--shadow-text-dark` | Text on map (readability) |

---

## Transitions

| Token | Duration | Usage |
|-------|----------|-------|
| `--transition-none` | none | Instant feedback (most buttons) |
| `--transition-fast` | 0.1s | Quick interactions |
| `--transition-normal` | 0.2s | Standard transitions |
| `--transition-slow` | 0.3s | Theme changes |
| `--transition-panel` | 0.27s | Panel expand/collapse |

**Philosophy**: Most interactive elements use `transition: none` for instant feedback. Reserve animations for larger state changes (panel open/close, theme switch).

---

## Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | 1 | Base content |
| `--z-dropdown` | 100 | Dropdown menus |
| `--z-sticky` | 500 | Sticky headers |
| `--z-fixed` | 1000 | Fixed elements (panels, time bar) |
| `--z-modal-backdrop` | 1500 | Modal overlay |
| `--z-modal` | 2000 | Modal content |
| `--z-popover` | 2500 | Popovers, tooltips |
| `--z-tooltip` | 3000 | Top-most tooltips |

---

## Component Patterns

### Modal Structure
```html
<div class="modal-overlay">
  <div class="modal">
    <div class="modal-title">Title</div>
    <div class="modal-content">...</div>
    <div class="modal-buttons">
      <button class="btn-secondary">Cancel</button>
      <button class="btn-primary">Save</button>
    </div>
  </div>
</div>
```

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-modal-backdrop);
  z-index: var(--z-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: var(--modal-bg);
  border: 1px solid var(--modal-border);
  border-radius: var(--radius-lg);
  padding: var(--padding-modal);
  box-shadow: var(--shadow-md);
}
```

### Form Group
```html
<div class="form-group">
  <label class="form-label">Label</label>
  <input class="input" type="text">
</div>
```

```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
```

### Button Group
```css
.button-group {
  display: flex;
  gap: var(--gap-small);
}
```

---

## Responsive Breakpoints

| Breakpoint | Target |
|------------|--------|
| `768px` | Tablet - panel overlays map |
| `700px` | Hide time bar window indicator |
| `500px` | Hide time bar rate group |
| `350px` | Hide time bar animation controls |

### Mobile Considerations
- Minimum touch target: `44x44px` (iOS guideline)
- Panel overlays map on mobile (doesn't shift)
- Use `transform: translateZ(0)` for GPU acceleration

---

## Anti-Patterns (Do NOT Do)

### Hardcoded Colors
```css
/* BAD */
.button { background: #aa3333; }

/* GOOD */
.button { background: var(--accent-red); }
```

### Inconsistent Button Heights
```css
/* BAD */
.btn-a { height: 21px; }
.btn-b { height: 23px; }

/* GOOD - use defined tiers */
.btn-a { height: var(--btn-height-sm); }
.btn-b { height: var(--btn-height-md); }
```

### Mixed Transitions
```css
/* BAD - mixing transition styles */
.btn-a { transition: all 0.15s ease; }
.btn-b { transition: background 0.2s; }

/* GOOD - use tokens or none */
.btn { transition: var(--transition-none); }
```

### Arbitrary Spacing
```css
/* BAD */
.element { padding: 7px 11px; }

/* GOOD - use scale */
.element { padding: var(--space-4) var(--space-5); }
```

---

## Checklist for New Components

1. [ ] Uses only CSS variables from design-tokens.css
2. [ ] No hardcoded colors (hex values)
3. [ ] Button heights match defined tiers
4. [ ] Font sizes match scale
5. [ ] Spacing uses scale values
6. [ ] Border radius from tokens
7. [ ] Transitions use tokens or `none`
8. [ ] Hover/active states follow patterns
9. [ ] Works in both dark and light themes
10. [ ] Mobile touch targets meet 44px minimum

---

## Migration Guide

When refactoring existing CSS:

1. **Replace hardcoded colors**:
   - `#0a0a0a` → `var(--bg-primary)`
   - `#9dd4ff` → `var(--accent-blue-grey)`
   - `#ff9800` → `var(--accent-orange)`
   - `#aa3333` → `var(--accent-red)`

2. **Replace pixel heights**:
   - `20px` → `var(--btn-height-sm)`
   - `22px` → `var(--btn-height-md)`
   - `28px` → `var(--btn-height-xl)`

3. **Replace font sizes**:
   - `8px` → `var(--text-sm)`
   - `9px` → `var(--text-base)`
   - `10px` → `var(--text-md)`

4. **Replace spacing**:
   - `4px` → `var(--space-2)`
   - `8px` → `var(--space-4)`
   - `16px` → `var(--space-6)`
