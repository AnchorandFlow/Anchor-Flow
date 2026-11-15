// src/redesign/TidePoolFull.jsx — redesigned Tide Pool full view (af_redesign).
// Rendered by HomeFlow's TidePoolTab closure, which keeps all state and every
// write (coveData, and the tide_pool_events ledger when af_tidepool_v2 is on);
// this file is markup only.
//
// The original Tide Pool layout, in the new colors and fonts. It opens
// straight onto the shells; there are no sub-tabs to tap through:
//   - kid pills (when there is more than one kid)
//   - shell count and the treasure chest drawing (tap it once it's ready)
//   - the shell grid: one circle per shell, tap an earned shell to see where
//     it came from; the progress bar to the chest sits under it
//   - the open chest: treasure grid, choose, then claim
//   - today's chores, Bonus Tide, and the history lists
import { font, radius, shadow, toneFor } from "../design/tokens.js";
import { FullViewPage, FullViewHeader, PillTabs, Card, CheckRow, Empty, PillButton, ProgressBar } from "./FullView.jsx";
import { inputStyle, emo, emoPrefix, NAVY, MUTED, SAGE_TEXT, wrapText } from "./fullViewKit.js";

var TONE = toneFor("tidepool"); // sand
// Chest, in the sand family instead of the old brown wood.
var WOOD = "#9A7A52", WOOD_DARK = "#7A5C38", LID = "#B08E62", EDGE = "#5E4526", BAND = "#EFE1C9", LOCK = "#C8A253";
var SHELL_FILL = "#FBF3E4";

function shells(n, se) { return n + " " + (emo(se, "🐚") || (n === 1 ? "shell" : "shells")); }
function shortDate(iso) { if (!iso) return ""; try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return ""; } }

