---
name: "Forge Tax 2D"
description: "A living 2D pixel workshop for forging swords and meeting the dragon's daily tribute."
colors:
  ink: "#09070c"
  ink-2: "#0e0b12"
  panel: "#15111a"
  panel-2: "#1b1521"
  panel-3: "#231b28"
  line: "#3c3041"
  line-soft: "#2a222f"
  line-warm: "#56412f"
  gold: "#e8b45a"
  gold-bright: "#ffdc92"
  gold-dark: "#8c5a1e"
  ember: "#ff7a3c"
  ember-2: "#ffa45c"
  ember-deep: "#b8431e"
  parchment: "#ecddc0"
  bone: "#d8cbb0"
  muted: "#c2b49c"
  muted-2: "#a79882"
  green: "#78c69c"
  green-deep: "#2c6b4f"
  red: "#e05a4f"
  red-deep: "#7c2b28"
  blue: "#7ca8d6"
  purple: "#a88ccb"
  steel: "#8ea0b2"
typography:
  display:
    fontFamily: "'Press Start 2P', 'Fusion Pixel', 'Microsoft YaHei', monospace"
    fontWeight: 400
  headline:
    fontFamily: "'Fusion Pixel', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif"
    fontSize: "clamp(25px,3vw,42px)"
    lineHeight: 1.5
    letterSpacing: ".08em"
  title:
    fontFamily: "'Fusion Pixel', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: ".06em"
  body:
    fontFamily: "'Fusion Pixel', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Fusion Pixel', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif"
    fontSize: "11px"
  number:
    fontFamily: "'Press Start 2P', 'Fusion Pixel', 'Consolas', monospace"
    fontWeight: 400
  button:
    fontFamily: "'Fusion Pixel', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: ".06em"
spacing:
  gap-tight: "4px"
  gap-control: "8px"
  inset-content: "12px"
  inset-dialog: "20px"
  edge-workshop: "22px"
components:
  button-primary:
    textColor: "#201205"
    typography: "{typography.button}"
    padding: "10px 16px"
  button-ember:
    textColor: "#ffe5cd"
    typography: "{typography.button}"
    padding: "10px 16px"
  button-ghost:
    textColor: "{colors.bone}"
    typography: "{typography.button}"
    padding: "10px 16px"
  button-danger:
    textColor: "#ffd7cf"
    typography: "{typography.button}"
    padding: "10px 16px"
  button-hammer:
    textColor: "#1a0f05"
    typography: "{typography.button}"
    padding: "6px 18px"
    width: "200px"
    height: "64px"
  input:
    backgroundColor: "#0d0a11"
    textColor: "{colors.parchment}"
    padding: "10px 12px"
  navigation-tab:
    textColor: "{colors.muted}"
    padding: "8px 5px"
  navigation-tab-active:
    backgroundColor: "#6c481b70"
    textColor: "{colors.gold-bright}"
    padding: "8px 5px"
  chip-hot:
    backgroundColor: "rgba(8,6,11,.72)"
    textColor: "{colors.ember-2}"
    padding: "2px 6px"
  tutorial-card:
    backgroundColor: "#17150ff5"
    padding: "16px 18px"
    width: "min(320px,28vw)"
---

# Design System: Forge Tax 2D

## Overview

**Creative North Star: "像素工坊：场景即界面"**

The workshop is a continuous, fixed-camera 2D pixel-art room. Soot-dark stone, timber, iron, brass, and living furnace light establish the world. Crisp Chinese pixel lettering and compact numerical readouts let the player act inside it.

The room carries the spatial story; controls and information sit near the objects they affect. The generated background and transparent anvil share the stage with procedural sword art, authored SVG props, and result particles. Short introduction copy establishes the blacksmith's predicament, then the first day's tutorial follows actual play. This document records the current implementation; it does not establish full equivalence with the original game.

**Key Characteristics:**
- Continuous desktop room with a central foreground sword and anvil.
- Charcoal and soot neutrals, ember heat, brass actions, and parchment text.
- Crisp raster clusters, authored pixel geometry, and self-hosted pixel fonts.
- Contextual instruction and outcome-driven forging feedback.

## Colors

The palette is warm and material: brass identifies action, ember identifies heat, and pale parchment keeps information readable against dark scenery. The frontmatter preserves the effective source values, including the muted-text overrides in `workshop.css`.

### Primary
- **Antique brass** (`gold`, `gold-bright`, `gold-dark`): action emphasis, quota figures, active tabs, keyboard focus, and exceptional results. Dark brass also appears in inherited borders and secondary decoration; it is not a body-text contrast recommendation.

### Secondary
- **Living ember** (`ember`, `ember-2`, `ember-deep`): the furnace, heating states, charge pips, and damage-related warmth. Use heat color to support a named state.

