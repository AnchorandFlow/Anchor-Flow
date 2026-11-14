// src/redesign/TidePoolFull.jsx — redesigned Tide Pool full view (af_redesign).
// Rendered by HomeFlow's TidePoolTab closure, which keeps all state and every
// write (coveData, and the tide_pool_events ledger when af_tidepool_v2 is on);
// this file is markup only.
//   - one card per kid: shells big, progress bar to the chest goal
//     (COVE_MIN_OPEN shells opens the chest); tap a card to pick that kid
//   - pill tabs: Earn (chores + bonus buttons), Treasures, History
import { useState } from "react";
import { font, radius, shadow } from "../design/tokens.js";
import { FullViewPage, FullViewHeader, PillTabs, Card, CheckRow, SectionLabel, Empty, PillButton, ProgressBar } from "./FullView.jsx";
import { inputStyle, emo, emoPrefix, NAVY, MUTED, SAGE_TEXT, HAIRLINE, wrapText } from "./fullViewKit.js";

function shells(n, se) { return n + " " + (emo(se, "🐚") || (n === 1 ? "shell" : "shells")); }
function shortDate(iso) { if (!iso) return ""; try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return ""; } }

function KidCard(props) {
  var k = props.kid, goal = props.goal, se = props.showEmojis;
  var ready = k.shells >= goal;
  var toGo = Math.max(0, goal - k.shells);
  return (
    <button type="button" data-testid={"tp-kid-" + k.kidId} aria-pressed={props.selected} onClick={props.onSelect}
      style={{ textAlign: "left", minWidth: 0, background: "#FFFFFF", border: props.selected ? "2px solid " + NAVY : "2px solid transparent", borderRadius: radius.lg, boxShadow: shadow.card, padding: "14px 16px", cursor: "pointer", fontFamily: font.body, color: NAVY, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={Object.assign({ fontSize: 14, fontWeight: 700 }, wrapText)}>{k.kidName}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span data-testid="tp-shells" style={{ fontFamily: font.heading, fontSize: 52, fontWeight: 700, lineHeight: 0.9 }}>{k.shells}</span>
        <span style={{ fontSize: 13, color: MUTED }}>{emoPrefix(se, "🐚") + (k.shells === 1 ? "shell" : "shells")}</span>
      </div>
      <ProgressBar value={Math.min(k.shells, goal)} max={goal} label={k.kidName + " progress to the chest"} />
      <div style={{ fontSize: 12.5, color: ready ? SAGE_TEXT : MUTED, fontWeight: ready ? 700 : 500 }}>
        {ready ? "Chest ready to open" : toGo + " more to open the chest"}
      </div>
    </button>
  );
}

export default function TidePoolFull(props) {
  var se = props.showEmojis === true;
  var [tab, setTab] = useState("earn");
  var kids = props.kids || [];

  if (!kids.length) {
    return (
      <FullViewPage testId="redesign-tidepool">
        <FullViewHeader title="Tide Pool" emoji="🏝️" showEmojis={se} subtitle="Earn shells, then choose a treasure" />
        <Card><Empty>No kids added yet. Add a child in Settings › Family to start Tide Pool.</Empty></Card>
      </FullViewPage>
    );
  }

  var kid = props.kid;
  var goal = props.goal;
  var chores = kid.chores || [];
  var treasures = props.treasures || [];
  var ready = kid.shells >= goal;
  var reason = props.bonusReason || "";
  var rewards = kid.rewardHistory || [];
  var bonuses = kid.bonusHistory || [];

  function earn() {
    var doneN = chores.filter(function (c) { return c.done; }).length;
    return (
      <>
        <Card testId="tp-chores" title={"Today's chores"} right={chores.length ? <span style={{ fontSize: 12.5, color: MUTED }}>{doneN + " of " + chores.length}</span> : null}>
          {!chores.length && <Empty>No chores yet. Add some in Settings › Tide Pool.</Empty>}
          {chores.map(function (c, i) {
            return <CheckRow key={c.id} testId={"tp-chore-" + c.id} first={i === 0} done={c.done} text={c.name} onToggle={function () { props.onToggleChore(c.id); }} right={<span style={{ fontWeight: 700, color: c.done ? SAGE_TEXT : MUTED }}>{"+" + shells(c.pts || 1, se)}</span>} />;
          })}
        </Card>
        <Card testId="tp-bonus" title="Bonus Tide">
          <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 8 }}>{"Something helpful " + kid.kidName + " did, then tap how many shells."}</div>
          <input value={reason} aria-label="Bonus reason" placeholder="Helped carry the groceries…" onChange={function (e) { props.setBonusReason(e.target.value); }} style={inputStyle} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {[1, 2, 3].map(function (n) {
              return <PillButton key={n} testId={"tp-earn-" + n} variant="sage" disabled={!reason.trim()} onClick={function () { props.onBonus(n); }}>{"+" + n + " " + (emo(se, "🐚") || (n === 1 ? "shell" : "shells"))}</PillButton>;
            })}
          </div>
        </Card>
      </>
    );
  }

  function treasureList() {
    var sel = props.selectedTreasure;
    return (
      <Card testId="tp-treasures" title="Treasures" right={<span style={{ fontSize: 12.5, color: ready ? SAGE_TEXT : MUTED, fontWeight: 600 }}>{ready ? "Chest is open to claim" : "Opens at " + goal}</span>}>
        {props.claimed && (
          <div role="status" style={{ background: "#F3F7F5", borderRadius: radius.sm, padding: "10px 12px", marginBottom: 10, fontSize: 14 }}>
            <strong>{kid.kidName + " claimed " + props.claimed.name + "."}</strong>{" " + shells(kid.shells, se) + " left."}
            <div style={{ marginTop: 6 }}><PillButton small variant="ghost" onClick={props.onDismissClaim}>OK</PillButton></div>
          </div>
        )}
        {!treasures.length && <Empty>No treasures yet. Add some in Settings › Tide Pool.</Empty>}
        {treasures.map(function (t, i) {
          var can = ready && kid.shells >= t.cost;
          var isSel = sel && sel.id === t.id;
          var short = Math.max(0, t.cost - kid.shells);
          var icon = emo(se, t.icon);
          return (
            <div key={t.id} data-testid={"tp-treasure-" + t.id} style={{ borderTop: i === 0 ? "none" : "1px solid " + HAIRLINE, padding: "10px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {icon && <span aria-hidden="true" style={{ fontSize: 20 }}>{icon}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={Object.assign({ fontSize: 14, color: NAVY, fontWeight: 600 }, wrapText)}>{t.name}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{shells(t.cost, se) + (can ? "" : short > 0 ? " · " + short + " more" : " · open the chest first")}</div>
                </div>
                {can && !isSel && <PillButton small variant="secondary" onClick={function () { props.onSelectTreasure(t); }}>Choose</PillButton>}
              </div>
              {isSel && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 13, color: MUTED, flex: "1 1 140px" }}>{"Spend " + shells(t.cost, se) + "?"}</span>
                  <PillButton small testId="tp-claim" onClick={props.onClaim}>Claim treasure</PillButton>
                  <PillButton small variant="ghost" onClick={function () { props.onSelectTreasure(null); }}>Keep saving</PillButton>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    );
  }

  function history() {
    return (
      <>
        <Card title="Treasures claimed">
          {!rewards.length && <Empty>Nothing claimed yet.</Empty>}
          {rewards.map(function (h, i) {
            return <CheckRow key={h.id} first={i === 0} text={emoPrefix(se, h.icon || "🎁") + h.name} right={<span>{shells(h.cost, se) + " · " + shortDate(h.date)}</span>} />;
          })}
        </Card>
        <Card title="Bonus Tide given">
          {!bonuses.length && <Empty>No bonus shells yet.</Empty>}
          {bonuses.map(function (h, i) {
            return <CheckRow key={h.id} first={i === 0} text={h.reason} right={<span>{"+" + shells(h.pts, se) + " · " + shortDate(h.date)}</span>} />;
          })}
        </Card>
      </>
    );
  }

  return (
    <FullViewPage testId="redesign-tidepool">
      <FullViewHeader title="Tide Pool" emoji="🏝️" showEmojis={se} subtitle="Earn shells, then choose a treasure" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {kids.map(function (k, i) {
          return <KidCard key={k.kidId} kid={k} goal={goal} showEmojis={se} selected={i === props.selIdx} onSelect={function () { props.onSelectKid(i); }} />;
        })}
      </div>
      {kids.length > 1 && <SectionLabel style={{ margin: "2px 0 -6px" }}>{kid.kidName}</SectionLabel>}
      <PillTabs label="Tide Pool sections" value={tab} onChange={setTab} testIdPrefix="tp-tab-" showEmojis={se}
        tabs={[{ id: "earn", label: "Earn", emoji: "🐚" }, { id: "treasures", label: "Treasures", emoji: "💎", count: treasures.length || null }, { id: "history", label: "History", emoji: "📜" }]} />
      {tab === "earn" && earn()}
      {tab === "treasures" && treasureList()}
      {tab === "history" && history()}
      {props.footer}
    </FullViewPage>
  );
}
