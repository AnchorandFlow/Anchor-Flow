// src/shell/CompassPanel.jsx — af_redesign Compass panel: slides in from the
// right (440px on desktop, dimmed backdrop; full-screen sheet on phones).
// Same backend as the old floating Compass (askFamily → /api/claude), with
// the current screen passed as context. Esc, the backdrop and the close
// button all close it; focus moves into it on open and back to the Compass
// button on close.
//
// Gating stays exactly where it was: FlowWrapper only opens this when the
// existing "Ask Compass" Plus gate allows it (otherwise the Plus modal shows).
import { useState, useRef, useEffect } from "react";
import { askFamily } from "../compass/compassEngine";
import { friendlyError } from "../lib/friendlyError.js";
import { readHouseholdState } from "./shellKit";
import { renderCompassText } from "./compassText.jsx";
import { SectionGlyph } from "./TopNav.jsx";
import { color, font } from "../design/tokens.js";
import { QUICK_PROMPTS } from "./navModel.js";

var NAVY = color.anchorNavy, IVORY = "#F2EAD8", SOFT = "rgba(242,234,216,0.72)", LINE = "rgba(242,234,216,0.14)", CARD = "rgba(255,255,255,0.07)";

var CSS = [
  "@keyframes afPanelIn{from{transform:translateX(100%)}to{transform:none}}",
  "@keyframes afFadeIn{from{opacity:0}to{opacity:1}}",
  "@keyframes afPulse2{0%,100%{opacity:1}50%{opacity:.35}}",
  ".af-cp-back{position:fixed;inset:0;z-index:1500;background:rgba(14,27,46,.5);animation:afFadeIn .2s ease}",
  ".af-cp{position:fixed;top:0;right:0;bottom:0;z-index:1501;width:440px;max-width:100vw;display:flex;flex-direction:column;background:" + NAVY + ";color:" + IVORY + ";box-shadow:-12px 0 40px rgba(14,27,46,.35);animation:afPanelIn .24s ease;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box}",
  "@media (max-width:600px){.af-cp{width:100vw}}",
  ".af-cp button:focus-visible,.af-cp input:focus-visible{outline:3px solid #C8A253;outline-offset:2px}",
  "@media (prefers-reduced-motion:reduce){.af-cp,.af-cp-back{animation:none}}",
].join("");

