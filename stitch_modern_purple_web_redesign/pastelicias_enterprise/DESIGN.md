---
name: Pastelicias Enterprise
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464554'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#4b41e1'
  on-secondary: '#ffffff'
  secondary-container: '#645efb'
  on-secondary-container: '#fffbff'
  tertiary: '#5b5b65'
  on-tertiary: '#ffffff'
  tertiary-container: '#74747e'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#e3e1ed'
  tertiary-fixed-dim: '#c7c5d1'
  on-tertiary-fixed: '#1a1b23'
  on-tertiary-fixed-variant: '#46464f'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  gutter: 1.5rem
  margin-mobile: 1rem
  margin-desktop: 2rem
---

## Brand & Style

The brand personality for the management system is **Precise, Reliable, and Professional**. While it serves a bakery business, the interface moves away from "playful/sweet" aesthetics toward an "enterprise-grade" feel. It aims to evoke a sense of order and operational efficiency.

The design style is a blend of **Minimalism** and **Modern Corporate**. It prioritizes high-quality typography and strategic use of whitespace to handle complex data like inventory and POS transactions. The visual language uses soft, purposeful elevation to distinguish functional layers without the clutter of excessive borders or intense gradients. The result is a workspace that feels calm, focused, and trustworthy for business owners and staff.

## Colors

The palette is anchored by a sophisticated **Indigo-Purple** (#6366f1). This primary color is used for key actions and brand identification. 

- **Primary & Secondary:** A range of deep violets used for buttons, active navigation states, and primary data visualizations.
- **Surface & Background:** The UI utilizes a very light grey-tinted white (#f8fafc) for the main workspace and pure white (#ffffff) for card containers.
- **Accents:** A soft tertiary purple (#f5f3ff) is used for subtle backgrounds in chips or row highlights.
- **Neutrals:** Slate and Zinc tones are used for text and iconography to maintain high legibility and a serious tone.
- **Status:** Standard semantic colors (Green for success, Red for critical alerts, Amber for warnings) are desaturated slightly to align with the professional palette.

## Typography

The design system utilizes **Plus Jakarta Sans** across all levels. This typeface offers a clean, contemporary geometric structure that remains highly legible in data-dense environments like inventory tables and POS receipt lists.

- **Headlines:** Use tighter letter-spacing and bold weights to establish strong hierarchy in dashboard views.
- **Body:** Standardized at 14px for most management tasks to maximize information density without sacrificing clarity.
- **Labels:** Small caps and medium weights are used for table headers and metadata to distinguish them from primary data points.
- **Mobile scaling:** Headlines scale down by roughly 20% on mobile devices (e.g., Headline-LG moves from 30px to 24px) to ensure titles do not wrap awkwardly.

## Layout & Spacing

This design system follows a **Fixed-Fluid hybrid grid**. The sidebar remains fixed (260px desktop / 72px collapsed), while the main content area utilizes a fluid 12-column grid.

- **Rhythm:** A 4px baseline grid ensures consistent vertical alignment.
- **Gutters:** Standard 24px (1.5rem) spacing between dashboard cards and table columns.
- **Desktop:** 32px outer margins to give the "enterprise" interface breathing room.
- **Mobile:** 16px outer margins. Complex tables reflow into "card stacks" to ensure usability on smaller handheld devices used for POS or inventory counts.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Ambient Shadows**. The interface avoids heavy borders in favor of soft depth cues.

- **Level 0 (Background):** Solid surface (#f8fafc).
- **Level 1 (Cards/Tables):** White surface with a very soft, diffused shadow (0px 1px 3px rgba(0,0,0,0.05)).
- **Level 2 (Modals/Dropdowns):** Increased shadow spread (0px 10px 15px -3px rgba(0,0,0,0.1)) to indicate focus and separation from the main workflow.
- **Interactions:** Hover states on interactive cards use a "lift" effect, slightly increasing the shadow depth and adding a 1px primary-tinted border.

## Shapes

The shape language is **Rounded**, reflecting a modern professional software aesthetic.

- **Standard Elements:** Buttons, inputs, and small cards use a 0.5rem (8px) corner radius.
- **Large Containers:** Dashboard widgets and main content panels use 1rem (16px) for a more structured, containerized look.
- **Icons & Badges:** Circular or pill-shaped for status indicators and notifications to provide a clear visual distinction from structural UI elements.

## Components

### Buttons
- **Primary:** Solid indigo background, white text, 8px radius.
- **Secondary:** Ghost style with primary-colored text and a subtle tertiary-purple hover background.
- **Tertiary:** Text-only for low-priority actions (e.g., "Cancel").

### Inputs & Selects
- **States:** Default inputs have a light grey border. On focus, the border transitions to Primary Indigo with a soft outer glow (ring).
- **Labels:** Always positioned above the input field using `label-md` for maximum clarity.

### Data Tables
- Header rows use a light grey background with `label-sm` (uppercase) text.
- Row heights are generous (56px) to maintain a clean, professional feel.
- Hover states on rows use the tertiary purple tint.

### Cards & Widgets
- Key metrics (KPIs) feature a colored icon in the top right and large `headline-md` values.
- Backgrounds are always white with the Level 1 shadow.

### Inventory & Status Chips
- Use "tinted" backgrounds (e.g., soft green background with dark green text) for statuses like "In Stock" or "Pending." This ensures accessibility and a professional aesthetic compared to high-vibrancy solid chips.