# Ten tells: contextual review catalog

## Contents

1. Gradients everywhere
2. Color without meaning
3. Redundant or pulsing badges
4. Accent-edge cards
5. Decorative emoji
6. Misalignment
7. Default typography and programming costume
8. Prompt residue in product copy
9. Glassmorphism and canned aesthetic swaps
10. Generic taglines and hype

## Basis and interpretation

This catalog is adapted from the article ["10 tells of a slop ui"](https://hereticpleb.vercel.app/blog/10-tells-of-slop) by hereticpleb (September 27, 2026). It is self-contained; do not fetch the article.

Treat the article as an opinionated design critique, not a validated AI classifier. The author's examples and aesthetic dislikes are prompts to investigate, not universal prohibitions. Use the checks and remedies below as operational extensions of the article. Do not repeat its speculation about model training as fact or infer how any pictured site was built.

The article mentions a 70-30-10 color rule. Do not carry that into a numerical requirement; use hierarchy, semantic consistency, and legibility instead. Treat the listed fonts and styles as legitimate choices when they fit the product.

## 1. Gradients everywhere

Inspect unrelated gradients on the background, headings, cards, controls, and icons, especially repeated purple/blue glow treatments.

- **Flag when:** gradients compete for attention, blur the priority of actions, reduce legibility, or supply most of the visual identity without a product-specific reason.
- **Keep when:** a controlled gradient is a deliberate brand motif, meaningful data encoding, or useful image treatment.
- **Recommend:** use stable surfaces for reading and task work; reserve a justified treatment for one role or moment. Build hierarchy with size, spacing, contrast, and content. Specify exactly which elements change.
- **Verify:** the main action remains identifiable, text stays legible across the gradient, and removing decoration has not removed necessary emphasis.

## 2. Color without meaning

Inspect dashboards or menus where each tile receives a different bright color without a stable category or state mapping.

- **Flag when:** arbitrary hues imply distinctions that do not exist, compete equally for attention, or conflict with warning/success/error meanings.
- **Keep when:** colors consistently encode genuine categories, teams, chart series, or recognizable brand content.
- **Recommend:** define a small role-based palette: surfaces, text, actions, and meaningful states/categories. Use labels and structure to distinguish unrelated items. Reuse the same color for the same meaning.
- **Verify:** categories and statuses remain understandable without color alone; semantic colors survive the redesign. Do not impose a fixed palette count.

## 3. Redundant or pulsing badges

Inspect active, live, verified, secure, premium, and announcement pills, especially with glowing or pulsing dots.

- **Flag when:** the badge cannot affect a decision, repeats an unavoidable state, distracts continuously, or claims verification without an established meaning. A screenshot only establishes that the badge is visible, not that it pulses or is hardcoded.
- **Keep when:** a status describes a real state users need, such as an incident, suspended credential, published/draft content, or authenticated issuer. A state can matter even if uncommon or currently not visible.
- **Recommend:** establish the badge's state model, source of truth, transitions, and user action. Use a quiet static status for persistent information; use motion for a meaningful transient change if needed. Remove decorative claims only after checking their role.
- **Verify:** labels agree with actual state, pending and failure states remain expressible, and essential status is available without animation or color alone. Do not imply a status component itself proves security.

## 4. Accent-edge cards

The article's "Finger Nail Cards" are rounded panels with a narrow colored strip following the curved left edge, as pictured on the class schedule card. Do not confuse the term with all rounded cards.

- **Flag when:** the same edge decoration is repeated without meaning, every small item becomes a heavy card, or containers hide relationships and waste task space.
- **Keep when:** cards represent independent objects, borders identify a real category or state, or grouping improves scanning and touch interaction.
- **Recommend:** choose the structure from the relationship: aligned rows for records, a table for comparison, a timeline for sequence, or simple section dividers for prose. Use open spacing for hierarchy; retain bounded cards where they help.
- **Verify:** grouping, selection, actions, and responsive reading remain clear. Removing the colored strip alone may be enough for an otherwise sound component.

## 5. Decorative emoji

Inspect emoji used as icons beside every heading, action, ingredient, or data point.

- **Flag when:** inconsistent style or platform rendering weakens identity, emoji add no meaning, decoration slows scanning, or the tone conflicts with the task.
- **Keep when:** emoji are intentional content, reactions, user expression, or part of an appropriate playful brand.
- **Recommend:** remove unnecessary marks; use clear text or the existing coherent icon family for meaningful controls. Preserve readable labels and accessible names. Do not replace every emoji with an equally decorative generic icon.
- **Verify:** users can still identify actions and categories, and information does not depend on a decorative glyph.

## 6. Misalignment

Inspect timeline dots and rules, SVG view boxes, icon/text baselines, adjacent labels, and visual centers. The article's timetable image shows markers offset from the vertical track.

- **Flag when:** misalignment creates ambiguous association, weakens scan lines, or suggests unfinished assembly. Distinguish optical alignment from literal bounding-box alignment.
- **Keep when:** an intentional offset supports a clear compositional relationship without harming comprehension.
- **Recommend:** align shared elements to a common layout track or anchor; normalize icon dimensions; fix the component geometry instead of adding unexplained per-item offsets.
- **Verify:** check long labels, wrapping, responsive widths, and different content lengths. Do not diagnose broken behavior from an image alone.

## 7. Default typography and programming costume

Inspect undifferentiated default font roles, automatic Inter or JetBrains Mono choices, decorative `//` prefixes, terminal wording, and monospace applied to ordinary prose because the product is technical.

- **Flag when:** typography lacks hierarchy, undermines readable data/prose, or borrows a terminal persona unrelated to the user's work. A font name alone is never the defect.
- **Keep when:** the existing font suits the brand, monospace aids code or identifiers, and stable numeral widths help compare values.
- **Recommend:** first refine size, weight, measure, spacing, and display/body/data roles. Change the family only with a reason grounded in identity, readability, licensing, language coverage, and delivery cost. Remove irrelevant syntax decoration.
- **Verify:** font fallbacks, hierarchy, long strings, numerical alignment, and narrow screens. Do not trade a usable default for an ornamental font merely to appear different.

## 8. Prompt residue in product copy

Inspect text that advertises the developer's editor, framework, implementation instructions, or internal project rationale without helping the intended audience.

- **Flag when:** the UI narrates how it was made or echoes the construction brief instead of communicating a user benefit, action, state, or necessary explanation. Assess visible copy; do not claim to know the hidden prompt.
- **Keep when:** provenance, compatibility, export format, infrastructure, or a technical limitation materially affects a user's decision. Developer products may need implementation detail.
- **Recommend:** delete irrelevant text or translate it into a concrete capability. Keep the explanation where the user needs it, not as permanent marketing chrome.
- **Verify:** every retained sentence has an audience and a purpose. Do not remove required attribution or useful technical facts simply because they mention a tool.

## 9. Glassmorphism and canned aesthetic swaps

Inspect layered blur, translucent panels, tinted borders, glow, and depth used as a default skin. The article also warns that repeated brutalist treatments can become generic.

- **Flag when:** glass reduces contrast, makes surfaces indistinguishable, obscures content, or is the only identity. Apply the same question to any ready-made visual costume.
- **Keep when:** translucency communicates real spatial layering or supports an intentional brand and remains readable.
- **Recommend:** assign each surface a role. Prefer an opaque reading surface when underlying content is irrelevant; keep useful layering where it explains the interaction. Change composition and content hierarchy before swapping the whole aesthetic.
- **Verify:** legibility on varied backgrounds and across relevant states, visual hierarchy, and rendering performance if blur was substantial. Never prescribe brutalism as the automatic antidote.

## 10. Generic taglines and hype

Inspect interchangeable claims such as "elevate," "seamless," "next-generation," "supercharge," "unleash," and "empower"; automatic greeting banners; and a grey explanatory subtitle under every title.

- **Flag when:** copy could be moved to an unrelated product unchanged, repeats the obvious, makes unsupported claims, or consumes task space to resell a product the user is already using.
- **Keep when:** a concise headline or greeting serves the context and communicates a specific, credible value. Landing pages and working applications have different needs.
- **Recommend:** name the actual object, task, outcome, or current state. Use verb-object action labels. Replace generic descriptions with factual differentiators only when established; remove text when the UI already explains itself.
- **Verify:** a new user understands the main purpose and next action; returning users reach work quickly; the rewrite introduces no unverified features, counts, or promises.
