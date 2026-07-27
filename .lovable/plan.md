## Problem

In `src/components/tutorial/TutorialProvider.tsx`, `measure()` re-scrolls the highlighted element into view whenever it detects the target is off-screen. It's also wired to run on every `scroll` event (line 202) plus a 200ms poll (line 207). So when the user manually scrolls, `measure()` fires, sees the target is out of view, and calls `scrollIntoView` again — snapping the viewport back and making it impossible to scroll away or click elsewhere.

## Fix

Separate "measure" from "auto-scroll":

1. Extract the `scrollIntoView` behavior into a one-time effect that runs only when the step changes (i.e. `step.selector`), not on every `measure()` call.
2. `measure()` becomes purely a `getBoundingClientRect` + `setRect` — safe to call on scroll/resize/polling.
3. Keep the scroll/resize listeners so the spotlight box tracks the element if the user scrolls, but never force the viewport back.
4. Keep the short mount-poll so late-mounting targets still get located, but without triggering scrollIntoView repeatedly (only the initial step-change effect scrolls).

Optional polish: use `block: "center"` only if the target is off-screen at step activation; otherwise skip the scroll entirely.

No other files need to change.