// props: open, screen (e.g. "Meals"), initialQuestion, onClose()
export default function CompassPanel(props) {
  var [input, setInput] = useState("");
  var [thread, setThread] = useState([]);
  var [busy, setBusy] = useState(false);
  var inputRef = useRef(null);
  var endRef = useRef(null);
  var lastQ = useRef(null);
  var off = readHouseholdState().compassEnabled === false;

  useEffect(function () {
    if (!props.open) return undefined;
    var prev = typeof document !== "undefined" ? document.activeElement : null;
    function onKey(e) { if (e.key === "Escape") { e.preventDefault(); props.onClose(); } }
    window.addEventListener("keydown", onKey);
    var t = setTimeout(function () { if (inputRef.current) inputRef.current.focus(); }, 30);
    return function () {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      try { if (prev && prev.focus) prev.focus(); } catch { /* element gone */ }
    };
  }, [props.open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(function () {
    if (props.open && props.initialQuestion && props.initialQuestion !== lastQ.current) {
      lastQ.current = props.initialQuestion;
      send(props.initialQuestion);
    }
  }, [props.open, props.initialQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(function () { if (endRef.current && endRef.current.scrollIntoView) endRef.current.scrollIntoView({ block: "end" }); }, [thread, busy]);

  function send(text) {
    var q = String(text == null ? input : text).trim();
    if (!q || busy || off) return;
    setInput("");
    setBusy(true);
    function fail(e) {
      setThread(function (p) { return p.concat([{ q: q, error: friendlyError(e, "compass") }]); });
      setBusy(false);
    }
    try {
      var history = [];
      thread.filter(function (t) { return !t.error; }).slice(-6).forEach(function (t) {
        history.push({ role: "user", content: t.q });
        history.push({ role: "assistant", content: JSON.stringify({ answer: t.a, details: t.details || [], not_found: false }) });
      });
      askFamily(readHouseholdState(), q, history, props.screen)
        .then(function (r) { setThread(function (p) { return p.concat([{ q: q, a: r.answer, details: r.details || [] }]); }); setBusy(false); })
        .catch(fail);
    } catch (e) { fail(e); }
  }

  if (!props.open) return null;
  return (
    <>
      <style>{CSS}</style>
      <div className="af-cp-back" data-testid="compass-backdrop" onClick={props.onClose} />
      <section className="af-cp" role="dialog" aria-modal="true" aria-label="Compass" data-testid="compass-panel" style={{ fontFamily: font.body }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid " + LINE }}>
          <span style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#DDBB70,#B08840)", color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><SectionGlyph id="compass" size={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: font.heading, fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>Compass</div>
            <div style={{ fontSize: 12.5, color: SOFT }}>{props.screen ? "Asking from " + props.screen : "Answers from your family's data"}</div>
          </div>
          <button type="button" onClick={props.onClose} aria-label="Close Compass" data-testid="compass-close"
            style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid " + LINE, background: "transparent", color: IVORY, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {off ? (
            <div style={{ fontFamily: font.heading, fontStyle: "italic", fontWeight: 500, fontSize: 18, lineHeight: 1.5, color: SOFT }}>Compass is resting. Turn it on in Settings any time.</div>
          ) : thread.length === 0 && !busy && (
            <div>
              <div style={{ fontFamily: font.heading, fontStyle: "italic", fontWeight: 500, fontSize: 18, lineHeight: 1.5, color: SOFT, marginBottom: 14 }}>Ask anything about your family's week. I answer from your real calendar, tasks and meals.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="compass-prompts">
                {QUICK_PROMPTS.map(function (s) {
                  return <button key={s} type="button" onClick={function () { send(s); }}
                    style={{ textAlign: "left", padding: "11px 14px", background: CARD, border: "1px solid " + LINE, borderRadius: 12, color: IVORY, fontSize: 15, fontFamily: font.body, cursor: "pointer" }}>{s}</button>;
                })}
              </div>
            </div>
          )}
          {thread.map(function (m, i) {
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "rgba(200,162,83,.18)", borderRadius: "14px 14px 4px 14px", padding: "9px 13px", fontSize: 15, lineHeight: 1.45 }}>{m.q}</div>
                {m.error ? (
                  <div style={{ alignSelf: "flex-start", maxWidth: "88%", background: CARD, border: "1px solid rgba(200,122,100,.35)", borderRadius: "14px 14px 14px 4px", padding: "9px 13px", fontSize: 15, color: SOFT, lineHeight: 1.5 }}>{m.error}</div>
                ) : (
                  <div style={{ alignSelf: "flex-start", maxWidth: "92%", background: CARD, border: "1px solid " + LINE, borderRadius: "14px 14px 14px 4px", padding: "11px 14px" }}>
                    <div style={{ fontSize: 16, lineHeight: 1.55 }}>{renderCompassText(m.a)}</div>
                    {Array.isArray(m.details) && m.details.length > 0 && (
                      <ul style={{ margin: "8px 0 0", padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 4 }}>
                        {m.details.map(function (d, j) { return <li key={j} style={{ fontSize: 15, color: SOFT, lineHeight: 1.45 }}>{renderCompassText(d)}</li>; })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {busy && (
            <div role="status" aria-label="Compass is thinking" style={{ alignSelf: "flex-start", display: "flex", gap: 5, padding: "11px 14px", background: CARD, borderRadius: "14px 14px 14px 4px" }}>
              {[0, 0.2, 0.4].map(function (d) { return <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#C8A253", animation: "afPulse2 1.2s " + d + "s infinite" }} />; })}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={function (e) { e.preventDefault(); send(); }} style={{ display: "flex", gap: 8, padding: "12px 14px", borderTop: "1px solid " + LINE }}>
          <input ref={inputRef} value={input} disabled={off} onChange={function (e) { setInput(e.target.value); }} aria-label="Ask Compass"
            placeholder="Ask Compass anything…" data-testid="compass-input"
            style={{ flex: 1, minWidth: 0, background: CARD, border: "1px solid " + LINE, borderRadius: 12, padding: "11px 13px", color: IVORY, fontSize: 16, fontFamily: font.body, outline: "none" }} />
          <button type="submit" disabled={busy || off || !input.trim()}
            style={{ flexShrink: 0, border: "none", borderRadius: 12, padding: "0 18px", background: "linear-gradient(135deg,#DDBB70,#B08840)", color: NAVY, fontWeight: 800, fontSize: 14, fontFamily: font.body, cursor: "pointer", opacity: (busy || off || !input.trim()) ? 0.55 : 1 }}>Ask</button>
        </form>
      </section>
    </>
  );
}
