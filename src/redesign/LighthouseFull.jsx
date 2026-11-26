// src/redesign/LighthouseFull.jsx — redesigned Lighthouse chrome (af_redesign).
// HomeFlow's LearningTab closure keeps all of Lighthouse's state, writes and
// its five area components (Overview / Plan / Records / Growth / Library);
// they render as children here. This adds the new header, the child and
// section pill tabs, and a scoped stylesheet that gives the areas' checkboxes
// the 22px sage circle (checked = filled, the rest of the row crossed out at
// 45% opacity). Their cards are restyled in place (SectionShell / DashCard
// read lighthouseColors.js when the flag is on).
//
// Colors: each area pill has its own school color (LH_AREA_TONE), each child
// pill is in that child's person color, and the body carries the child's
// color as a thin top accent.
import { useState, useRef, useEffect } from "react";
import { font, check, color as TK_COLOR } from "../design/tokens.js";
var NAVY_INK = TK_COLOR.anchorNavy;
import { LH_AREA_TONE, kidTone } from "./lighthouseColors.js";
import { FullViewPage, FullViewHeader, PillTabs, Card, Empty, PillButton, EmojiScope } from "./FullView.jsx";

var SCOPE = "rd-lighthouse";
var TICK = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22"><path d="M6.5 11.5l3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
var CSS = [
  "." + SCOPE + "{font-family:" + font.body + ";}",
  "." + SCOPE + " input[type=checkbox]{-webkit-appearance:none;appearance:none;width:" + check.size + "px;height:" + check.size + "px;min-width:" + check.size + "px;margin:0;border-radius:50%;border:2px solid " + check.color + ";background:transparent center/100% no-repeat;cursor:pointer;flex-shrink:0;box-sizing:border-box;vertical-align:middle;}",
  "." + SCOPE + " input[type=checkbox]:checked{background-color:" + check.color + ";background-image:url(\"" + TICK + "\");}",
  "." + SCOPE + " input[type=checkbox]:focus-visible{outline:2px solid " + check.color + ";outline-offset:2px;}",
  "." + SCOPE + " input[type=checkbox]:checked ~ *{opacity:" + check.doneTextOpacity + ";text-decoration:line-through;}",
  // Sub-section strips that scroll sideways in the legacy layout wrap instead
  // (flex rows only, so wide tables keep their own scroll box).
  "." + SCOPE + " [style*=\"display: flex\"][style*=\"overflow-x: auto\"]{flex-wrap:wrap;overflow-x:visible !important;}",
  // Plain flex rows of three or more buttons (the in-area sub-tab strips,
  // e.g. Plan's Today / Week / Month / Year / Long-term) wrap too.
  "." + SCOPE + " div[style*=\"display: flex\"]:has(> button + button + button){flex-wrap:wrap;row-gap:6px;}",
].join("\n");

