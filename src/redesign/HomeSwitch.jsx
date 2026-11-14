// src/redesign/HomeSwitch.jsx — picks the Home screen. Flag off: renders the
// legacy Home exactly as before (renderLegacy is called, renderRedesign never
// is, so nothing from the redesign mounts or runs). No DOM of its own.
export default function HomeSwitch(props) {
  return props.redesignOn ? props.renderRedesign() : props.renderLegacy();
}
