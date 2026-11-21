// src/redesign/EventSheet.jsx — Add/Edit Event sheet (af_redesign).
//
// Fixed header (Playfair title, close) and a sticky footer (Cancel + Save)
// with the form scrolling between them, so Save is always on screen. Phone:
// a bottom sheet within the screen height, Save full width. Desktop: a
// centered dialog.
//
// Up front: Title, Date, Time, Who (For: multi-select person chips +
// Everyone; Responsible: single or none), Repeat (with weekday chips for
// weekly / every 2 weeks, and Ends). "More options" (open/closed remembered on
// this device) holds Note, Category, Reminder and Color.
//
// People come from Settings (every member, adults and kids) in their Settings
// colors. Color defaults to the For person's color ("Auto", stored as
// colorFrom:"person" so it follows later Settings changes); the palette is the
// app's blue/sage/sand/teal/gold plus person colors; any other hex sits behind
// "Custom".
//
// Pure UI: HomeFlow's CalEventFormModal does every write (onSave/onDelete).
import { useEffect, useMemo, useRef, useState } from "react";
import { font, color as COLOR } from "../design/tokens.js";
import { REPEAT_OPTIONS, EVENT_PALETTE, FAMILY_COLOR, forIdsOf, forFields, colorForIds, categoryOf, isRepeating, ymd } from "../lib/calEvents.js";

var NAVY = COLOR.anchorNavy;
var MUTED = "#5B6472";
var LINE = "rgba(27,43,68,0.14)";
var SOFT = "#F5F1EA";
var GOLD = "#B08840";
var WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
var WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var MORE_KEY = "af_eventSheetMore";

