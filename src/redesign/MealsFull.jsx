// src/redesign/MealsFull.jsx — redesigned Meals full view (af_redesign).
// Rendered by HomeFlow's MealsTab closure, which keeps all state and every
// write; this file is markup. Sub-sections (This Week, Next Week, Month, Prep,
// SOS, Meal Bank, Recipes — plus Tonight / Grocery while open) are pill tabs.
// This Week is built here; the other sections are the legacy bodies rendered
// with the new-look style helpers and passed in as `body`.
import { font, shadow, radius } from "../design/tokens.js";
import { FullViewPage, FullViewHeader, PillTabs, Card, CheckRow, PillButton, EmojiScope } from "./FullView.jsx";
import { emo, emoPrefix, NAVY, MUTED, HAIRLINE, SAGE_TEXT, wrapText } from "./fullViewKit.js";

var MEALS_PILLS = [
  { id: "week", label: "This Week", emoji: "📆" },
  { id: "nextweek", label: "Next Week", emoji: "🗓️" },
  { id: "month", label: "Month", emoji: "📅" },
  { id: "prep", label: "Prep", emoji: "🫙" },
  { id: "rescue", label: "SOS", emoji: "🆘" },
  { id: "bank", label: "Meal Bank", emoji: "📋" },
  { id: "recipes", label: "Recipes", emoji: "📖" },
];
var EXTRA = { tonight: { id: "tonight", label: "Tonight", emoji: "🌙" }, grocery: { id: "grocery", label: "Grocery list", emoji: "🛒" } };

function Week(props) {
  var se = props.showEmojis;
  var w = props.week;
  return (
    <>
      <Card testId="meals-week-controls">
        <div role="radiogroup" aria-label="Meals per day" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[{ v: 1, label: "Dinner only" }, { v: 2, label: "Lunch + dinner" }, { v: 3, label: "All 3 meals" }].map(function (o) {
            var on = w.mealCount === o.v;
            return <PillButton key={o.v} small variant={on ? "primary" : "secondary"} onClick={function () { w.setMealCount(o.v); }}>{o.label}</PillButton>;
          })}
        </div>
        <div style={{ marginTop: 8 }}><PillButton small variant="ghost" onClick={w.onRotate}>Rotate forward a day</PillButton></div>
      </Card>
      {w.swapDay && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#FFFFFF", borderRadius: radius.md, boxShadow: shadow.card, padding: "10px 14px", border: "1.5px dashed #C4A882" }}>
          <span style={{ flex: 1, fontSize: 14 }}>{"Swapping " + w.swapDay + " — tap another day"}</span>
          <PillButton small variant="ghost" onClick={function () { w.setSwapDay(null); }}>Cancel</PillButton>
        </div>
      )}
      {w.days.map(function (day) {
        var m = w.meals[day] || {};
        var isToday = day === w.todayName;
        var theme = w.themeFor(day);
        var bank = w.bankInfo(day);
        var isSource = w.swapDay === day;
        var isTarget = !!w.swapDay && !isSource;
        return (
          <section key={day} data-testid={"meals-day-" + day} onClick={isTarget ? function () { w.onSwapWith(day); } : undefined}
            style={{ background: "#FFFFFF", borderRadius: radius.lg, boxShadow: shadow.card, padding: "14px 16px", cursor: isTarget ? "pointer" : "default", outline: isSource ? "2px solid #C4A882" : isTarget ? "1.5px dashed #C4A882" : "none", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                <h2 style={{ margin: 0, fontFamily: font.heading, fontSize: 21, fontWeight: 700, color: NAVY }}>{day}</h2>
                {isToday && <span style={{ fontSize: 11.5, fontWeight: 700, color: SAGE_TEXT, background: "#DEEEE8", borderRadius: 999, padding: "2px 9px" }}>Today</span>}
                {theme && <span style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, background: "#F0E4D0", borderRadius: 999, padding: "2px 9px" }}>{emoPrefix(se, theme.emoji) + theme.theme}</span>}
              </div>
              {!w.swapDay && (
                <div style={{ display: "flex", gap: 2 }} onClick={function (e) { e.stopPropagation(); }}>
                  {isToday && m.dinner && <PillButton small variant="ghost" onClick={w.onTonight}>Tonight</PillButton>}
                  <PillButton small variant="ghost" testId={"meals-edit-" + day} onClick={function () { w.onEdit(day); }}>Edit</PillButton>
                  <PillButton small variant="ghost" onClick={function () { w.setSwapDay(day); }}>Swap</PillButton>
                </div>
              )}
              {isSource && <PillButton small variant="ghost" onClick={function (e) { e.stopPropagation(); w.setSwapDay(null); }}>Cancel</PillButton>}
            </div>
            <div style={{ marginTop: 6 }}>
              {w.mealsToShow.map(function (meal, i) {
                return (
                  <div key={meal} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid " + HAIRLINE, minWidth: 0 }}>
                    <span style={{ width: 70, flexShrink: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: MUTED }}>{meal}</span>
                    <span style={Object.assign({ flex: 1, fontSize: font.checklistItem.size, color: m[meal] ? NAVY : MUTED }, wrapText)}>{m[meal] || "—"}</span>
                    <span onClick={function (e) { e.stopPropagation(); }} style={{ flexShrink: 0 }}><EmojiScope showEmojis={se}>{w.renderBankPicker(day, meal)}</EmojiScope></span>
                  </div>
                );
              })}
            </div>
            {bank && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{bank}</div>}
            {m.notes && <div style={Object.assign({ fontSize: 13, color: MUTED, marginTop: 4, fontStyle: "italic" }, wrapText)}>{m.notes}</div>}
          </section>
        );
      })}
    </>
  );
}

// Prep task row (the legacy Prep body calls this for each task).
export function PrepTask(props) {
  var g = emo(props.showEmojis, props.task.emoji);
  return (
    <div style={{ background: "#FFFFFF", borderRadius: radius.md, boxShadow: shadow.card, padding: "2px 16px", marginBottom: 8 }}>
      <CheckRow first done={props.done} text={(g ? g + " " : "") + props.task.text} onToggle={props.onToggle} testId={"prep-" + props.task.id} />
    </div>
  );
}

export default function MealsFull(props) {
  var se = props.showEmojis === true;
  var tabs = MEALS_PILLS.slice();
  if (EXTRA[props.tab]) tabs.splice(1, 0, EXTRA[props.tab]);
  return (
    <FullViewPage testId="redesign-meals">
      <FullViewHeader title="Meals" emoji="🍽️" showEmojis={se} subtitle="Simple meals for full weeks"
        action={<PillButton small variant="secondary" testId="meals-weektype" onClick={props.onWeekType}>{props.weekTypeLabel}</PillButton>} />
      <PillTabs label="Meal sections" tabs={tabs} value={props.tab} onChange={props.onTab} testIdPrefix="meals-tab-" showEmojis={se} />
      {props.weekTypePicker && <EmojiScope showEmojis={se}>{props.weekTypePicker}</EmojiScope>}
      {props.tab === "week" ? <Week week={props.week} showEmojis={se} /> : <div data-testid={"meals-body-" + props.tab} style={{ minWidth: 0 }}><EmojiScope showEmojis={se}>{props.body}</EmojiScope></div>}
      <EmojiScope showEmojis={se}>{props.modals}</EmojiScope>
      {props.footer}
    </FullViewPage>
  );
}
