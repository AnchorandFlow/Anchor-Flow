// src/redesign/LighthouseFull.jsx — redesigned Lighthouse chrome (af_redesign).
// HomeFlow's LearningTab closure keeps all of Lighthouse's state, writes and
// its five area components (Overview / Plan / Records / Growth / Library);
// they render as children here. This adds the new header, the child and
// section pill tabs, and a scoped stylesheet that gives the areas' checkboxes
// the 22px sage circle (checked = filled, the rest of the row crossed out at
// 45% opacity). Their cards are restyled in place (SectionShell / DashCard
// read RD_LH_CARD when the flag is on).
import { font, check } from "../design/tokens.js";
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

export default function LighthouseFull(props) {
  var se = props.showEmojis === true;
  if (props.empty) {
    return (
      <FullViewPage testId="redesign-lighthouse">
        <FullViewHeader title="Lighthouse" emoji="📚" showEmojis={se} subtitle="School and learning, child by child" />
        <Card>
          <Empty>{props.empty}</Empty>
          <div style={{ marginTop: 10 }}><PillButton onClick={props.onSettings}>Go to Settings</PillButton></div>
        </Card>
      </FullViewPage>
    );
  }
  var childTabs = (props.children_ || []).map(function (p) {
    return { id: p.id, label: p.name, emoji: p.mode === "homeschool" ? "🏡" : p.mode === "school" ? "🏫" : null };
  });
  return (
    <FullViewPage testId="redesign-lighthouse">
      <style>{CSS}</style>
      <FullViewHeader title="Lighthouse" emoji="📚" showEmojis={se} subtitle="School and learning, child by child" />
      {childTabs.length > 1 && <PillTabs label="Children" tabs={childTabs} value={props.activeChild} onChange={props.onChild} testIdPrefix="lh-child-" showEmojis={se} />}
      <PillTabs label="Lighthouse sections" tabs={props.sections} value={props.section} onChange={props.onSection} testIdPrefix="lh-tab-" showEmojis={se} />
      <div className={SCOPE} data-testid="lh-body" style={{ minWidth: 0, fontSize: font.checklistItem.size }}>
        <EmojiScope showEmojis={se}>{props.children}</EmojiScope>
      </div>
    </FullViewPage>
  );
}
