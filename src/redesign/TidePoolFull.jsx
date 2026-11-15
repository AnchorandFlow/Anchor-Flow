// src/redesign/TidePoolFull.jsx — Tide Pool under af_redesign.
//
// Tide Pool keeps its original screen: the same colors, layout, shells and
// treasure chest as with the flag off. HomeFlow's TidePoolTab closure renders
// that original title and body and passes them in as children; this file only
// supplies the surrounding page (the new page background) and the new
// "← Flow" back button. No state, no writes.
import { FullViewPage, BackToFlow } from "./FullView.jsx";

export default function TidePoolFull(props) {
  return (
    <FullViewPage section="tidepool" testId="redesign-tidepool">
      <BackToFlow />
      {/* Undo the full view's 14px / navy defaults so the original body
          renders at the app's own base size and theme text color. */}
      <div data-testid="tp-original" style={{ fontSize: "1rem", color: props.textColor || "inherit", minWidth: 0 }}>
        <div style={{ marginBottom: "1.25rem" }}>{props.title}</div>
        {props.children}
      </div>
    </FullViewPage>
  );
}