// "School: Homeschool ▾" — the child's school type, set right here (also in
// Settings › School). Other asks for a short label of its own.
function SchoolTypeControl(props) {
  var [open, setOpen] = useState(false);
  var [label, setLabel] = useState(props.schoolLabel || "");
  var [pick, setPick] = useState(props.schoolType);
  var ref = useRef(null);
  useEffect(function () { setPick(props.schoolType); setLabel(props.schoolLabel || ""); setOpen(false); }, [props.childId, props.schoolType, props.schoolLabel]);
  useEffect(function () {
    if (!open) return undefined;
    function away(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function esc(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", away); window.addEventListener("keydown", esc);
    return function () { document.removeEventListener("mousedown", away); window.removeEventListener("keydown", esc); };
  }, [open]);
  function choose(v) {
    setPick(v);
    if (v !== "other") { props.onChange(v, ""); setOpen(false); }
  }
  var se = props.showEmojis;
  return (
    <div ref={ref} style={{ position: "relative", alignSelf: "flex-start", maxWidth: "100%" }} data-testid="lh-school">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} data-testid="lh-school-btn" onClick={function () { setOpen(!open); }}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 40, padding: "0 14px", borderRadius: 999, border: "1.5px solid rgba(27,43,68,0.22)", background: "#FFFFFF", color: NAVY_INK, fontFamily: font.body, fontSize: 15, cursor: "pointer", maxWidth: "100%" }}>
        <span style={{ color: "#5B6472" }}>School:</span>
        <strong style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{props.label}</strong>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRight: "2px solid " + NAVY_INK, borderBottom: "2px solid " + NAVY_INK, transform: open ? "rotate(225deg)" : "rotate(45deg)", marginTop: open ? 4 : -3, flexShrink: 0 }} />
      </button>
      {open && (
        <div role="listbox" aria-label="School type" data-testid="lh-school-menu"
          style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, width: "min(320px, calc(100vw - 32px))", background: "#FFFFFF", borderRadius: 14, boxShadow: "0 12px 32px rgba(14,27,46,0.2)", padding: 6, boxSizing: "border-box" }}>
          {props.types.map(function (t) {
            var on = pick === t.value;
            return (
              <button key={t.value} type="button" role="option" aria-selected={on} data-testid={"lh-school-" + t.value} onClick={function () { choose(t.value); }}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, border: "none", background: on ? "#EEF3F6" : "transparent", color: NAVY_INK, fontFamily: font.body, cursor: "pointer" }}>
                {se && <span aria-hidden="true" style={{ fontSize: 16 }}>{t.emoji}</span>}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{t.label}</span>
                  <span style={{ display: "block", fontSize: 13, color: "#5B6472", marginTop: 1 }}>{t.desc}</span>
                </span>
                <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid " + (on ? NAVY_INK : "rgba(27,43,68,0.3)"), background: on ? NAVY_INK : "transparent", boxShadow: on ? "inset 0 0 0 3px #FFFFFF" : "none", flexShrink: 0, marginTop: 3 }} />
              </button>
            );
          })}
          {pick === "other" && (
            <form onSubmit={function (e) { e.preventDefault(); props.onChange("other", label); setOpen(false); }} style={{ display: "flex", gap: 8, padding: "6px 6px 4px" }}>
              <input autoFocus value={label} maxLength={30} onChange={function (e) { setLabel(e.target.value); }} placeholder="e.g. Online academy" aria-label="Name this school type" data-testid="lh-school-label"
                style={{ flex: 1, minWidth: 0, height: 40, padding: "0 10px", borderRadius: 10, border: "1.5px solid rgba(27,43,68,0.22)", fontSize: 16, fontFamily: font.body, color: NAVY_INK, boxSizing: "border-box" }} />
              <button type="submit" data-testid="lh-school-label-save" style={{ flexShrink: 0, border: "none", borderRadius: 10, padding: "0 14px", background: NAVY_INK, color: "#FFFFFF", fontFamily: font.body, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Save</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function LighthouseFull(props) {
  var se = props.showEmojis === true;
  if (props.empty) {
    return (
      <FullViewPage section="lighthouse" testId="redesign-lighthouse">
        <FullViewHeader title="Lighthouse" emoji="📚" showEmojis={se} subtitle="School and learning, child by child" />
        <Card>
          <Empty>{props.empty}</Empty>
          <div style={{ marginTop: 10 }}><PillButton onClick={props.onSettings}>Go to Settings</PillButton></div>
        </Card>
      </FullViewPage>
    );
  }
  var childTabs = (props.children_ || []).map(function (p) {
    return { id: p.id, label: p.name, emoji: p.mode === "homeschool" ? "🏡" : p.mode === "school" ? "🏫" : p.mode === "hybrid" ? "🤝" : p.mode === "other" ? "✏️" : null, tone: kidTone(p.color) || undefined };
  });
  var sectionTabs = (props.sections || []).map(function (t) { return Object.assign({}, t, { tone: t.tone || LH_AREA_TONE[t.id] }); });
  var kid = (props.children_ || []).filter(function (p) { return p.id === props.activeChild; })[0];
  var kidColor = kid && kid.color ? kid.color : null;
  return (
    <FullViewPage section="lighthouse" testId="redesign-lighthouse">
      <style>{CSS}</style>
      <FullViewHeader title="Lighthouse" emoji="📚" showEmojis={se} subtitle="School and learning, child by child" />
      {childTabs.length > 1 && <PillTabs label="Children" tabs={childTabs} value={props.activeChild} onChange={props.onChild} testIdPrefix="lh-child-" showEmojis={se} />}
      {props.onSchoolType && kid && <SchoolTypeControl key={kid.id} childId={kid.id} schoolType={props.schoolType} schoolLabel={props.schoolLabel} label={props.schoolTypeLabel} types={props.schoolTypes || []} onChange={props.onSchoolType} showEmojis={se} />}
      <PillTabs label="Lighthouse sections" tabs={sectionTabs} value={props.section} onChange={props.onSection} testIdPrefix="lh-tab-" showEmojis={se} />
      <div className={SCOPE} data-testid="lh-body" data-kid-color={kidColor || undefined} style={{ minWidth: 0, fontSize: font.checklistItem.size, borderTop: kidColor ? "3px solid " + kidColor : "none", paddingTop: kidColor ? 10 : 0 }}>
        <EmojiScope showEmojis={se}>{props.children}</EmojiScope>
        {/* Rhythm (af_rhythm_v1) sits outside EmojiScope: its stickers are the
            reward and must never be stripped; it handles showEmojis itself. */}
        {props.rhythm || null}
      </div>
    </FullViewPage>
  );
}
