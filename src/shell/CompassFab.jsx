// src/shell/CompassFab.jsx
// The floating 🧭 from the mockup: gold breathing button, bottom-right,
// opens an "Ask Compass" panel powered by askFamily().
//
// Usage in App.jsx: mount once near the root of HomeFlow's return:
//   <CompassFab/>
// Self-contained — reads household state itself, no props required, EXCEPT the
// optional Plus gate: pass gated={true} + onGated={fn} to intercept opening the
// chat panel with a paywall callback instead. Both default to inert (never gates)
// so existing callers with no props behave exactly as before.

import { useState, useRef, useEffect } from "react";
import { askFamily } from "../compass/compassEngine";
import { readHouseholdState, TK } from "./shellKit";

// Lightweight markdown for chat bubbles — the model sometimes answers with
// **bold**/## headers despite the system prompt asking it not to. No
// markdown library needed, and no dangerouslySetInnerHTML on model output:
// headers are stripped to plain text, **bold** becomes real <strong> nodes
// via string splitting, so React still owns every node it renders.
function renderCompassText(text) {
  var stripped = String(text || "").replace(/^#{1,6}\s+/gm, "");
  var parts = stripped.split(/(\*\*[^*]+\*\*)/g);
  return parts.map(function (part, i) {
    var m = part.match(/^\*\*([^*]+)\*\*$/);
    return m ? <strong key={i}>{m[1]}</strong> : part;
  });
}

export default function CompassFab(props) {
  const gated = props && props.gated;
  const onGated = props && props.onGated;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thread, setThread] = useState([]); // {q, a, details} | {q, error}
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const [hhOff] = useState(function () { return readHouseholdState().compassEnabled === false; });

  useEffect(function () {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [thread, busy]);

  function toggle() {
    if (!open && gated) { onGated && onGated(); return; }
    setOpen(!open);
  }

  function send() {
    var q = input.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    // Phase 3 Item 4 — last 6 Q&A pairs as multi-turn history, so follow-ups
    // like "What about Saturday?" resolve against the prior exchange. Only
    // successful past turns count (an error turn has no real assistant
    // reply to replay back as history).
    var history = [];
    thread.filter(function (t) { return !t.error; }).slice(-6).forEach(function (t) {
      history.push({ role: "user", content: t.q });
      history.push({ role: "assistant", content: JSON.stringify({ answer: t.a, details: t.details || [], not_found: false }) });
    });
    askFamily(readHouseholdState(), q, history)
      .then(function (r) {
        setThread(function (p) { return p.concat([{ q: q, a: r.answer, details: r.details || [] }]); });
        setBusy(false);
      })
      .catch(function (e) {
        setThread(function (p) { return p.concat([{ q: q, error: e.message || "Compass couldn't think just now." }]); });
        setBusy(false);
      });
  }

  function onKey(e) { if (e.key === "Enter") send(); }

  if (hhOff) return null;

  var suggestions = ["What needs attention this week?", "What's for dinner this week?", "What's coming up this weekend?"];

  function suggestionTap(s) { setInput(s); }

  return (
    <div style={{ fontFamily: TK.sans }}>
      <style>{"@keyframes afBreathe{0%,100%{box-shadow:0 4px 16px rgba(200,169,122,.22)}50%{box-shadow:0 4px 24px rgba(200,169,122,.4)}}@keyframes afPulse{0%,100%{opacity:1}50%{opacity:.35}}@keyframes afRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}"}</style>

      {/* FAB */}
      {!open && (
        <div>
          <div style={{ position: "fixed", bottom: 25, right: 68, fontSize: ".59rem", color: "rgba(44,62,80,.5)", fontFamily: TK.serif, fontStyle: "italic", whiteSpace: "nowrap", zIndex: 100 }}>Ask Compass</div>
          <div onClick={toggle} style={{ position: "fixed", bottom: 18, right: 18, width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg," + TK.gold + ",#b08840)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", cursor: "pointer", animation: "afBreathe 3s ease-in-out infinite", zIndex: 100 }}>
            🧭
          </div>
        </div>
      )}

      {/* Panel */}
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(14,27,46,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={toggle}>
          <div onClick={function (e) { e.stopPropagation(); }} style={{ width: "100%", maxWidth: 540, maxHeight: "82vh", background: TK.navy, borderRadius: "1.2rem 1.2rem 0 0", border: "1px solid " + TK.border, borderBottom: "none", display: "flex", flexDirection: "column", animation: "afRise .22s ease", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid " + TK.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.05rem" }}>🧭</span>
                <div>
                  <div style={{ fontFamily: TK.serif, fontSize: "1.1rem", color: TK.cream }}>Compass</div>
                  <div style={{ fontSize: ".6rem", color: TK.t3 }}>Answers from your family's data</div>
                </div>
              </div>
              <div onClick={toggle} style={{ color: TK.t3, cursor: "pointer", fontSize: "1rem", padding: 6 }}>✕</div>
            </div>

            {/* Thread */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {thread.length === 0 && !busy && (
                <div>
                  <div style={{ fontFamily: TK.serif, fontStyle: "italic", color: TK.t2, fontSize: ".95rem", lineHeight: 1.55, marginBottom: 14 }}>
                    Ask me anything about your family's week — I'll answer from your real calendar, tasks, and meals.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {suggestions.map(function (s) {
                      return (
                        <div key={s} onClick={function () { suggestionTap(s); }} style={{ padding: "9px 13px", background: TK.card, border: "1px solid " + TK.border, borderRadius: 10, fontSize: ".74rem", color: TK.t2, cursor: "pointer" }}>
                          {s}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {thread.map(function (m, i) {
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "rgba(200,169,122,.12)", border: "1px solid rgba(200,169,122,.2)", borderRadius: "12px 12px 3px 12px", padding: "9px 13px", fontSize: ".8rem", color: TK.cream, lineHeight: 1.45 }}>
                      {m.q}
                    </div>
                    {m.error ? (
                      <div style={{ alignSelf: "flex-start", maxWidth: "85%", background: "rgba(200,122,138,.07)", border: "1px solid rgba(200,122,138,.2)", borderRadius: "12px 12px 12px 3px", padding: "9px 13px", fontSize: ".78rem", color: TK.t2, lineHeight: 1.5 }}>
                        {m.error}
                      </div>
                    ) : (
                      <div style={{ alignSelf: "flex-start", maxWidth: "90%", background: TK.card, border: "1px solid " + TK.border, borderRadius: "12px 12px 12px 3px", padding: "11px 14px" }}>
                        <div style={{ fontFamily: TK.serif, fontSize: ".95rem", color: TK.cream, lineHeight: 1.5 }}>{renderCompassText(m.a)}</div>
                        {Array.isArray(m.details) && m.details.length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                            {m.details.map(function (d, j) {
                              return (
                                <div key={j} style={{ display: "flex", gap: 8, fontSize: ".73rem", color: TK.t2, lineHeight: 1.45 }}>
                                  <span style={{ color: TK.gold }}>·</span>{renderCompassText(d)}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {busy && (
                <div style={{ alignSelf: "flex-start", display: "flex", gap: 5, padding: "11px 14px", background: TK.card, border: "1px solid " + TK.border, borderRadius: "12px 12px 12px 3px" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: TK.gold, animation: "afPulse 1.2s 0s infinite" }} />
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: TK.gold, animation: "afPulse 1.2s .2s infinite" }} />
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: TK.gold, animation: "afPulse 1.2s .4s infinite" }} />
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{ display: "flex", gap: 9, padding: "13px 16px", borderTop: "1px solid " + TK.border }}>
              <input
                value={input}
                onChange={function (e) { setInput(e.target.value); }}
                onKeyDown={onKey}
                placeholder="Ask about your week…"
                style={{ flex: 1, background: TK.card, border: "1px solid " + TK.border, borderRadius: 10, padding: "10px 13px", color: TK.cream, fontSize: ".82rem", fontFamily: TK.sans, outline: "none" }}
              />
              <button onClick={send} disabled={busy} style={{ background: "linear-gradient(135deg," + TK.gold + ",#b08840)", border: "none", borderRadius: 10, padding: "0 16px", color: TK.navy, fontWeight: 600, fontSize: ".78rem", fontFamily: TK.sans, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                Ask
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
