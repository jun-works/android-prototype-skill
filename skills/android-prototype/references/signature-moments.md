# Signature moments

A **signature moment** is the one scene in a flow that only this app could have: a custom visual or interaction that
makes the app's core idea *felt*, not explained. It's what people remember and what makes a prototype feel designed.
Every flow gets one. The rest of the flow stays quiet and conventional so the moment can stand out.

## 1. How to find it

1. Write the flow's **job** in one line: what must the user understand, decide or feel by the end?
2. Find the **hard part** of that job — the thing a plain screen would explain badly:
   an invisible process (sorting, matching, syncing), an abstract rule, a bad-news constraint, a wait, a number
   that means nothing on its own, a first impression.
3. Ask: *what does the app actually do here, and how could the user watch or touch it?*
4. Write candidates as one sentence each: "<visual/interaction> so that <user understands/feels X>".
5. Run the **competitor test**: if the same scene would make sense in a competitor's app, it's decoration, not a
   signature. Push it until it's tied to this product's logic.

## 2. Patterns that work

| Pattern | Use when | Example |
|---|---|---|
| **Make the promise physical** | The app's value is abstract (progress, habit, saving) | Habit tracker (`examples/umteum`): each habit is a seed tossed into the soil; the first check makes it crack open, grow a stem and unfurl two leaves. "You grow what you do" without a sentence. |
| **Visualise the algorithm** | The app does something invisible (sorting, matching, syncing) | A music app that groups songs by mood: dots on a slowly turning sphere drift into coloured clusters as it "listens". The phases of the motion = the real steps of the logic. |
| **Characters = rules** | A rule or constraint must be learned, especially bad news | One character per criterion explains the rule in a short chat, the key sentence in a dark bubble, follow-up questions as quick replies. |
| **State is born, not toggled** | A control depends on validity | A sleeping character wakes when you type and smiles when the name is valid (`examples/umteum`); or the → button grows out of the input like a droplet — instead of a grey disabled button. |
| **Brand assembles itself** | First launch / splash | The pieces of the product idea drift together and merge into the logo in two seconds. |
| **Progress as story** | A wait or multi-step process | Show what's happening in the user's terms ("3 recipes found… 2 with what's in your fridge"), not a spinner. |
| **Data as object** | A number or summary is the payoff | A trip's stats as a ticket stub; spending as a receipt that tears off; a streak as a plant that grows. |
| **Physical feedback** | A key action needs weight | Check-off that splashes, swipe that stretches and snaps, a drop that falls into a cup. |

## 3. Making it good

- **One idea, executed fully.** A single strong metaphor beats three half-built effects.
- **It must carry meaning.** Every motion should map to something true (a step of the process, a rule, a state).
  Write that mapping into DESIGN_NOTES.
- **Interactive if possible.** Let the user poke it (tap the character to poke it, pick a step to see it, replay the chat).
- **Quiet surroundings.** Conventional app bar, plain type, generous space around the moment.
- **Readable without motion.** Still screenshots and reduced-motion users must still get the message
  (end state is meaningful; text states the point).
- **Performant.** ~200 canvas dots or a few SVG blobs are fine; pause loops when the screen isn't visible
  (`App.loop` does this).
- **Android-feasible.** Note the implementation path (Compose Canvas + `withFrameNanos`, `RenderEffect` for blur/
  colour filters on API 31+, AGSL `RuntimeShader` on 33+, fallbacks below) in DESIGN_NOTES.

## 4. Proposing it

When the user hasn't specified the moment, propose 2–3 one-sentence candidates before building (they're cheap; the
build is expensive), mark your recommendation, and build the chosen one. When the user *has* described it (e.g.
"seeds get planted and sprout on the first check"), build that — and spend your creativity on making it carry the product's logic.

## 5. Anti-patterns

- A three-page swipe carousel with stock-style illustrations and "시작하기".
- A spinner or a progress bar where the process itself could be shown.
- A modal warning paragraph for a rule that could be explained with an example.
- Lottie-style decoration unrelated to what the app does (confetti for everything, bouncing mascots that say nothing).
- Effects as rescue: gradients, glows and glass applied to a flow that has no idea.