function lum(hex) {
  var h = String(hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return 0.3;
  var n = parseInt(h, 16);
  var c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
// Text on a filled chip: white on darker colors, navy on light ones.
function onColor(hex) { return lum(hex) > 0.36 ? NAVY : "#FFFFFF"; }
function validHex(h) { return /^#[0-9a-f]{6}$/i.test(String(h || "")); }
function dateOf(iso) { var p = String(iso || "").split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
function readMore() { try { return localStorage.getItem(MORE_KEY) === "1"; } catch { return false; } }
function writeMore(v) { try { localStorage.setItem(MORE_KEY, v ? "1" : "0"); } catch { /* storage blocked */ } }

var CSS = [
  ".af-es-back{position:fixed;inset:0;z-index:1000;background:rgba(14,27,46,.45)}",
  ".af-es{position:fixed;z-index:1001;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 32px));max-height:88vh;max-height:min(88dvh,860px);display:flex;flex-direction:column;background:#FFFFFF;border-radius:20px;box-shadow:0 24px 70px rgba(14,27,46,.3);color:" + NAVY + ";box-sizing:border-box;overflow:hidden}",
  "@media (max-width:600px){.af-es{left:0;right:0;bottom:0;top:auto;transform:none;width:100%;max-height:calc(100vh - 12px);max-height:calc(100dvh - env(safe-area-inset-top,0px) - 12px);border-radius:20px 20px 0 0}}",
  ".af-es-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px 12px;border-bottom:1px solid " + LINE + ";flex-shrink:0}",
  ".af-es-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:14px 18px 18px;display:flex;flex-direction:column;gap:16px}",
  ".af-es-foot{flex-shrink:0;display:flex;gap:10px;justify-content:flex-end;align-items:center;padding:12px 18px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid " + LINE + ";background:#FFFFFF}",
  "@media (max-width:600px){.af-es-foot{flex-direction:column-reverse;align-items:stretch;gap:6px}.af-es-foot .af-es-save{width:100%}}",
  ".af-es-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}",
  ".af-es-in{display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box;height:46px;padding:0 12px;border:1.5px solid " + LINE + ";border-radius:12px;background:#FFFFFF;color:" + NAVY + ";font-size:16px;font-family:inherit;outline:none;-webkit-appearance:none;appearance:none}",
  ".af-es-in::-webkit-date-and-time-value{text-align:left}",
  "textarea.af-es-in{height:auto;min-height:76px;padding:10px 12px;resize:vertical}",
  ".af-es-in:focus-visible{border-color:" + GOLD + ";box-shadow:0 0 0 3px rgba(200,162,83,.25)}",
  ".af-es button:focus-visible{outline:3px solid #C8A253;outline-offset:2px}",
  ".af-es-chips{display:flex;flex-wrap:wrap;gap:8px}",
  ".af-es-chip{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 14px;border-radius:999px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap;max-width:100%;box-sizing:border-box}",
  ".af-es-label{font-size:14px;font-weight:700;color:" + NAVY + ";margin:0 0 7px;display:block}",
  ".af-es-hint{font-size:13px;color:" + MUTED + ";margin-top:6px}",
].join("");

function Chip(props) {
  var on = !!props.on;
  var c = props.color || NAVY;
  var style = on
    ? { background: c, color: onColor(c), border: "1.5px solid " + c }
    : { background: props.color ? c + "1A" : "#FFFFFF", color: NAVY, border: "1.5px solid " + (props.color ? c + "66" : LINE) };
  return (
    <button type="button" className="af-es-chip" aria-pressed={on} data-testid={props.testId} onClick={props.onClick} title={props.title}
      style={Object.assign(style, props.style || {})}>
      {props.dot && <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: on ? onColor(c) : c, flexShrink: 0 }} />}
      {props.children}
    </button>
  );
}

function Field(props) {
  return (
    <div style={{ minWidth: 0 }}>
      <label className="af-es-label" htmlFor={props.htmlFor} id={props.labelId}>{props.label}</label>
      {props.children}
    </div>
  );
}

// props: mode "add"|"edit", init (event), occurrenceIso (the tapped date of a
// repeating event), initialAsk ("delete" opens on the This/All choice), people, personColor(id), categories [{id,label,emoji}],
// onAddCategory(label) -> category | null, colorLabels {hex: label},
// schoolTypes [{id,label,color}], showEmojis, today (Date),
// onSave(fields, scope "all"|"this"), onDelete(scope), onCancel()
export default function EventSheet(props) {
  var init = props.init || {};
  var people = (props.people || []).filter(function (p) { return p && p.id && p.name; });
  var todayIso = ymd(props.today || new Date());
  function pc(id) { return (props.personColor && props.personColor(id)) || "#6A9BB5"; }

  var [f, setF] = useState(function () {
    var add = props.mode !== "edit";
    return {
      title: init.title || "",
      date: init.date || todayIso,
      time: init.time || "",
      note: init.note || "",
      forIds: forIdsOf(init, people),
      responsible: init.responsibleParent || null,
      repeat: init.repeat || "",
      repeatDays: Array.isArray(init.repeatDays) && init.repeatDays.length ? init.repeatDays.slice() : null,
      repeatDates: Array.isArray(init.repeatDates) ? init.repeatDates.slice() : [],
      endType: (init.repeatEnd && init.repeatEnd.type) || "never",
      endDate: (init.repeatEnd && init.repeatEnd.date) || "",
      endCount: (init.repeatEnd && init.repeatEnd.count) || 10,
      category: categoryOf(init),
      schoolType: init.schoolType || null,
      remindDate: init.remindDate || "",
      remindTime: init.remindTime || "",
      colorFrom: add ? "person" : (init.colorFrom || "palette"),
      color: init.color || "#6A9BB5",
    };
  });
  var [more, setMore] = useState(readMore);
  var [custom, setCustom] = useState(function () { return !!init.color && init.colorFrom === "custom"; });
  var [catsOpen, setCatsOpen] = useState(false);
  var [catsOverflow, setCatsOverflow] = useState(false);
  var [newCat, setNewCat] = useState(null); // null = closed, string = typing
  var [ask, setAsk] = useState(props.initialAsk || null); // "save" | "delete" — This event / All events
  var titleRef = useRef(null);
  var catsRef = useRef(null);

  function set(k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }

  useEffect(function () {
    var prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e) { if (e.key === "Escape") { e.preventDefault(); props.onCancel(); } }
    window.addEventListener("keydown", onKey);
    var t = setTimeout(function () { if (props.mode !== "edit" && titleRef.current) titleRef.current.focus(); }, 40);
    return function () { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // "More" for categories only when two rows aren't enough.
  useEffect(function () {
    var el = catsRef.current;
    if (!el) return;
    setCatsOverflow(el.scrollHeight > el.clientHeight + 2);
  }, [more, catsOpen, props.categories, props.showEmojis]);

  var autoColor = colorForIds(f.forIds, people, pc) || "#6A9BB5";
  var effColor = f.colorFrom === "person" ? autoColor : f.color;
  var weekday = (dateOf(f.date) || new Date()).getDay();
  var days = f.repeatDays && f.repeatDays.length ? f.repeatDays : [weekday];
  var canSave = !!f.title.trim() && !!f.date && (f.repeat !== "dates" || f.repeatDates.length > 0) && (f.endType !== "on" || !f.endDate || f.endDate >= f.date);
  var seriesEdit = props.mode === "edit" && isRepeating(init) && !!props.occurrenceIso;

  var palette = useMemo(function () {
    var out = EVENT_PALETTE.map(function (o) { return { color: o.color, label: (props.colorLabels && props.colorLabels[o.color]) || o.label }; });
    people.forEach(function (p) {
      var c = pc(p.id);
      if (c && !out.some(function (o) { return o.color.toLowerCase() === c.toLowerCase(); })) out.push({ color: c, label: String(p.name).split(/\s+/)[0] });
    });
    return out;
  }, [props.people, props.colorLabels]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleFor(id) {
    setF(function (p) {
      var ids = p.forIds.slice();
      if (id === "everyone") ids = ids.indexOf("everyone") !== -1 ? [] : ["everyone"];
      else {
        ids = ids.filter(function (x) { return x !== "everyone"; });
        ids = ids.indexOf(id) !== -1 ? ids.filter(function (x) { return x !== id; }) : ids.concat([id]);
      }
      return Object.assign({}, p, { forIds: ids });
    });
  }
  function toggleDay(n) {
    setF(function (p) {
      var cur = p.repeatDays && p.repeatDays.length ? p.repeatDays.slice() : [weekday];
      var next = cur.indexOf(n) !== -1 ? cur.filter(function (x) { return x !== n; }) : cur.concat([n]).sort();
      return Object.assign({}, p, { repeatDays: next.length ? next : cur });
    });
  }
  function toggleDate(n) {
    setF(function (p) {
      var cur = p.repeatDates.slice();
      return Object.assign({}, p, { repeatDates: cur.indexOf(n) !== -1 ? cur.filter(function (x) { return x !== n; }) : cur.concat([n]).sort(function (a, b) { return a - b; }) });
    });
  }
  function addCategory() {
    var c = props.onAddCategory ? props.onAddCategory(newCat || "") : null;
    if (c) { set("category", c.id); setCatsOpen(true); }
    setNewCat(null);
  }

  function fields() {
    var rep = f.repeat;
    var out = Object.assign({
      title: f.title.trim(), date: f.date, time: f.time, note: f.note,
      responsibleParent: f.responsible || null,
      repeat: rep,
      repeatDays: rep === "weekly" || rep === "biweekly" ? days.slice() : undefined,
      repeatDates: rep === "dates" ? f.repeatDates.slice() : [],
      repeatEnd: rep && f.endType === "on" && f.endDate ? { type: "on", date: f.endDate } : rep && f.endType === "after" ? { type: "after", count: Math.max(1, parseInt(f.endCount, 10) || 1) } : undefined,
      category: f.category || null,
      schoolType: f.category === "school" ? f.schoolType : null,
      remindDate: f.remindDate, remindTime: f.remindTime,
      color: effColor, colorFrom: f.colorFrom,
      colorLabel: f.colorFrom === "person" ? "" : ((palette.filter(function (o) { return o.color === f.color; })[0] || {}).label || "Custom"),
      colorCustom: "",
    }, forFields(f.forIds));
    return out;
  }
  function save(scope) {
    if (!canSave) return;
    if (seriesEdit && !scope) { setAsk("save"); return; }
    props.onSave(fields(), scope || "all");
  }
  function del(scope) {
    if (seriesEdit && !scope) { setAsk("delete"); return; }
    props.onDelete(scope || "all");
  }

  var cats = props.categories || [];
  var se = props.showEmojis === true;
  var moreBits = [f.note ? "Note" : null, f.category ? "Category" : null, f.remindDate ? "Reminder" : null, f.colorFrom !== "person" ? "Color" : null].filter(Boolean);
  var titleText = props.mode === "edit" ? "Edit event" : "Add event";

  return (
    <>
      <style>{CSS}</style>
      <div className="af-es-back" data-testid="event-sheet-backdrop" onClick={props.onCancel} />
      <section className="af-es" role="dialog" aria-modal="true" aria-labelledby="af-es-title" data-testid="event-sheet" data-modal-open="true" style={{ fontFamily: font.body }}>
        <header className="af-es-head">
          <h2 id="af-es-title" style={{ margin: 0, fontFamily: font.heading, fontSize: 24, fontWeight: 700, color: NAVY, lineHeight: 1.15 }}>{titleText}</h2>
          <button type="button" onClick={props.onCancel} aria-label="Close" data-testid="event-sheet-close"
            style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid " + LINE, background: "#FFFFFF", color: NAVY, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="af-es-body" data-testid="event-sheet-body">
          <Field label="Title" htmlFor="af-es-t">
            <input id="af-es-t" ref={titleRef} className="af-es-in" data-testid="es-title" value={f.title} placeholder="e.g. Dentist appointment" onChange={function (e) { set("title", e.target.value); }} />
          </Field>

          <div className="af-es-grid2">
            <Field label="Date" htmlFor="af-es-d">
              <input id="af-es-d" type="date" className="af-es-in" data-testid="es-date" value={f.date} onChange={function (e) { set("date", e.target.value); }} />
            </Field>
            <Field label="Time" htmlFor="af-es-tm">
              <input id="af-es-tm" type="time" className="af-es-in" data-testid="es-time" value={f.time} onChange={function (e) { set("time", e.target.value); }} />
            </Field>
          </div>

          <div role="group" aria-labelledby="af-es-for">
            <span className="af-es-label" id="af-es-for">For</span>
            <div className="af-es-chips" data-testid="es-for">
              <Chip on={f.forIds.indexOf("everyone") !== -1} color={FAMILY_COLOR} dot testId="es-for-everyone" onClick={function () { toggleFor("everyone"); }}>Everyone</Chip>
              {people.map(function (p) {
                return <Chip key={p.id} on={f.forIds.indexOf(p.id) !== -1} color={pc(p.id)} dot testId={"es-for-" + p.id} onClick={function () { toggleFor(p.id); }}>{p.name}</Chip>;
              })}
            </div>
          </div>

          <div role="group" aria-labelledby="af-es-resp">
            <span className="af-es-label" id="af-es-resp">Responsible</span>
            <div className="af-es-chips" data-testid="es-resp">
              <Chip on={!f.responsible} testId="es-resp-none" onClick={function () { set("responsible", null); }}>None</Chip>
              {people.map(function (p) {
                return <Chip key={p.id} on={f.responsible === p.id} color={pc(p.id)} dot testId={"es-resp-" + p.id} onClick={function () { set("responsible", f.responsible === p.id ? null : p.id); }}>{p.name}</Chip>;
              })}
            </div>
          </div>

          <div role="group" aria-labelledby="af-es-rep">
            <span className="af-es-label" id="af-es-rep">Repeat</span>
            <div className="af-es-chips" data-testid="es-repeat">
              {REPEAT_OPTIONS.map(function (o) {
                return <Chip key={o.v || "none"} on={f.repeat === o.v} testId={"es-repeat-" + (o.v || "none")} onClick={function () { set("repeat", o.v); }}>{o.label}</Chip>;
              })}
            </div>
            {(f.repeat === "weekly" || f.repeat === "biweekly") && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, maxWidth: 360 }} data-testid="es-weekdays">
                  {WEEKDAYS.map(function (l, i) {
                    var on = days.indexOf(i) !== -1;
                    return (
                      <button key={i} type="button" aria-pressed={on} aria-label={WEEKDAY_NAMES[i]} data-testid={"es-day-" + i} onClick={function () { toggleDay(i); }}
                        style={{ height: 40, minWidth: 0, borderRadius: "50%", aspectRatio: "1 / 1", maxWidth: 44, justifySelf: "center", width: "100%", border: "1.5px solid " + (on ? NAVY : LINE), background: on ? NAVY : "#FFFFFF", color: on ? "#FFFFFF" : NAVY, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", padding: 0 }}>{l}</button>
                    );
                  })}
                </div>
                <div className="af-es-hint" data-testid="es-repeat-summary">
                  {(f.repeat === "biweekly" ? "Every other " : "Every ") + days.map(function (n) { return WEEKDAY_NAMES[n]; }).join(", ").replace(/, ([^,]*)$/, " and $1")}
                </div>
              </div>
            )}
            {f.repeat === "dates" && (
              <div style={{ marginTop: 12 }}>
                <div className="af-es-hint" style={{ marginTop: 0, marginBottom: 8 }}>Which days of the month?</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 5, maxWidth: 360 }}>
                  {Array.from({ length: 31 }, function (_, i) { return i + 1; }).map(function (n) {
                    var on = f.repeatDates.indexOf(n) !== -1;
                    return <button key={n} type="button" aria-pressed={on} onClick={function () { toggleDate(n); }}
                      style={{ height: 36, minWidth: 0, borderRadius: 10, border: "1.5px solid " + (on ? NAVY : LINE), background: on ? NAVY : "#FFFFFF", color: on ? "#FFFFFF" : NAVY, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: 0 }}>{n}</button>;
                  })}
                </div>
              </div>
            )}
            {f.repeat && (
              <div style={{ marginTop: 14 }} role="group" aria-labelledby="af-es-ends">
                <span className="af-es-label" id="af-es-ends">Ends</span>
                <div className="af-es-chips" data-testid="es-ends">
                  <Chip on={f.endType === "never"} testId="es-end-never" onClick={function () { set("endType", "never"); }}>Never</Chip>
                  <Chip on={f.endType === "on"} testId="es-end-on" onClick={function () { set("endType", "on"); }}>On date</Chip>
                  <Chip on={f.endType === "after"} testId="es-end-after" onClick={function () { set("endType", "after"); }}>After</Chip>
                </div>
                {f.endType === "on" && (
                  <input type="date" aria-label="End date" className="af-es-in" data-testid="es-end-date" min={f.date} value={f.endDate} onChange={function (e) { set("endDate", e.target.value); }} style={{ marginTop: 10, maxWidth: 240 }} />
                )}
                {f.endType === "after" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                    <input type="number" inputMode="numeric" min="1" max="999" aria-label="Number of times" className="af-es-in" data-testid="es-end-count" value={f.endCount} onChange={function (e) { set("endCount", e.target.value); }} style={{ width: 96 }} />
                    <span style={{ fontSize: 15 }}>times</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <button type="button" aria-expanded={more} data-testid="es-more" onClick={function () { var v = !more; setMore(v); writeMore(v); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid " + LINE, background: SOFT, color: NAVY, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
              <span>More options{!more && moreBits.length ? <span style={{ fontWeight: 400, color: MUTED }}>{" · " + moreBits.join(", ")}</span> : null}</span>
              <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRight: "2px solid " + NAVY, borderBottom: "2px solid " + NAVY, transform: more ? "rotate(225deg)" : "rotate(45deg)", marginTop: more ? 4 : -4, flexShrink: 0 }} />
            </button>
          </div>

          {more && (
            <div data-testid="es-more-panel" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Note" htmlFor="af-es-n">
                <textarea id="af-es-n" className="af-es-in" data-testid="es-note" value={f.note} placeholder="Any details…" onChange={function (e) { set("note", e.target.value); }} />
              </Field>

              <div role="group" aria-labelledby="af-es-cat">
                <span className="af-es-label" id="af-es-cat">Category</span>
                <div ref={catsRef} className="af-es-chips" data-testid="es-cats" style={catsOpen ? null : { maxHeight: 84, overflow: "hidden" }}>
                  {cats.map(function (c) {
                    var on = f.category === c.id;
                    return <Chip key={c.id} on={on} testId={"es-cat-" + c.id} onClick={function () { set("category", on ? null : c.id); if (c.id === "school" && !on && !f.schoolType && props.schoolTypes && props.schoolTypes.length) set("schoolType", props.schoolTypes[0].id); }}>
                      {se && c.emoji ? <span aria-hidden="true">{c.emoji}</span> : null}{c.label}
                    </Chip>;
                  })}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
                  {(catsOverflow || catsOpen) && (
                    <button type="button" data-testid="es-cats-more" aria-expanded={catsOpen} onClick={function () { setCatsOpen(!catsOpen); }}
                      style={{ background: "none", border: "none", padding: "6px 2px", color: NAVY, fontFamily: "inherit", fontSize: 14, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>{catsOpen ? "Less" : "More"}</button>
                  )}
                  {newCat === null ? (
                    <button type="button" data-testid="es-cat-add" onClick={function () { setNewCat(""); }}
                      style={{ background: "none", border: "1.5px dashed " + LINE, borderRadius: 999, minHeight: 36, padding: "0 14px", color: NAVY, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Add category</button>
                  ) : (
                    <form onSubmit={function (e) { e.preventDefault(); addCategory(); }} style={{ display: "flex", gap: 8, flex: "1 1 220px", minWidth: 0 }}>
                      <input autoFocus aria-label="New category name" className="af-es-in" data-testid="es-cat-new" value={newCat} maxLength={30} placeholder="Category name" onChange={function (e) { setNewCat(e.target.value); }} style={{ height: 40 }} />
                      <button type="submit" disabled={!newCat.trim()} style={{ flexShrink: 0, border: "none", borderRadius: 10, padding: "0 14px", background: NAVY, color: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: newCat.trim() ? 1 : 0.5 }}>Add</button>
                      <button type="button" aria-label="Cancel new category" onClick={function () { setNewCat(null); }} style={{ flexShrink: 0, background: "none", border: "none", color: MUTED, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                    </form>
                  )}
                </div>
                {f.category === "school" && props.schoolTypes && (
                  <div className="af-es-chips" style={{ marginTop: 10 }} data-testid="es-school">
                    {props.schoolTypes.map(function (st) {
                      return <Chip key={st.id} on={f.schoolType === st.id} color={st.color} dot onClick={function () { set("schoolType", st.id); }}>{st.label}</Chip>;
                    })}
                  </div>
                )}
              </div>

              <div>
                <span className="af-es-label">Reminder</span>
                <div className="af-es-grid2">
                  <input type="date" aria-label="Reminder date" className="af-es-in" data-testid="es-remind-date" value={f.remindDate} onChange={function (e) { set("remindDate", e.target.value); }} />
                  <input type="time" aria-label="Reminder time" className="af-es-in" data-testid="es-remind-time" value={f.remindTime} onChange={function (e) { set("remindTime", e.target.value); }} />
                </div>
              </div>

              <div role="group" aria-labelledby="af-es-col">
                <span className="af-es-label" id="af-es-col">Color</span>
                <div className="af-es-chips" data-testid="es-colors">
                  <Chip on={f.colorFrom === "person"} color={autoColor} dot testId="es-color-auto" title="Follows the For person's color" onClick={function () { set("colorFrom", "person"); setCustom(false); }}>Auto</Chip>
                  {palette.map(function (o) {
                    var on = f.colorFrom !== "person" && String(f.color).toLowerCase() === o.color.toLowerCase();
                    return <Chip key={o.color} on={on} color={o.color} dot testId={"es-color-" + o.color.slice(1)} onClick={function () { setF(function (p) { return Object.assign({}, p, { color: o.color, colorFrom: "palette" }); }); setCustom(false); }}>{o.label}</Chip>;
                  })}
                  <Chip on={custom || (f.colorFrom !== "person" && !palette.some(function (o) { return o.color.toLowerCase() === String(f.color).toLowerCase(); }))} color={f.colorFrom === "custom" || !palette.some(function (o) { return o.color.toLowerCase() === String(f.color).toLowerCase(); }) ? f.color : null} dot={f.colorFrom === "custom"} testId="es-color-custom" onClick={function () { setCustom(true); setF(function (p) { return Object.assign({}, p, { color: effColor, colorFrom: "custom" }); }); }}>Custom</Chip>
                </div>
                {custom && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <input type="color" aria-label="Pick a color" value={validHex(f.color) ? f.color : "#6A9BB5"} onChange={function (e) { setF(function (p) { return Object.assign({}, p, { color: e.target.value, colorFrom: "custom" }); }); }}
                      style={{ width: 44, height: 40, border: "1.5px solid " + LINE, borderRadius: 10, padding: 2, background: "#FFFFFF", cursor: "pointer" }} />
                    <input aria-label="Hex color" className="af-es-in" data-testid="es-color-hex" value={f.color} placeholder="#6A9BB5" onChange={function (e) { setF(function (p) { return Object.assign({}, p, { color: e.target.value, colorFrom: "custom" }); }); }}
                      style={{ width: 130, fontFamily: "ui-monospace, Menlo, monospace", height: 40 }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {props.mode === "edit" && props.onDelete && !ask && (
            <button type="button" data-testid="es-delete" onClick={function () { del(); }}
              style={{ alignSelf: "flex-start", background: "none", border: "none", padding: "4px 0", color: "#A2544A", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Delete event</button>
          )}
        </div>

        <footer className="af-es-foot" data-testid="event-sheet-foot">
          {ask ? (
            <div role="group" aria-label={ask === "save" ? "Save changes to" : "Delete"} data-testid="es-scope" style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{ask === "save" ? "This is a repeating event. Save changes to:" : "This is a repeating event. Delete:"}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" data-testid="es-scope-this" onClick={function () { if (ask === "save") save("this"); else del("this"); }}
                  style={{ flex: "1 1 120px", minHeight: 46, borderRadius: 12, border: "1.5px solid " + NAVY, background: "#FFFFFF", color: NAVY, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>This event</button>
                <button type="button" data-testid="es-scope-all" onClick={function () { if (ask === "save") save("all"); else del("all"); }}
                  style={{ flex: "1 1 120px", minHeight: 46, borderRadius: 12, border: "none", background: ask === "delete" ? "#A2544A" : NAVY, color: "#FFFFFF", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>All events</button>
                <button type="button" onClick={function () { setAsk(null); }}
                  style={{ flex: "0 0 auto", minHeight: 46, padding: "0 12px", background: "none", border: "none", color: MUTED, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Back</button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" data-testid="es-cancel" onClick={props.onCancel}
                style={{ minHeight: 46, padding: "0 18px", borderRadius: 12, border: "1.5px solid " + LINE, background: "#FFFFFF", color: NAVY, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button type="button" className="af-es-save" data-testid="es-save" disabled={!canSave} onClick={function () { save(); }}
                style={{ minHeight: 48, padding: "0 28px", borderRadius: 12, border: "none", background: NAVY, color: "#FFFFFF", fontFamily: "inherit", fontSize: 16, fontWeight: 900, cursor: canSave ? "pointer" : "default", opacity: canSave ? 1 : 0.45 }}>
                {props.mode === "edit" ? "Save" : "Save event"}
              </button>
            </>
          )}
        </footer>
      </section>
    </>
  );
}
