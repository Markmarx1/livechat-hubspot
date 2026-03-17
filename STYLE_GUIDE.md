# Style Guide — LiveChat HubSpot Widget

## Typography

| Property     | Value                          |
|-------------|-------------------------------|
| Font Family | `'Open Sans', sans-serif`      |
| Weights     | 300 (light / body), 700 (bold / headings) |
| Base Size   | `16px`                         |

### Scale

| Element              | Size   | Weight |
|---------------------|--------|--------|
| Page heading (h2)   | `21px` | 700    |
| Contact name (card) | `19px` | 700    |
| Property value      | `17px` | 300    |
| Body / input text   | `16px` | 300    |
| Contact email       | `15px` | 300    |
| Note body           | `15px` | 300    |
| Subtitle / hint     | `14px` | 300    |
| Section title       | `13px` | 700, uppercase, `letter-spacing: 0.5px` |
| Note date           | `12px` | 300    |
| Pinned badge        | `11px` | 700, uppercase |

---

## Color Palette

### Brand / Accent Colors

| Name          | Hex        | Usage                                      |
|--------------|------------|---------------------------------------------|
| Slate Blue   | `#374965`  | Primary buttons, text on cards, links, input focus border |
| Slate Darker | `#2a3847`  | Hover state for slate blue elements         |
| Green        | `#26c281`  | Success, active toggle, CTA buttons, hover on cards, pinned notes |
| Green Darker | `#20a96d`  | Hover state for green buttons               |
| Red          | `#dc3545`  | Error messages                              |

### Dark Theme (`body[data-theme="dark"]`)

| Token              | Hex                          | Usage                     |
|-------------------|------------------------------|---------------------------|
| Background        | `#202024`                    | Page background           |
| Surface           | `#2a2a2e`                    | Input fields, hint cards  |
| Border            | `#444`                       | Input borders             |
| Text Primary      | `#fff`                       | Body text, headings       |
| Text Placeholder  | `rgba(255, 255, 255, 0.5)`   | Input placeholders        |

### Light Theme (`body[data-theme="light"]`)

| Token              | Hex        | Usage                     |
|-------------------|------------|---------------------------|
| Background        | `#fff`     | Page background           |
| Surface           | `#fff`     | Input fields              |
| Surface Alt       | `#e9ecef`  | Hint cards                |
| Border            | `#ddd`     | Input borders             |
| Text Primary      | `#333`     | Body text, headings       |
| Text Secondary    | `#666`     | Hints, loading text       |
| Text Placeholder  | `#999`     | Input placeholders        |

### Card Colors (Theme-independent)

| Token              | Hex                              | Usage                              |
|-------------------|----------------------------------|------------------------------------|
| Card Background   | `#e6e6e6`                        | Contact items, property cards, notes |
| Card Text         | `#374965`                        | All text inside cards              |
| Card Hover        | `#26c281`                        | Contact item hover                 |
| Card Shadow       | `rgba(0, 0, 0, 0.15)`           | `0 2px 8px` shadow on cards       |
| Divider           | `rgba(55, 73, 101, 0.2–0.3)`    | Row separators inside cards        |
| Pinned BG         | `rgba(38, 194, 129, 0.15)`      | Pinned note highlight              |
| Muted text        | `rgba(55, 73, 101, 0.7–0.8)`    | Dates, secondary labels in cards   |

---

## Spacing

| Token             | Value  |
|------------------|--------|
| App padding      | `16px` |
| Card padding     | `12px` |
| Input padding    | `8px 12px` |
| Button padding   | `8px 16px` (search), `10px 16px` (CTA) |
| Gap (list items) | `8px`  |
| Gap (search row) | `8px`  |
| Section margin   | `12px` bottom |

---

## Border Radius

| Element          | Radius |
|-----------------|--------|
| Standard (cards, inputs, buttons, hints) | `6px` |
| Toggle slider   | `24px` (pill) |
| Toggle knob     | `50%` (circle) |
| Pinned note     | `4px` |

---

## Shadows

