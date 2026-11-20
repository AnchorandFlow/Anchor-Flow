// src/shell/compassText.jsx — chat-bubble text for Compass answers (shared by
// the floating Compass and the af_redesign Compass panel).
// Lightweight markdown for chat bubbles — the model sometimes answers with
// **bold**/## headers despite the system prompt asking it not to. No
// markdown library needed, and no dangerouslySetInnerHTML on model output:
// headers are stripped to plain text, **bold** becomes real <strong> nodes
// via string splitting, so React still owns every node it renders.
export function renderCompassText(text) {
  var stripped = String(text || "").replace(/^#{1,6}\s+/gm, "");
  var parts = stripped.split(/(\*\*[^*]+\*\*)/g);
  return parts.map(function (part, i) {
    var m = part.match(/^\*\*([^*]+)\*\*$/);
    return m ? <strong key={i}>{m[1]}</strong> : part;
  });
}