### Tertiary
- **Tempered green** (`green`, `green-deep`): success, sufficient tribute, and completed progress.
- **Fracture red** (`red`, `red-deep`): breakage, errors, anger, and shortfall.
- **Relic blue and violet** (`blue`, `purple`): rarity and special item distinctions.
- **Steel** (`steel`): equipment and material detail.

### Neutral
- **Soot ink** (`ink`, `ink-2`): application darkness.
- **Charcoal panels** (`panel`, `panel-2`, `panel-3`): existing menus and dialogs.
- **Iron and warm seams** (`line`, `line-soft`, `line-warm`): component boundaries and dividers.
- **Parchment and bone** (`parchment`, `bone`): primary and secondary readable content.
- **Ash lettering** (`muted`, `muted-2`): supporting text, using the later workshop overrides rather than the darker initial declarations.

**The State Has a Name Rule.** Pair heat, risk, resource, and completion colors with labels or figures; color alone does not explain a game state.

## Typography

**Display Font:** Press Start 2P, with Fusion Pixel and the source fallback stack.
**Body Font:** Fusion Pixel, self-hosted for Latin and Simplified Chinese.
**Label/Mono Font:** Press Start 2P for compact game numbers and Latin key hints; Fusion Pixel for Chinese labels.

The pairing keeps the interface visibly pixel-based while Chinese text remains readable. Font faces are supplied at regular weight; source headings and buttons request bold where needed. Display is a family role, not a single global size.

### Hierarchy
- **Display:** the boot wordmark uses the display family at (22px); other Latin game lettering and numeric roles vary by component.
- **Headline:** the introduction uses the frontmatter clamp and a relaxed line-height.
- **Title:** the selected sword name uses the frontmatter title role.
- **Body:** application text uses the body role; introduction prose is (17px) with line-height (1.7).
- **Label:** small desktop resource labels and probability labels use the label role. Inventory and shop names are (13px); tutorial copy is (13px), reduced to (12px) in the compact-height desktop rule.
- **Number:** keep quantities in the numerical family, with explicit units and names. Source sizes depend on context: quota (15px), resource quantity (11px), and probability value (8px).

**The Pixel Lettering Rule.** Use the supplied pixel families for the game's voice, and preserve the Chinese fallback stack. Do not replace them with a smooth display face.

## Layout

The accepted product target is a desktop-browser game. The scene fills the viewport and the game screen uses a fixed (100dvh) canvas with controlled local scrolling. Source `style.css` supplies base components; later `workshop.css` owns the continuous-room composition and overrides earlier panel layout.

The top HUD is (76px) tall. Furnace controls and sword storage occupy the left edge; the central sword/anvil remains the largest interactive object; shop and relic tabs sit upper-right; the tribute drop area and bell sit lower-right. The usual left zone is (230px) wide, right zones are (260px) wide, and room-edge insets use the extracted workshop edge spacing. These are layers in one scene, not equal-width webpage cards. The central hammer control remains low in the room, below sword state and probability information. Shop content scrolls inside its bounded area.

At desktop widths from (801px) through (1150px), source rules narrow side zones and HUD spacing. At desktop heights up to (780px), the HUD becomes (64px), the anvil stage reserves (245px) below it, the anvil display width becomes (290px), and tutorial padding/type compresses. The compact desktop capture at (1280×720) and the current larger desktop capture are the review evidence. Keep the anvil clear of probability labels and keep resource names visible.

The introduction uses the same room behind a dark left-to-right scrim, with text constrained to (580px) and a single entry action. The tutorial is a small upper-left overlay rather than a page-covering dimmer.

**The Scene Carries the Room Rule.** Let floor, wall, light, and props continue between controls. Add backing only where text or interaction needs it.

Existing CSS at widths of (800px) and below includes mobile tabs, docks, and alternate positioning. That inherited mobile CSS is not a newly approved product target or acceptance promise. Mobile is explicitly outside this desktop-only design scope.

## Elevation & Depth

Depth comes primarily from illustrated perspective, foreground overlap, shadowed material, and local dark text backings. The workshop removes the old cut-panel borders, nested decorative panel edges, and panel shadows from the game scene. The HUD uses a transparent dark gradient with no backdrop blur. Inventory, tribute, probability readouts, and tutorial retain controlled dark backings for legibility.

### Shadow Vocabulary
- **Foreground grounding** (`drop-shadow(0 18px 16px #0009)`): the separate anvil's contact with the room.
- **Inventory backing** (`0 12px 24px #0008`): readable foreground stock.
- **Tutorial backing** (`0 14px 32px #0007`): the contextual instruction layer.
- **Hammer control** (`inset 0 2px 0 #ffe3a870, 0 8px 24px #0007`): a tactile main action distinct from the background.

The source still contains inherited hard offset button shadows, decorative halos, modal blur, and small eyebrow labels. They are recorded as existing implementation detail, not promoted into reusable visual requirements. Documentation does not repair them.

## Shapes