| Name         | Value                             | Usage              |
|-------------|-----------------------------------|---------------------|
| Card shadow | `0 2px 8px rgba(0, 0, 0, 0.15)`  | All card elements   |
| Knob shadow | `0 1px 3px rgba(0, 0, 0, 0.3)`   | Toggle slider knob  |

---

## Transitions

| Property          | Duration | Easing  |
|------------------|----------|---------|
| Theme switch (bg, color) | `0.2s` | default (ease) |
| Toggle slider    | `0.2s`   | default |
| Card hover       | `0.15s`  | default |

---

## Components

### Cards (Contact Items, Properties, Notes)

```
┌─────────────────────────────┐
│  background: #e6e6e6        │
│  color: #374965             │
│  border-radius: 6px         │
│  padding: 12px              │
│  box-shadow: 0 2px 8px      │
│    rgba(0,0,0,0.15)         │
│                             │
│  hover → background: #26c281│
└─────────────────────────────┘
```

### Search Input

```
┌──────────────────────┐ ┌────────┐
│  Input               │ │ Button │
│  border-radius: 6px  │ │ #374965│
│  dark: bg #2a2a2e    │ │ white  │
│  light: bg #fff      │ │  6px   │
│  border: 1px solid   │ │        │
│  focus: border #374965│ │hover:  │
│                      │ │#2a3847 │
└──────────────────────┘ └────────┘
```

### Theme Toggle

```
Dark mode OFF:               Dark mode ON:
┌──────────────────┐         ┌──────────────────┐
│ #374965    ○     │         │     ●    #26c281 │
└──────────────────┘         └──────────────────┘
  44px × 24px                  Knob: 18px circle
  border-radius: 24px         translateX(20px)
```

### Buttons

| Type     | Background | Hover      | Text  | Radius |
|---------|------------|------------|-------|--------|
| Primary | `#374965`  | `#2a3847`  | white | `6px`  |
| CTA     | `#26c281`  | `#20a96d`  | white | `6px`  |
| Disabled | —         | —          | —     | `opacity: 0.6` |

### Hint Bubble

```
┌─────────────────────────────┐
│  font-size: 14px            │
│  border-radius: 6px         │
│  padding: 8px 12px          │
│  dark: bg #2a2a2e, color #fff│
│  light: bg #e9ecef, color #666│
└─────────────────────────────┘
```

### Success Toast

```
┌─────────────────────────────┐
│  background: #26c281        │
│  color: white               │
│  border-radius: 6px         │
│  padding: 8px 12px          │
│  font-size: 14px            │
└─────────────────────────────┘
```

### Error Text

```
color: #dc3545
font-size: 14px
```

---

## Dark Mode Implementation

- **Mechanism**: `body[data-theme="dark" | "light"]` data attribute
- **Default**: Dark mode
- **Persistence**: `localStorage` key `'hubspot-lookup-theme'`
- **Flash prevention**: Inline `<script>` in `index.html` sets the attribute before React hydrates
- **Transition**: `background 0.2s, color 0.2s` on `body` for smooth switching

### What changes between themes

| Element         | Dark                          | Light                   |
|----------------|-------------------------------|-------------------------|
| Page background| `#202024`                     | `#fff`                  |
| Body text      | `#fff`                        | `#333`                  |
| Input bg       | `#2a2a2e`                     | `#fff`                  |
| Input border   | `#444`                        | `#ddd`                  |
| Placeholder    | `rgba(255,255,255,0.5)`       | `#999`                  |
| Hint bg        | `#2a2a2e`                     | `#e9ecef`               |
| Hint text      | `#fff`                        | `#666`                  |
| Loading text   | `#999` (both)                 | `#666`                  |

### What stays the same

Cards (`#e6e6e6` bg, `#374965` text), buttons, toggle, shadows, green accents, error colors, and all spacing/radius values are **theme-independent**.

---

## Notes & Conventions

- No CSS custom properties (variables) — all values are hardcoded hex/rgba
- No media queries or responsive breakpoints
- Flexbox-based layout throughout
- `box-sizing: border-box` applied globally
- All interactive elements use `cursor: pointer`
- Disabled state: `opacity: 0.6; cursor: not-allowed`
- Links inside cards use `word-break: break-all` for long URLs
