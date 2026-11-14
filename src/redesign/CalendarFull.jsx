// src/redesign/CalendarFull.jsx — redesigned Calendar full view (af_redesign).
// Rendered by HomeFlow's CalendarTab closure, which keeps all state and every
// write (calEvents, work schedules, markers, reminders); this file is markup.
// Sub-sections (Month / Week / Day / Year) are pill tabs. Events keep their
// person dots in the person colors; work days are neutral striped tags with
// initials (WorkTag, shared with the Flow summary). The editors that are only
// reached from here (work-day strip, work-schedule sheet, marker picker,
// reminder form, year view) are the legacy bodies rendered with the new-look
// style helpers, passed in as nodes.
import { font, shadow, workDayTag } from "../design/tokens.js";
import { WorkTag } from "./RedesignFlow.jsx";
import { FullViewPage, FullViewHeader, PillTabs, Card, SectionLabel, Empty, PillButton, EmojiScope } from "./FullView.jsx";
import { emo, NAVY, MUTED, HAIRLINE, wrapText } from "./fullViewKit.js";
import { calendarDay, monthCells, eventPersonId, WEEKDAY_LETTERS } from "./fullViewData.js";
import { personColor } from "./flowData.js";

var VIEWS = [{ id: "month", label: "Month" }, { id: "week", label: "Week" }, { id: "day", label: "Day" }, { id: "year", label: "Year" }];
var FILTERS = [["all", "All"], ["mine", "Mine"], ["partner", "Partner’s"]];
var NO_PERSON = "rgba(27,43,68,0.28)";

function sameDay(a, b) { return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function longDate(d) { return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }); }

function Dot(props) {
  return <span data-testid="person-dot" data-color={props.color} style={{ width: props.size || 7, height: props.size || 7, borderRadius: "50%", background: props.color, flexShrink: 0, display: "inline-block" }} />;
}

function Marker(props) {
  var g = emo(props.showEmojis, props.emoji);
  if (g) return <span title={props.label} style={{ fontSize: 12, lineHeight: 1 }}>{g}</span>;
  return <span title={props.label || "Marker"} aria-label={props.label || "Marker"} style={{ width: 6, height: 6, transform: "rotate(45deg)", background: "#C8A253", display: "inline-block", flexShrink: 0 }} />;
}

function EventRow(props) {
  var e = props.event;
  return (
    <div data-testid={"cal-event-" + e.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: props.first ? "none" : "1px solid " + HAIRLINE, opacity: props.dimmed ? 0.3 : 1 }}>
      <span style={{ paddingTop: 6 }}><Dot color={props.color} size={9} /></span>
      <button type="button" onClick={function () { props.onEdit(e); }} aria-label={"Edit " + (e.title || "event")} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: font.body, color: NAVY }}>
        <div style={Object.assign({ fontSize: font.checklistItem.size, lineHeight: 1.4 }, wrapText)}>
          {e.time ? <span style={{ fontWeight: 700, marginRight: 6 }}>{e.time}</span> : null}{e.title || "Event"}
        </div>
        {(props.who || e.note || props.reminder) && (
          <div style={Object.assign({ fontSize: 12, color: MUTED, marginTop: 2 }, wrapText)}>
            {[props.who ? "for " + props.who : null, e.note || null, props.reminder ? "reminder set" : null].filter(Boolean).join(" · ")}
          </div>
        )}
      </button>
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        {props.onRemind && <button type="button" onClick={function () { props.onRemind(e.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontFamily: font.body, fontSize: 12.5, fontWeight: 600, padding: "2px 6px" }}>Remind</button>}
        <button type="button" aria-label={"Delete " + (e.title || "event")} onClick={function () { props.onDelete(e.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 17, lineHeight: 1, padding: "0 6px" }}>×</button>
      </div>
    </div>
  );
}

