# Design System: theora

Adapted from [DESIGN-REFERENCE-SUPABASE.md](DESIGN-REFERENCE-SUPABASE.md) (card layout, section structure, copy style, dark-first aesthetic) and [DESIGN-REFERENCE-LINEAR.md](DESIGN-REFERENCE-LINEAR.md) (spacing precision, thin borders, frosted glass effects).

## 1. Color Palette

All colors use CSS custom properties defined in `src/index.css`. Dark theme is primary.

### Surfaces (Dark)

| Token | Value | Use |
|---|---|---|
| `--bg-primary` | `#09090b` | Page background, deepest surface |
| `--bg-secondary` | `#111113` | Panels, ticker, slightly elevated |
| `--bg-tertiary` | `#19191d` | Dropdown backgrounds, elevated cards |
| `--surface-element` | `rgba(12, 12, 14, 0.9)` | Card surfaces, translucent dark |
| `--toolbar-bg` | `rgba(9, 9, 11, 0.75)` | Frosted nav bar when scrolled |
| `--bg-hover` | `rgba(255, 255, 255, 0.06)` | Hover state backgrounds |

### Surfaces (Light)

| Token | Value | Use |
|---|---|---|
| `--bg-primary` | `#ffffff` | Page background |
| `--bg-secondary` | `#fafafa` | Panels, ticker |
| `--bg-tertiary` | `#f4f4f5` | Elevated surfaces |
| `--surface-element` | `rgba(255, 255, 255, 0.9)` | Card surfaces |

### Text

| Token | Dark | Light | Use |
|---|---|---|---|
| `--text-primary` | `#fafafa` | `#09090b` | Headlines, primary content |
| `--text-secondary` | `#a1a1aa` | `#52525b` | Body text, descriptions |
| `--text-muted` | `#52525b` | `#a1a1aa` | Overlines, captions, metadata |

### Borders

| Token | Dark | Light | Use |
|---|---|---|---|
| `--border` | `rgba(255, 255, 255, 0.06)` | `rgba(0, 0, 0, 0.06)` | Default card/section borders |
| `--button-border` | `rgba(255, 255, 255, 0.1)` | `rgba(0, 0, 0, 0.1)` | Button borders, prominent edges |
| `--focus-ring` | `rgba(255, 255, 255, 0.2)` | `rgba(0, 0, 0, 0.12)` | Hover border highlight, focus state |
| `--surface-element-border` | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.08)` | Card border alternative |

### Buttons

| Token | Dark | Light | Use |
|---|---|---|---|
| `--button-bg` | `rgba(255, 255, 255, 0.05)` | `rgba(0, 0, 0, 0.03)` | Ghost button, icon button fill |
| `--button-bg-strong` | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.06)` | Hover state for ghost buttons |

### Grid Overlay

| Token | Dark | Light |
|---|---|---|
| `--grid-line` | `rgba(255, 255, 255, 0.025)` | `rgba(0, 0, 0, 0.03)` |
| `--grid-line-strong` | `rgba(255, 255, 255, 0.04)` | `rgba(0, 0, 0, 0.06)` |

### Status Colors

| Token | Use |
|---|---|
| `--color-success` / `--color-success-bg` / `--color-success-border` | Green success states |
| `--color-error` / `--color-error-bg` / `--color-error-border` | Red error states |
| `--color-warning` / `--color-warning-bg` / `--color-warning-border` | Amber warnings |
| `--color-info` / `--color-info-bg` / `--color-info-border` | Blue informational |

### Demo Accent Colors

Each demo has a named accent. Most use zinc-scale grays; some use semantic colors:

| Demo | Accent |
|---|---|
| `merkle` | `var(--merkle)` → `#fafafa` dark / `#09090b` light |
| `accumulator` | `var(--accumulator)` → `#a1a1aa` |
| `polynomial` | `var(--polynomial)` → `#d4d4d8` |
| `recursive` | `var(--recursive)` → `#71717a` |
| `circuit` | `#84cc16` (lime) |
| `lookup` | `#38bdf8` (sky) |
| `elliptic` | `#2dd4bf` (teal) |
| `fiat-shamir` | `#f97316` (orange) |

## 2. Typography

### Font Families