Game objects have authored pixel silhouettes. UI uses straight sides, thin seams, compact rectangles, and clipped control corners. The source's `--radius-cut` value (8px) is a polygon corner cut, not a rounded-corner token; dialog frames use a separate (12px) cut. No rounded scale is declared in the frontmatter.

The workshop itself removes clipping from scene containers. Small rotations on the furnace group and tribute area suggest physical placement without changing the rectangular control hit areas. Generated foreground art uses actual PNG alpha; do not simulate transparency with geometric masks.

## Components

### Buttons
Tactile, compact controls with explicit actions. Default controls have a (42px) minimum height, a (2px) border, and the frontmatter padding; smaller contextual controls are intentionally denser.

Primary buttons use the source brass gradient, ember buttons use the dark heated gradient, ghost buttons use charcoal, and danger buttons use dark red. Full gradients and clipped geometry live in the sidecar snippets. Hover brightens the surface and lifts it (1px); active presses it (2px); disabled controls reduce opacity and saturation. Keyboard focus uses the current brass outline (2px) with a (4px) offset.

### Inputs / Fields
Existing login fields use a dark inset surface, (2px) seam, and the extracted input padding. Focus changes the seam to dark brass and adds a faint outer focus treatment; the caret uses bright brass. Error copy appears separately in fracture red.

### Navigation
The shop/relic switch is a compact row placed inside the upper-right scene layer. Default tabs use muted lettering; the active tab gains a translucent brass backing and thin brass bottom seam. HUD icon controls remain compact and named by their accessible titles. Inherited mobile navigation is outside the accepted scope.

### Chips
Small, square status tags use dark translucent backing and (1px) borders. Hot, good, gold, and bad variants pair their palette role with actual state text. They sit near the selected sword, not in a separate dashboard.

### Cards / Containers
The contextual tutorial uses a dark backing, thin warm top seam, the frontmatter width, and a soft backing shadow. Its six progress labels show the current and completed steps. Storage, shop, and tribute layers use only the backing needed for their content; do not copy the inherited framed panel shell back over the room.

### Forging stage
The shipping room plate is a built-in ImageGen asset exported as a (640×360) lossless WebP. The foreground anvil is a separate (240×160) RGBA PNG with real transparency. Both were downscaled with nearest-neighbor sampling, and the page applies pixelated/crisp-edge rendering. See `docs/audit/generated-assets.md` for exact prompts and processing; the PNG carries embedded prompt metadata and the WebP carries a provenance sidecar.

Procedural sword assets, SVG hammer, bell, dragons, item art, and authored UI icons remain separate layers. The generated plate is scenery; it must not contain baked-in game text, buttons, quantities, or an interactive sword/anvil duplicate. Live DOM and engine state own those elements.

A real hammer action uses a normalized 3:2 foreground rig shared by sword, anvil and hammer. The handle pivots at 50%/88% of the tightly framed hammer, with its striking face meeting the blade at 60%/8% of the rig. The pose lifts slowly, accelerates downward, holds contact, then rebounds. Total motion is `min(560ms, engineInterval × 0.9)`; contact occurs at 42% and holds until 50%. Rendered results, physical amber sparks, local recoil and layered steel/low-frequency audio begin at contact. Interface text and controls remain stationary during the brief room shake. The room's fire backing breathes in stepped opacity (4s, five steps); guide targets use stepped outline emphasis (1.6s, two steps).

Both the in-game Reduce Motion setting and OS preference apply the reduced-motion mode: immediate result presentation without the spatial hammer swing, no room/rig shake or ambient particles, fewer impact particles and a short contact flash. Sound follows its separate enabled/volume setting. Interrupted or hidden-window swings present their pending result once, quietly, without losing a committed forging result.

### Introduction and first day
The introduction explains identity and the daily survival objective before initial relic choice. The guide follows real placement, heating, forging, offering, bell, and next-day state; it does not change probabilities to manufacture a tutorial result. Completion follows actual first-day settlement. Preserve the distinction among physical swords, tribute value, gold, and sword coins.

## Do's and Don'ts

### Do:
- **Do** keep the accepted desktop composition as one continuous 2D pixel-art room.
- **Do** use generated scenery and transparent props alongside the procedural game assets, with nearest-neighbor rendering.
- **Do** keep live state, quantities, probabilities, controls, and instruction in readable UI layers.
- **Do** preserve visible resource names, keyboard focus, drag/drop affordances, and the actual first-day outcome.
- **Do** describe the in-game and OS reduced-motion behaviors accurately.

### Don't:
- **Don't** rebuild the workshop as three nonoverlapping webpage panels and a detached footer.
- **Don't** bake labels or interactive state into scenery, or duplicate the foreground sword and anvil in the room plate.
- **Don't** treat inherited mobile CSS as a newly approved product target.
- **Don't** change game odds or claim complete original-game equivalence through visual documentation.
- **Don't** canonize inherited eyebrow labels, hard offset shadows, decorative halos, or unverified contrast as rules for new surfaces.
