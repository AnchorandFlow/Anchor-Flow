# RF-1: Move SW banner + controllerchange to App root

**Status:** BANKED — not yet implemented. Workaround shipped (pointerEvents:"auto" on banner containers).

## Problem

The SW update banner (`staleBanner`) and the `controllerchange` reload listener both
live inside `HomeFlow`. `HomeFlow` is rendered inside a `FlowWrapper` wrapper div that
applies `pointer-events:none` when `showAnchor=true` (AnchorVault screens). Even with
the workaround (`pointerEvents:"auto"` on the banner container), the concerns do not
belong inside a leaf component — they are app-lifecycle concerns.

## What belongs at App root

- `staleBanner` useState  
- `navigator.serviceWorker.register('/sw.js')` call that drives banner detection  
- `updatefound` → statechange → `setStaleBanner(true)` listener  
- `controllerchange` listener (uses module-scope `_swReloadFired` guard)  
- `hadController` variable (must be captured before any SW change)  
- The banner JSX itself

## What stays in HomeFlow

- `swRegRef` (useRef) — used by the poll loop and visibilitychange handler to call
  `reg.update()`. These are performance/staleness checks, not lifecycle.
- `visibilitychange → swRegRef.current.update()` — keeps the SW byte-check alive
  when the tab returns from background.
- Poll-tick counter every 40 ticks → `swRegRef.current.update()`.

## Migration sketch

```js
// In App component:
const [swBanner, setSwBanner] = React.useState(false);
React.useEffect(function() {
  if (!("serviceWorker" in navigator)) return;
  var hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("/sw.js").then(function(reg) {
    if (reg.waiting) { setSwBanner(true); }
    reg.addEventListener("updatefound", function() {
      var nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", function() {
        if (nw.state === "installed" && reg.waiting) { setSwBanner(true); }
      });
    });
  }).catch(function() {});
  navigator.serviceWorker.addEventListener("controllerchange", function() {
    if (_swReloadFired) return;
    if (!hadController) return;
    _swReloadFired = true;
    window.location.reload();
  });
}, []);

// In App return, before <FlowWrapper>:
{swBanner && <SwUpdateBanner onDismiss={() => setSwBanner(false)} />}
```

`HomeFlow`'s SW effect is reduced to:
```js
navigator.serviceWorker.register("/sw.js").then(function(reg) {
  swRegRef.current = reg;
}).catch(function() {});
// visibilitychange update() handler unchanged
```

## Calling `register()` twice

Calling `navigator.serviceWorker.register("/sw.js")` from both `App` and `HomeFlow`
is safe — the browser deduplicates by URL/scope and returns the same registration.
No duplicate SW installs.

## Why not done now

The workaround (explicit `pointerEvents:"auto"`) is sufficient and safe. The structural
move is a larger diff touching `HomeFlow`'s state declarations, JSX return, and the
`App` component. It should be its own PR with a dedicated test pass.
