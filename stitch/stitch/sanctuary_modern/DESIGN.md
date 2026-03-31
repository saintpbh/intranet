# Design System Document: High-End Editorial Intranet

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Sanctuary"**

This design system rejects the "utilitarian grid" common in corporate intranets. Instead, it adopts an editorial, high-end aesthetic that feels like a premium digital publication. We move beyond "standard" UI by treating the screen as a curated space where information breathes. 

To break the "template" look, we utilize **intentional asymmetry**, where large display typography anchors the page while content cards float with varying vertical rhythms. By layering "frosted glass" elements over deep, tonal gradients, we create a sense of infinite depth—symbolizing both the tech-forward nature of the organization and its profound, spiritual foundation.

---

## 2. Colors & Surface Logic

The palette is rooted in the authority of **Deep Blue (#0A2540)** but elevated through high-contrast accents and complex neutral layering.

### The "No-Line" Rule
**Explicit Instruction:** Sectioning via 1px solid borders is strictly prohibited. Boundaries are defined exclusively through:
1.  **Background Color Shifts:** A `surface-container-low` section sitting on a `surface` background.
2.  **Tonal Transitions:** Moving from a solid primary color to a `primary-container` gradient.
3.  **Negative Space:** Using the `Spacing Scale` (specifically `8` to `12`) to create clear cognitive breaks.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the `surface-container` tiers to define importance:
- **Base Layer:** `surface` (#f9f9fe) for the overall background.
- **Structural Sections:** `surface-container-low` (#f3f3f8) for grouping secondary content.
- **Interactive Cards:** `surface-container-lowest` (#ffffff) to provide the highest "pop" against the background.

### The "Glass & Gradient" Rule
To achieve the "Sanctuary" vibe, use **Glassmorphism** for persistent floating elements (like the Bottom Navigation or Header). 
- **Recipe:** Apply a semi-transparent `on-surface` (at 5-10% opacity) or `surface-container-lowest` (at 70% opacity) with a `backdrop-filter: blur(20px)`.
- **Signature Textures:** Main CTAs must use a subtle linear gradient from `secondary` (#0058bc) to `secondary_container` (#0070eb) at a 135-degree angle to provide "visual soul."

---

## 3. Typography: The Editorial Voice

We utilize a dual-font approach to balance authority with modern accessibility.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern "Apple-style" clarity. Use `display-lg` for welcome screens to create a bold, editorial entrance.
*   **Body & UI (Plus Jakarta Sans):** Chosen for its high x-height and readability. It feels "high-tech" yet approachable.

**Hierarchy as Identity:**
- **Authority:** Use `headline-lg` in `primary` (#000f22) for section headers to convey trustworthiness.
- **Guidance:** Use `label-md` in `on_surface_variant` (#43474d) with increased letter-spacing (0.05em) for category tags to keep the UI feeling "light."

---

## 4. Elevation & Depth: Tonal Layering

We avoid harsh dropshadows in favor of "Ambient Presence."

*   **The Layering Principle:** Depth is achieved by "stacking" surface tiers. An "Inner Card" should be `surface-container-lowest` placed inside a `surface-container` section. The change in hex value creates a soft, natural lift.
*   **Ambient Shadows:** For floating elements (e.g., Action Buttons), use a diffused shadow: `box-shadow: 0 20px 40px rgba(10, 37, 64, 0.06)`. Note the use of a `primary-container` tint for the shadow color rather than pure black; this mimics natural light.
*   **The "Ghost Border":** If accessibility requires a container edge, use the `outline-variant` token at **15% opacity**. Never use 100% opaque borders.
*   **Physicality:** Objects that "float" must utilize `backdrop-blur`. This ensures the content beneath "bleeds through," making the UI feel integrated into the environment.

---

## 5. Components

### Cards & Containers
- **Corner Radius:** All primary cards must use `DEFAULT` (1rem/16px). Feature cards use `lg` (2rem/32px) to emphasize a "soft/friendly" high-tech vibe.
- **Spacing:** Forbid divider lines. Use `spacing-6` (2rem) as the standard vertical gap between list items to let the typography drive the separation.

### Buttons (The "Call to Action")
- **Primary:** Rounded `full`. Gradient fill (`secondary` to `secondary_container`). White text.
- **Secondary:** Transparent background with a "Ghost Border" (15% `outline-variant`). `on_surface` text.
- **Interactions:** On press, the card/button should scale down slightly (98%) to simulate physical tactility.

### Input Fields
- Use `surface-container-high` as the fill color. No border.
- Floating labels using `label-sm` appear only when the field is active.
- Error states: Use `error` (#ba1a1a) for text but a subtle `error_container` wash for the field background.

### Bottom Navigation
- **Style:** Floating island design.
- **Blur:** 80% opacity `surface_container_lowest` with 24px backdrop-blur.
- **Active State:** A vibrant `secondary` (#0070eb) dot indicator below the icon, rather than a "filled box," to keep the design airy.

---

## 6. Do’s and Don’ts

### Do
- **DO** use white space aggressively. If it feels like "too much" space, it’s likely just right for this system.
- **DO** use `surface-dim` to create subtle contrast for non-interactive background areas.
- **DO** align text to the left for long-form reading, but use centered `display-md` typography for hero moments.

### Don't
- **DON'T** use pure black (#000000) for text. Use `on_surface` or `primary` to maintain the deep blue tonal harmony.
- **DON'T** use 1px dividers. If you need to separate content, use a background color step (e.g., `surface` to `surface-container-low`).
- **DON'T** use harsh, small-radius corners (e.g., 4px). This breaks the "Sanctuary" aesthetic; keep everything rounded and organic.