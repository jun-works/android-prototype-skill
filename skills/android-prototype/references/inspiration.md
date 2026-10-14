# Working from inspiration

A reference is the fastest way to get out of the default look. The user's reference tells you *what kind of feeling*
they want; your job is to extract the **principles** behind it and rebuild them for this product — never to copy
its assets, brand, or layout.

## 1. Getting references

- If the user gives one (URL, app name, library, screenshot, Dribbble shot, a phrase like "Toss 같은 느낌"), use it.
- If they don't, propose 2–3 **concrete** candidates in one line each and ask which is closest — or, in fast mode,
  pick one and say why. Good candidates are specific: "rive.app — characters that react to input",
  "Arc browser's onboarding — playful motion, bold type", "Things 3 — calm, paper-like, precise".
- A reference can be non-UI: a material (paper, glass, fabric), an object (ticket stub, field notebook), a motion
  (water, magnetism, breathing). These often produce the most ownable results.

## 2. Reading a reference

Open it (WebFetch / browser tools for URLs; read images). Write down, briefly:

| Ask | Example (rive.app) |
|---|---|
| What is the **core trick**? | Characters are state machines: inputs move them between states, and idle states keep them alive |
| What **feeling** does it create? | Alive, responsive, a little playful |
| What are its **named components / ideas**? | State machines, inputs, blend states, idle loops (breathing, blinking) |
| What's **not transferable**? | Its editor and runtime, its characters and demos |
| What's the **principle** we keep? | "The interface reacts to you: state changes are things a character does, not toggles" |

## 3. Translating it

Map each principle onto a concrete moment in *this* app's flow:

| Principle | In the product (habit tracker, `examples/umteum`) |
|---|---|
| Characters are state machines | A seed sleeps, wakes when you focus the name field, follows your letters with its eyes and smiles when the name is valid |
| Idle loops keep them alive | Seeds breathe and blink at different times while you decide |
| State changes are actions | Picking a habit tosses its seed into the soil; the first check makes it crack open and sprout — instead of a checkbox turning green |

Then implement with web primitives the shell supports (SVG filters, canvas, CSS keyframes — see
`motion-recipes.md`) and note the Android equivalent in DESIGN_NOTES (RenderEffect, Canvas, AGSL…).

## 4. Rules

- Credit the reference in DESIGN_NOTES ("영감: … — 빌려온 원리").
- Don't embed the reference's code, images, fonts or logos. Re-implement the principle.
- Keep Android structure (system back, app bars where navigation needs them, 48dp targets). The reference changes
  the voice, not the platform.
- One reference per app is usually enough; two at most (e.g. one for visual language, one for motion).
