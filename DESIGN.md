# SangSafar · design system ("The Journey Line")

A proposed direction, not an approved brand. Every colour is a token in
`app/globals.css` (`:root`), so the whole palette can be swapped in one place.

## Concept

A journey is a line between two places, and the interface draws it.

- **Route Line** (`components/route-line.tsx`): white origin node, one
  continuous hand-tuned stroke, vermilion destination node, mode icon at the
  crest. Large on trip, post and share screens. `RouteMini` (24px) leads every
  trip, match and chat row.
- **Time Ruler** (`components/time-ruler.tsx`): 00–24 track, minute-accurate.
  Your window in ink, theirs in `line-strong`, overlap in vermilion across both
  lanes. Exact windows always in text, plus an aria-label. Sparse ticks on
  phones.
- **Demand Heat Stepper** (`components/demand-stepper.tsx`): route fields with
  the line between them, and a 7-day strip. Unsuppressed counts get a fixed
  3–6 dot scale. Every suppressed day, zero included, gets the same single
  hollow dot and "Low demand".

## Tokens

| Token | Value | Use |
|---|---|---|
| paper | #FAF7F0 | page |
| paper-raised | #FFFFFF | sheets, inputs, chat |
| ink | #191613 | text, node rings, own bubbles, own window |
| ink-soft | #57504A | secondary text (7.4:1 on paper) |
| line | #E4DCCF | hairlines, resting stroke |
| line-strong | #988A74 | their window, resting route line, hover borders (added: `line` is 1.3:1, too faint for a data bar; this is 3.15:1) |
| accent | #B93810 | destination node, one primary action, overlap (5.4:1 on paper, white on accent 5.8:1) |
| trust | #0E6B5C | verified, accept, travelled together (6.0:1 on paper, white on trust 6.4:1) |
| warn | #B3261E | errors, destructive (6.1:1 on paper) |

All ratios computed with the WCAG formula. Vermilion is a point colour: one primary action per screen. Match rows use
quiet "Request to connect" buttons; the accent appears on the confirm step. The
women-only filter is an ordinary ink chip, no pink and no shield.

## Type

Bricolage Grotesque (display, 600–700, −0.02 to −0.04em, balanced wrap) and
Instrument Sans (UI 400/500/600). Both are self-hosted through `next/font`.
Tabular numerals on every time, date and count. Scale tokens: display 34/56,
h1 26/36, h2 20/24, body 16, small 14, micro 12. No eyebrows, no monospace.

## Shape and space

Radius 10px on sheets and inputs, 999px on chips and buttons. One shadow
recipe. Spacing uses only 4, 8, 12, 16, 24, 40 and 64 (Tailwind 1/2/3/4/6/10/16).
Screens are columns of groups separated by space and hairlines. A sheet appears
only where a surface lifts: inputs, chat bubbles, unlocked details, menus.

## Motion

Two authored moments only:

1. The route line draws once on the landing page and post success (720ms,
   expo-out, destination node lands last).
2. The trip-details sheet unfolds (clip-path, 400ms) the first time an
   accepted chat opens.

Everything else is a 150ms state transition. Loading is a shimmer, not a
spinner. `prefers-reduced-motion` shows the end state.

## Layout

- **Phones:** four bottom destinations (Discover, My trips, Inbox, Profile)
  with safe-area padding, and Post in the header. Bottom nav hides inside a
  chat so it never covers the composer.
- **Desktop:** compact top nav and a 1120px workspace. Matches get a
  route-summary rail; chat gets a conversation list beside the thread.

## Browser surfaces

Selection is 20% accent on paper; caret is accent; focus is a 2px ink ring
offset 2px; scrollbar is thin `line-strong` on paper; links have a 3px
underline offset.

## Refused

Eyebrows, card grids, hero metrics, gradients and glass, side-border callouts,
emoji or glyph icons (all icons are drawn SVG at 1.75 stroke, in
`components/icons.tsx`), and modals except delete/block confirmation. No stock
photography: all imagery is the line system.