| Token | Stack | Use |
|---|---|---|
| `--font-display` / `--font-sans` | `"Space Grotesk", "Inter", system-ui, -apple-system, sans-serif` | Headlines, section titles, buttons |
| `--font-mono` | `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | Overlines, technical labels, demo card titles, body prose, code |

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|---|---|---|---|---|---|---|
| Hero Display | `--font-sans` | `clamp(2.2rem, 8vw, 6.5rem)` | 800 | 0.92 | -0.05em | Tight, dense headline |
| Section Title | `--font-sans` | `clamp(30px, 4vw, 48px)` | 700 | 1.02 | -0.04em | `max-width: 14ch` for short lines |
| Callout Title | `--font-sans` | `clamp(20px, 3vw, 28px)` | 700 | 1.15 | -0.03em | Featured callout cards |
| Group Title | `--font-sans` | `16px` | 600 | 1.55 | -0.04em | Demo group subtitle |
| Card Title | `--font-mono` | `14px` | 500 | 1.45 | normal | Demo card headings |
| Audience Title | `--font-mono` | `14px` | 500 | 1.5 | normal | Persona card headings |
| Overline | `--font-mono` | `11px` | 400 | 1.6 | 0.12em | Uppercase section labels |
| Mono Label | `--font-mono` | `10.5px` | 400 | 1.4 | 0.14em | Uppercase hero label |
| Body | `--font-mono` | `15px` | 400 | 1.7 | normal | Hero description |
| Body Small | `--font-mono` | `14px` | 400 | 1.7 | normal | Card descriptions |
| Caption | `--font-mono` | `13px` | 400 | 1.65 | normal | Card body, embed caption |
| Nav Link | `--font-mono` | `11px` | 400 | 1.0 | 0.08em | Uppercase nav items |
| Button | `--font-sans` | `12px` | 600 | 1.0 | 0.01em | CTA labels |
| Ticker | `--font-mono` | `10px` | 400 | 1.0 | 0.16em | Uppercase marquee items |
| Footer Small | `--font-mono` | `10px` | 400 | 1.0 | 0.08em | Legal, copyright |

## 3. Spacing Scale

Strict 8px-grid scale, adapted from Linear. No arbitrary values.

| Token | Value | Use |
|---|---|---|
| `--space-xs` | `4px` | Micro gaps, icon margins |
| `--space-sm` | `8px` | Card content gap, tight spacing |
| `--space-md` | `12px` | Ticker padding, small margins |
| `--space-lg` | `16px` | Card padding, grid gaps, standard margins |
| `--space-xl` | `20px` | Reserved (legacy), prefer 16 or 24 |
| `--space-2xl` | `24px` | Shell side padding, section head gaps, callout CTA margin |
| `--space-3xl` | `32px` | Section head margin, hero CTA margin, callout inner padding |
| `--space-4xl` | `48px` | Demo group gaps, mobile section padding, hero-split gap |
| `--space-5xl` | `64px` | Desktop section padding, hero split gap |

### Section Rhythm

| Context | Desktop | Mobile (≤767px) |
|---|---|---|
| Between major sections | `64px` top+bottom padding | `48px` |
| Within demo groups | `48px` gap between groups | `32px` |
| Within demo grid | `16px` gap | `16px` |
| Between cards (audience/mode) | `16px` gap | `16px` |

## 4. Border Radius Scale

Adapted from Supabase (cards 8px, pills 9999px) and Linear (buttons 6-8px).

| Size | Value | Use |
|---|---|---|
| Subtle | `6px` | Dropdown items, small interactive elements |
| Standard | `8px` | Cards, buttons, code blocks, embed browser |
| Medium | `12px` | Nav dropdown panel, hero teaser frame, larger callout cards |
| Pill | `9999px` | Not used on landing page; reserved for in-app badges |

## 5. Component Patterns

### Cards (Supabase-adapted)

All cards share a common base:

```css
border: 1px solid var(--border);
border-radius: 8px;
background: var(--surface-element);
transition: border-color 160ms ease;
```

Hover state — border highlight only, no shadows:

```css
:hover {
  border-color: var(--focus-ring);
}
```

Card variants:
- **Demo card**: Optional preview iframe (16:9) + content area (16px padding, 8px gap)
- **Mode card**: 24px padding, tag + title + description
- **Audience card**: Same as mode card, used for persona sections
- **Callout card**: 32px padding, title + body + CTA button

### Carousel (Protocol Primitives)

Full-width horizontally scrollable section that bleeds past the shell container. Inspired by Linear's "Workflows and integrations" section.

```css
/* Track */
scroll-snap-type: x proximity;
-webkit-overflow-scrolling: touch;
scrollbar-width: none; /* hide scrollbar */
gap: 16px;
padding: 0 32px; /* matches shell padding per breakpoint */

/* Card */
width: 320px; min-width: 320px; height: 440px;
border-radius: 12px;
overflow: hidden;
border: 1px solid var(--border);
background: var(--bg-secondary);
scroll-snap-align: start;

/* Card hover */
border-color: var(--focus-ring);
transform: translateY(-2px);

/* Iframe viewport inside card */
position: absolute; width: 200%; height: 200%;
transform: scale(0.5); transform-origin: top left;
pointer-events: none;

/* Info overlay at card bottom */
position: absolute; bottom: 0; left: 0; right: 0;
padding: 20px 24px;
background: linear-gradient(to top, var(--bg-secondary) 60%, transparent);
```

Edge fades mask the scroll overflow. Arrow buttons (36×36px, `border-radius: 50%`, `border: 1px solid var(--button-border)`) sit below the track.

Iframes lazy-mount via `IntersectionObserver` (200px rootMargin). Skeleton shimmer shows before mount.

### Split Panel (Commitment Schemes)

Two-column layout: left list (40%) + right live iframe preview (60%).

```css
/* Layout */
grid-template-columns: 2fr 3fr;
gap: 16px;
min-height: 480px;