// A small scallop shell, drawn (not an emoji) so the grid reads the same with
// showEmojis off.
function ShellGlyph(props) {
  var s = props.size || 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 C6 3 2.5 8 3 13 L12 21 L21 13 C21.5 8 18 3 12 3 Z" fill={LID} stroke={EDGE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12 21 L12 4 M12 21 L7.5 5.2 M12 21 L16.5 5.2 M12 21 L4.3 9 M12 21 L19.7 9" stroke={EDGE} strokeWidth="1" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function Chest(props) {
  var open = props.open;
  return (
    <svg width="150" height="120" viewBox="0 0 160 128" role="img" aria-label={open ? "Open treasure chest" : "Treasure chest"}>
      <rect x="10" y="58" width="140" height="60" rx="8" fill={WOOD} stroke={EDGE} strokeWidth="1.5" />
      <rect x="10" y="58" width="140" height="14" fill={WOOD_DARK} />
      {[66, 73, 80, 87, 94].map(function (y) { return <rect key={y} x="22" y={y} width="116" height="3" rx="1.5" fill={BAND} opacity="0.55" />; })}
      <rect x="10" y={open ? 6 : 24} width="140" height="38" rx="8" fill={LID} stroke={EDGE} strokeWidth="1.5"
        style={{ transition: "y 0.3s ease" }} transform={open ? "rotate(-20,80,62)" : undefined} />
      <rect x="10" y="54" width="140" height="8" fill={WOOD} />
      {!open && [30, 37, 44].map(function (y) { return <rect key={y} x="22" y={y} width="116" height="3" rx="1.5" fill={BAND} opacity="0.5" />; })}
      {!open && (
        <>
          <rect x="67" y="46" width="26" height="20" rx="4" fill={LOCK} stroke={EDGE} strokeWidth="1" />
          <path d="M73 46 Q73 36 80 36 Q87 36 87 46" fill="none" stroke={LOCK} strokeWidth="3" strokeLinecap="round" />
          <circle cx="80" cy="57" r="3.5" fill={EDGE} />
        </>
      )}
    </svg>
  );
}

export default function TidePoolFull(props) {
  var se = props.showEmojis === true;
  var kids = props.kids || [];

  if (!kids.length) {
    return (
      <FullViewPage section="tidepool" testId="redesign-tidepool">
        <FullViewHeader title="Tide Pool" emoji="🏝️" showEmojis={se} subtitle="Earn shells, open the chest, choose a treasure" />
        <Card><Empty>No kids added yet. Add a child in Settings › Family to start Tide Pool.</Empty></Card>
      </FullViewPage>
    );
  }

  var kid = props.kid;
  var goal = props.goal;
  var count = kid.shells || 0;
  var chores = kid.chores || [];
  var treasures = props.treasures || [];
  var ready = count >= goal;
  var open = !!props.chestOpen;
  var toGo = Math.max(0, goal - count);
  var reason = props.bonusReason || "";
  var rewards = kid.rewardHistory || [];
  var bonuses = kid.bonusHistory || [];
  // Same slot rule as the original: fill to the next multiple of the goal,
  // and always show at least five empty spots ahead.
  var nextThreshold = Math.ceil((count + 1) / goal) * goal;
  var slots = Math.max(nextThreshold, count + 5);
  var tapped = props.tappedShellIdx == null ? null : props.tappedShellIdx;
  function sourceText(i) {
    var src = props.shellSource ? props.shellSource(i) : null;
    return src ? src.reason + (src.date ? " · " + shortDate(src.date) : "") : "Earned before history tracking";
  }
  var canOpen = ready && !open && typeof props.onOpenChest === "function";

  function chestPanel() {
    var sel = props.selectedTreasure;
    if (props.claimed) {
      return (
        <Card testId="tp-chest-panel" style={{ textAlign: "center" }}>
          <div role="status">
            {emo(se, props.claimed.icon) && <div aria-hidden="true" style={{ fontSize: 36, marginBottom: 4 }}>{props.claimed.icon}</div>}
            <div style={Object.assign({ fontFamily: font.heading, fontSize: 22, fontWeight: 700, color: TONE.ink }, wrapText)}>{kid.kidName + " claimed " + props.claimed.name + "!"}</div>
            <div style={{ fontSize: 13, color: MUTED, margin: "4px 0 10px" }}>{count > 0 ? shells(count, se) + " saved." : "Time to fill the beach again."}</div>
            <PillButton small variant="secondary" onClick={props.onCloseChest || props.onDismissClaim}>Close chest</PillButton>
          </div>
        </Card>
      );
    }
    return (
      <Card testId="tp-chest-panel" title="The chest is open"
        right={props.onCloseChest ? <PillButton small variant="ghost" ariaLabel="Close chest" onClick={props.onCloseChest}>Close</PillButton> : null}>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>{sel ? "Nice choice. Claim it to spend the shells." : "Pick a treasure, or close it and keep saving for something bigger."}</div>
        {!treasures.length && <Empty>No treasures yet. Add some in Settings › Tide Pool.</Empty>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 8 }}>
          {treasures.map(function (t) {
            var can = count >= t.cost;
            var isSel = sel && sel.id === t.id;
            var icon = emo(se, t.icon);
            return (
              <button key={t.id} type="button" data-testid={"tp-treasure-" + t.id} aria-pressed={!!isSel} disabled={!can}
                onClick={function () { props.onSelectTreasure(isSel ? null : t); }}
                style={{ minWidth: 0, background: "#FFFFFF", border: isSel ? "2px solid " + NAVY : "2px solid transparent", borderRadius: radius.md, boxShadow: shadow.card, padding: "10px 8px", textAlign: "center", cursor: can ? "pointer" : "default", opacity: can ? 1 : 0.5, fontFamily: font.body, color: NAVY }}>
                {icon && <div aria-hidden="true" style={{ fontSize: 24, marginBottom: 2 }}>{icon}</div>}
                <div style={Object.assign({ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }, wrapText)}>{t.name}</div>
                <div style={{ fontSize: 12, color: can ? SAGE_TEXT : MUTED, marginTop: 2 }}>{shells(t.cost, se) + (can ? "" : " · " + (t.cost - count) + " more")}</div>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
          <PillButton small variant="secondary" onClick={props.onCloseChest || function () { props.onSelectTreasure(null); }}>Keep saving</PillButton>
          <PillButton small testId="tp-claim" disabled={!sel} onClick={props.onClaim}>Claim treasure</PillButton>
        </div>
      </Card>
    );
  }

  return (
    <FullViewPage section="tidepool" testId="redesign-tidepool">
      <FullViewHeader title="Tide Pool" emoji="🏝️" showEmojis={se} subtitle="Earn shells, open the chest, choose a treasure" />
      {kids.length > 1 && (
        <PillTabs label="Kids" value={kids[props.selIdx] ? kids[props.selIdx].kidId : null} testIdPrefix="tp-kidpill-" showEmojis={se}
          onChange={function (id) { var i = kids.map(function (k) { return k.kidId; }).indexOf(id); if (i !== -1) props.onSelectKid(i); }}
          tabs={kids.map(function (k) { return { id: k.kidId, label: k.kidName, count: k.shells || 0 }; })} />
      )}

      <Card testId={"tp-kid-" + kid.kidId}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8 }}>
            <span data-testid="tp-shells" style={{ fontFamily: font.heading, fontSize: 48, fontWeight: 700, lineHeight: 0.95, color: TONE.ink }}>{count}</span>
            <span style={{ fontSize: 14, color: MUTED }}>{emoPrefix(se, "🐚") + (count === 1 ? "shell" : "shells")}</span>
          </div>
          <div data-testid="tp-chest" role={canOpen ? "button" : undefined} tabIndex={canOpen ? 0 : undefined}
            aria-label={canOpen ? "Open the chest" : undefined}
            onClick={canOpen ? props.onOpenChest : undefined}
            onKeyDown={canOpen ? function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onOpenChest(); } } : undefined}
            style={{ display: "inline-block", marginTop: 4, cursor: canOpen ? "pointer" : "default", userSelect: "none" }}>
            <Chest open={open} />
          </div>
          <div style={{ fontSize: 13, minHeight: 18, fontWeight: canOpen ? 700 : 500, color: canOpen ? SAGE_TEXT : MUTED }}>
            {open ? "" : ready ? "Tap the chest to open it" : toGo + " more shell" + (toGo === 1 ? "" : "s") + " to open"}
          </div>
        </div>

        <div data-testid="tp-shell-grid" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, maxWidth: 460, margin: "12px auto 0" }}>
          {Array.from({ length: slots }).map(function (_, i) {
            var earned = i < count;
            var on = earned && tapped === i;
            var common = { width: 32, height: 32, boxSizing: "border-box", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 };
            if (!earned) return <span key={i} data-testid="tp-slot" data-earned="false" aria-hidden="true" style={Object.assign({}, common, { border: "1.5px dashed " + TONE.full, opacity: 0.45 })} />;
            return (
              <button key={i} type="button" data-testid="tp-slot" data-earned="true" title={sourceText(i)} aria-label={"Shell " + (i + 1) + ": " + sourceText(i)} aria-pressed={on}
                onClick={function () { if (props.onTapShell) props.onTapShell(i); }}
                style={Object.assign({}, common, { border: "1.5px solid " + TONE.full, background: on ? "#FFFFFF" : SHELL_FILL, boxShadow: on ? "0 0 0 2px " + TONE.full : "none", cursor: "pointer" })}>
                <ShellGlyph />
              </button>
            );
          })}
        </div>
        {tapped !== null && tapped < count && (
          <button type="button" data-testid="tp-shell-source" onClick={function () { if (props.onTapShell) props.onTapShell(tapped); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "10px auto 0", maxWidth: 320, background: "#FFFFFF", border: "none", borderRadius: radius.sm, boxShadow: shadow.card, padding: "7px 12px", fontFamily: font.body, fontSize: 13, fontWeight: 600, color: TONE.ink, cursor: "pointer" }}>
            <span style={wrapText}>{sourceText(tapped)}</span>
            <span aria-hidden="true" style={{ color: MUTED, fontWeight: 400 }}>✕</span>
          </button>
        )}

        <div style={{ marginTop: 12 }}>
          <ProgressBar value={Math.min(count, goal)} max={goal} color={TONE.full} label={kid.kidName + " progress to the chest"} />
          <div style={{ fontSize: 12.5, color: ready ? SAGE_TEXT : MUTED, fontWeight: ready ? 700 : 500, marginTop: 5, textAlign: "center" }}>
            {ready ? "Chest ready to open" : toGo + " more to open the chest"}
          </div>
        </div>
      </Card>

      {open && chestPanel()}

      <Card testId="tp-chores" title={"Today's chores"} right={chores.length ? <span style={{ fontSize: 12.5, color: MUTED }}>{chores.filter(function (c) { return c.done; }).length + " of " + chores.length}</span> : null}>
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

      {rewards.length > 0 && (
        <Card testId="tp-rewards" title="Treasures claimed">
          {rewards.map(function (h, i) {
            return <CheckRow key={h.id} first={i === 0} text={emoPrefix(se, h.icon || "🎁") + h.name} right={<span>{shells(h.cost, se) + " · " + shortDate(h.date)}</span>} />;
          })}
        </Card>
      )}
      {bonuses.length > 0 && (
        <Card testId="tp-bonuses" title="Bonus Tide given">
          {bonuses.map(function (h, i) {
            return <CheckRow key={h.id} first={i === 0} text={h.reason} right={<span>{"+" + shells(h.pts, se) + " · " + shortDate(h.date)}</span>} />;
          })}
        </Card>
      )}
      {props.footer}
    </FullViewPage>
  );
}