function WorkLine(props) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {props.work.map(function (w) {
        return (
          <button key={w.personId} type="button" onClick={props.onEdit ? function () { props.onEdit(w.personId); } : undefined}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: props.onEdit ? "pointer" : "default", fontFamily: font.body, fontSize: 12.5, color: workDayTag.text }}>
            <WorkTag initials={w.initials} title={w.onCall ? "On call" : "Working"} />
            <span>{props.label(w)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function CalendarFull(props) {
  var se = props.showEmojis === true;
  var d = props.data;
  var view = props.view;
  var today = props.today;

  function info(date) { return calendarDay(date, d); }
  function colorOf(e) { var pid = eventPersonId(e, d.people); return (pid && personColor(pid, d.people, d.isPersonMinor)) || NO_PERSON; }
  function whoOf(e) { var pid = e.forPerson ? eventPersonId({ forPerson: e.forPerson }, d.people) : null; var p = pid ? (d.people || []).filter(function (x) { return x.id === pid; })[0] : null; return p ? p.name : null; }
  function events(list) {
    return list.map(function (e, i) {
      return <EventRow key={e.id || i} first={i === 0} event={e} color={colorOf(e)} who={whoOf(e)} dimmed={props.isDimmed(e)} reminder={props.hasReminder(e.id)} onEdit={props.onEditEvent} onDelete={props.onDeleteEvent} onRemind={view === "day" ? props.onRemind : null} />;
    });
  }
  function workLabel(w, date) { return (w.workDayType ? props.workDayTypeLabel(w.workDayType) : props.workLabel(w.personId, date)); }

  function month() {
    var vd = props.viewDate;
    var cells = monthCells(vd.getFullYear(), vd.getMonth());
    return (
      <Card testId="cal-month" style={{ padding: "12px 10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 2 }}>
          {WEEKDAY_LETTERS.map(function (l, i) { return <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: MUTED, padding: "2px 0 6px" }}>{l}</div>; })}
          {cells.map(function (date, i) {
            if (!date) return <div key={"e" + i} />;
            var di = info(date);
            var isToday = sameDay(date, today);
            var isSel = sameDay(date, props.selectedDay);
            return (
              <button key={di.iso} type="button" data-testid={"cal-day-" + di.iso} aria-pressed={isSel} aria-label={longDate(date) + (di.events.length ? ", " + di.events.length + " event" + (di.events.length === 1 ? "" : "s") : "") + (di.work.length ? ", " + di.work.length + " working" : "")}
                onClick={function () { props.onSelectDay(isSel ? null : date); }}
                style={{ minWidth: 0, minHeight: 58, padding: "4px 2px", borderRadius: 10, border: "none", background: isSel ? "#F3EFE7" : "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: font.body }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: isToday ? 800 : 600, background: isToday ? NAVY : "transparent", color: isToday ? "#FFFFFF" : NAVY }}>{date.getDate()}</span>
                {(di.dots.length > 0 || di.markers.length > 0) && (
                  <span style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 2, maxWidth: "100%" }}>
                    {di.dots.slice(0, 4).map(function (c) { return <Dot key={c} color={c} size={6} />; })}
                    {di.markers.slice(0, 2).map(function (m, mi) { return <Marker key={"m" + mi} emoji={m} label={props.markerLabel(m)} showEmojis={se} />; })}
                  </span>
                )}
                {di.work.length > 0 && (
                  <span style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2, maxWidth: "100%" }}>
                    {di.work.map(function (w) { return <WorkTag key={w.personId} initials={w.initials} title={w.onCall ? "On call" : "Working"} />; })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>
    );
  }

  function selected() {
    var date = props.selectedDay;
    if (!date) return null;
    var di = info(date);
    return (
      <Card testId="cal-selected" title={longDate(date)} right={<PillButton small variant="ghost" ariaLabel="Close day" onClick={function () { props.onSelectDay(null); }}>Close</PillButton>}>
        {di.work.length > 0 && <div style={{ marginBottom: 6 }}><WorkLine work={di.work} label={function (w) { return workLabel(w, date); }} /></div>}
        {di.events.length ? events(di.events) : <Empty>Nothing planned.</Empty>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <PillButton small onClick={function () { props.onAddEvent(di.iso); }}>Add event</PillButton>
          <PillButton small variant="secondary" onClick={function () { props.onMarker(di.iso); }}>Markers</PillButton>
          <PillButton small variant="ghost" onClick={function () { props.onOpenDay(date); }}>Open day</PillButton>
        </div>
      </Card>
    );
  }

  function week() {
    return (
      <Card testId="cal-week" style={{ padding: "6px 16px" }}>
        {props.weekDates.map(function (date, i) {
          var di = info(date);
          var isToday = sameDay(date, today);
          return (
            <button key={di.iso} type="button" onClick={function () { props.onOpenDay(date); }}
              style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", border: "none", borderTop: i === 0 ? "none" : "1px solid " + HAIRLINE, background: "none", cursor: "pointer", textAlign: "left", fontFamily: font.body, color: NAVY }}>
              <div style={{ width: 40, flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? NAVY : MUTED, textTransform: "uppercase" }}>{date.toLocaleDateString("en-US", { weekday: "short" })}</div>
                <div style={{ width: 30, height: 30, margin: "2px auto 0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.heading, fontSize: 19, fontWeight: 700, background: isToday ? NAVY : "transparent", color: isToday ? "#FFFFFF" : NAVY }}>{date.getDate()}</div>
              </div>
              <div style={Object.assign({ flex: 1, display: "flex", flexDirection: "column", gap: 4, paddingTop: 2 }, wrapText)}>
                {(di.dots.length > 0 || di.work.length > 0) && (
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
                    {di.dots.map(function (c) { return <Dot key={c} color={c} size={8} />; })}
                    {di.work.map(function (w) { return <WorkTag key={w.personId} initials={w.initials} title={w.onCall ? "On call" : "Working"} />; })}
                  </div>
                )}
                {di.events.map(function (e, j) {
                  return <div key={(e.id || j) + di.iso} style={{ fontSize: font.checklistItem.size, color: NAVY, opacity: props.isDimmed(e) ? 0.3 : 1 }}>{(e.time ? e.time + " · " : "") + (e.title || "Event")}</div>;
                })}
                {!di.events.length && !di.work.length && <div style={{ fontSize: 12.5, color: MUTED }}>Open</div>}
              </div>
            </button>
          );
        })}
      </Card>
    );
  }

  function day() {
    var date = props.viewDate;
    var di = info(date);
    return (
      <>
        <Card testId="cal-day">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <SectionLabel style={{ margin: 0 }}>Working</SectionLabel>
            <PillButton small onClick={function () { props.onAddEvent(di.iso); }}>Add event</PillButton>
          </div>
          {di.work.length ? <WorkLine work={di.work} onEdit={props.onEditWorkSchedule} label={function (w) { return props.personName(w.personId) + " · " + workLabel(w, date); }} /> : <div style={{ fontSize: 13, color: MUTED }}>No one is scheduled to work.</div>}
          <div style={{ marginTop: 8 }}><PillButton small variant="secondary" onClick={props.onOpenWorkSchedules}>Work schedules</PillButton></div>
          <div style={{ marginTop: 10 }}><EmojiScope showEmojis={se}>{props.workDayStrip}</EmojiScope></div>
          <SectionLabel>Events</SectionLabel>
          {di.events.length ? events(di.events) : <Empty>No events — enjoy the open space.</Empty>}
          <EmojiScope showEmojis={se}>{props.reminderForm}</EmojiScope>
        </Card>
      </>
    );
  }

  var nav = view !== "year" && (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <button type="button" aria-label="Previous" onClick={props.onPrev} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#FFFFFF", boxShadow: shadow.card, cursor: "pointer", color: NAVY, fontSize: 16, flexShrink: 0 }}>‹</button>
      <div style={Object.assign({ fontFamily: font.heading, fontSize: 21, fontWeight: 700, textAlign: "center" }, wrapText)}>{props.navTitle}</div>
      <button type="button" aria-label="Next" onClick={props.onNext} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#FFFFFF", boxShadow: shadow.card, cursor: "pointer", color: NAVY, fontSize: 16, flexShrink: 0 }}>›</button>
    </div>
  );

  return (
    <FullViewPage testId="redesign-calendar">
      <FullViewHeader title="Calendar" emoji="📆" showEmojis={se} subtitle="All your events in one place"
        action={<PillButton testId="cal-add" onClick={function () { props.onAddEvent(""); }}>Add event</PillButton>} />
      <PillTabs label="Calendar views" tabs={VIEWS} value={view} onChange={props.onView} testIdPrefix="cal-view-" showEmojis={se} />
      {view !== "year" && (
        <div role="radiogroup" aria-label="Whose events" style={{ display: "flex", gap: 4, background: "#FFFFFF", borderRadius: 999, boxShadow: shadow.card, padding: 3, alignSelf: "flex-start", maxWidth: "100%" }}>
          {FILTERS.map(function (f) {
            var on = props.filter === f[0];
            return <button key={f[0]} type="button" role="radio" aria-checked={on} onClick={function () { props.onFilter(f[0]); }} style={{ border: "none", borderRadius: 999, padding: "5px 12px", background: on ? "#F3EFE7" : "transparent", color: NAVY, fontFamily: font.body, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer" }}>{f[1]}</button>;
          })}
        </div>
      )}
      {nav}
      {view === "month" && month()}
      {view === "month" && selected()}
      {view === "week" && week()}
      {view === "day" && day()}
      {view === "year" && <div data-testid="cal-year" style={{ minWidth: 0, overflowX: "hidden" }}><EmojiScope showEmojis={se}>{props.yearView}</EmojiScope></div>}
      <EmojiScope showEmojis={se}>{props.markerPicker}{props.workScheduleModal}</EmojiScope>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <PillButton small variant="ghost" onClick={props.onCalSync}>{props.googleConnected ? "Google Calendar · synced" : "Connect Google Calendar"}</PillButton>
      </div>
    </FullViewPage>
  );
}