/* List item */
padding: 16px 20px;
border-bottom: 1px solid var(--border);
border-left: 3px solid transparent;

/* Active list item */
border-left-color: var(--text-primary);
background: var(--button-bg);

/* Preview panel */
border-radius: 12px;
border: 1px solid var(--surface-element-border);
min-height: 480px;
```

Iframe switches on list item click. Mobile: stacks vertically, list on top.

### Buttons

**Primary (solid)**:

```css
min-height: 40px;
padding: 0 16px;
border-radius: 8px;
border: 1px solid var(--text-primary);
background: var(--text-primary);
color: var(--bg-primary);
font-size: 12px;
font-weight: 600;
```

Hover: `opacity: 0.94`

**Ghost (outline)**:

```css
min-height: 40px;
padding: 0 16px;
border-radius: 8px;
border: 1px solid var(--button-border);
background: transparent;
color: var(--text-secondary);
```

Hover: `border-color: var(--focus-ring); background: var(--button-bg); color: var(--text-primary);`

**Large variant**: `height: 44px; padding: 0 18px;`

**Icon button**: `34×34px`, `border-radius: 8px`, `border: 1px solid var(--button-border)`, `background: var(--button-bg)`

### Navigation

Sticky header with frosted glass effect on scroll:

```css
/* Scrolled state */
border-bottom: 1px solid var(--border);
background: color-mix(in srgb, var(--bg-primary) 92%, transparent);
backdrop-filter: blur(18px);
```

Nav links: `--font-mono`, 11px, uppercase, `letter-spacing: 0.08em`, `color: var(--text-muted)`.

Demos dropdown: 2-column grid panel, `border-radius: 12px`, `backdrop-filter: blur(20px)`.

### Hero

Full viewport height. Two layers:
1. **Background**: `HeroAnimation` canvas (rotating 3D node graph) at 60% opacity
2. **Foreground**: Split layout — left copy + CTAs, right live iframe teaser

Grid overlay: 72px grid squares using `--grid-line-strong`.

Vignette: Radial gradient from `--bg-primary` at bottom to transparent at top, masks the canvas edge.

Ticker: Pinned to bottom of hero, monospace uppercase marquee.

### Footer

Single `border-top`, three-part flex layout: brand + tagline | nav links | legal line.

Desktop: horizontal. Mobile: stacked center-aligned.

## 6. Depth & Elevation

No box-shadows on cards or surfaces. Depth comes from:

1. **Border hierarchy**: `--border` (default) → `--button-border` (prominent) → `--focus-ring` (hover/active)
2. **Surface stepping**: `--bg-primary` (deepest) → `--bg-secondary` → `--surface-element` → `--bg-tertiary` (elevated)
3. **Frosted glass**: `backdrop-filter: blur()` + translucent `color-mix()` backgrounds for nav and dropdown

Only shadow in the system: `0 12px 40px -8px rgba(0,0,0,0.2)` on the nav dropdown panel (functional, not decorative).

## 7. Responsive Breakpoints

| Name | Max-width | Key Changes |
|---|---|---|
| Tablet | `1023px` | Demo grid 2-col, audience grid 2-col, embed grid 1-col, shell padding 20px |
| Mobile | `767px` | Everything 1-col, hero teaser hidden, nav dropdown hidden, section padding 48px, hero CTAs full-width |

### Mobile Adaptations

- Hero: `min-height: auto`, teaser iframe hidden, title scales down via `clamp()`
- Demo cards: Preview iframes hidden, content-only cards
- Nav: Dropdown hidden, button sizes shrink
- Ticker: Smaller font (9px), tighter padding (8px)
- Footer: Stacked center-aligned

## 8. Landing Page Section Order

1. **Nav** — Sticky frosted header
2. **Hero** — Full-viewport with HeroAnimation canvas + live demo teaser
3. **Demo Gallery** — Categorized card grid (from `demoGroups.ts`)
4. **How You Interact** — Three mode cards: Explore, Predict, Attack
5. **Research Callout** — Single wide callout card for paper upload workspace
6. **Who Is This For** — Four audience persona cards
7. **Embed** — Code snippet + browser mockup
8. **Footer** — Brand, links, legal

## 9. Copy Style

Headlines are short and specific (Supabase pattern):
- "Cryptography, made visible." (hero)
- "Explore interactive primitives." (demo gallery)
- "Three ways to learn the same primitive." (modes)
- "Upload a paper, get interactive diagrams." (research)
- "People who already know the math and want to see it move." (audience)
- "Every state is a URL." (embed)

Section overlines use uppercase monospace: `DEMO GALLERY`, `HOW YOU INTERACT`, `RESEARCH WORKSPACE`, etc.
