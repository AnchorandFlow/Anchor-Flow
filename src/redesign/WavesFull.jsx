// src/redesign/WavesFull.jsx — redesigned Waves full view (af_redesign).
// Rendered by HomeFlow's WavesSection closure, which keeps the waves state and
// every write (af_exhale_waves + dirty-mark, resets, undo); this file is markup
// plus local UI state only. Sub-sections (Daily / Weekly / Seasonal / Custom)
// are pill tabs; each wave is a white card of checkable tasks, with an Edit
// mode for renaming, schedule, tasks and delete.
import { useState } from "react";
import { FullViewPage, FullViewHeader, PillTabs, Card, CheckRow, Empty, PillButton } from "./FullView.jsx";
import { inputStyle, MUTED, HAIRLINE } from "./fullViewKit.js";

var TYPES = [
  { id: "daily", label: "Daily", noun: "daily wave" },
  { id: "weekly", label: "Weekly", noun: "weekly wave" },
  { id: "seasonal", label: "Seasonal", noun: "seasonal wave" },
  { id: "custom", label: "Custom", noun: "custom wave" },
];

function Chips(props) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {props.options.map(function (o, i) {
        var on = props.value === props.valueOf(i);
        return <PillButton key={o} small variant={on ? "primary" : "secondary"} onClick={function () { props.onPick(props.valueOf(i)); }}>{o}</PillButton>;
      })}
    </div>
  );
}

function IntervalInput(props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <input value={props.value} inputMode="numeric" aria-label="Interval" placeholder="e.g. 2" onChange={function (e) { props.onValue(e.target.value.replace(/[^0-9]/g, "")); }} style={Object.assign({}, inputStyle, { width: 72 })} />
      <select value={props.unit} aria-label="Interval unit" onChange={function (e) { props.onUnit(e.target.value); }} style={Object.assign({}, inputStyle, { width: "auto" })}>
        <option value="days">Days</option>
        <option value="weeks">Weeks</option>
        <option value="months">Months</option>
      </select>
    </div>
  );
}

function WaveCard(props) {
  var w = props.wave, type = props.type, x = props.api;
  var tasks = w.tasks || [];
  var done = tasks.filter(function (t) { return t.done; }).length;
  var [editing, setEditing] = useState(false);
  var [newTask, setNewTask] = useState("");
  var [ivl, setIvl] = useState(w.intervalDays ? String(w.intervalDays) : "");
  var [unit, setUnit] = useState("days");
  var last = w.history && w.history.length ? w.history[w.history.length - 1] : null;
  var meta = x.scheduleLabel(type, w) + (last ? " · last done " + x.daysAgo(last.date) + " (" + last.checked + "/" + last.total + ")" : "");

  function addTask() { if (!newTask.trim()) return; x.addTask(type, w.id, newTask); setNewTask(""); }

  return (
    <Card testId={"wave-" + w.id} title={editing ? null : w.name}
      right={editing ? null : <span style={{ fontSize: 12.5, color: MUTED }}>{tasks.length ? done + " of " + tasks.length : ""}</span>}>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input defaultValue={w.name} aria-label="Wave name" onBlur={function (e) { var v = e.target.value.trim(); if (v && v !== w.name) x.rename(type, w.id, v); }} style={inputStyle} />
          {type === "weekly" && <Chips options={x.dayLabels} value={w.dayOfWeek} valueOf={function (i) { return i; }} onPick={function (v) { x.schedule(type, w.id, { dayOfWeek: v }); }} />}
          {type === "seasonal" && <Chips options={x.monthLabels} value={w.month} valueOf={function (i) { return i + 1; }} onPick={function (v) { x.schedule(type, w.id, { month: v }); }} />}
          {type === "custom" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <IntervalInput value={ivl} unit={unit} onValue={setIvl} onUnit={setUnit} />
              <PillButton small variant="secondary" onClick={function () { x.schedule(type, w.id, { intervalDays: x.toDays(ivl, unit) }); }}>Save repeat</PillButton>
            </div>
          )}
          <div style={{ fontSize: 12.5, color: MUTED }}>{x.scheduleLabel(type, w)}</div>
          {tasks.map(function (t) {
            return (
              <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={t.text} aria-label="Task" onChange={function (e) { x.updateTask(type, w.id, t.id, { text: e.target.value }); }} style={Object.assign({}, inputStyle, { flex: 1, fontSize: 14, padding: "8px 12px" })} />
                <button type="button" aria-label={"Delete " + t.text} onClick={function () { x.deleteTask(type, w.id, t.id, t.text); }} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 17, padding: 4 }}>×</button>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", borderTop: "1px solid " + HAIRLINE, paddingTop: 10 }}>
            <PillButton small variant="ghost" style={{ color: "#8F4F44" }} onClick={function () { x.remove(type, w.id); }}>Delete wave</PillButton>
            <PillButton small onClick={function () { setEditing(false); }}>Done</PillButton>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: -4, marginBottom: 4 }}>{meta}</div>
          {!tasks.length && <Empty>No tasks yet.</Empty>}
          {tasks.map(function (t, i) {
            return <CheckRow key={t.id} testId={"wave-task-" + t.id} first={i === 0} done={t.done} text={t.text} onToggle={function () { x.updateTask(type, w.id, t.id, { done: !t.done }); }} />;
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input value={newTask} aria-label={"Add a task to " + w.name} placeholder="Add a task…" onChange={function (e) { setNewTask(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") addTask(); }} style={Object.assign({}, inputStyle, { flex: 1 })} />
            <PillButton onClick={addTask}>Add</PillButton>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {done > 0 && <PillButton small variant="ghost" onClick={function () { x.reset(type, w.id); }}>Reset wave</PillButton>}
            <PillButton small variant="ghost" onClick={function () { setEditing(true); }}>Edit</PillButton>
          </div>
        </>
      )}
    </Card>
  );
}

function AddWave(props) {
  var type = props.type, x = props.api;
  var [open, setOpen] = useState(false);
  var [name, setName] = useState("");
  var [day, setDay] = useState(0);
  var [month, setMonth] = useState(1);
  var [ivl, setIvl] = useState("");
  var [unit, setUnit] = useState("days");
  var t = TYPES.filter(function (tt) { return tt.id === type; })[0];
  if (!open) return <PillButton variant="secondary" testId="wave-new" onClick={function () { setOpen(true); }} style={{ alignSelf: "flex-start" }}>{"New " + t.noun}</PillButton>;
  function save() {
    if (!name.trim()) return;
    x.add(type, name, type === "weekly" ? { dayOfWeek: day } : type === "seasonal" ? { month: month } : type === "custom" && ivl ? { intervalDays: x.toDays(ivl, unit) } : {});
    setOpen(false); setName(""); setDay(0); setMonth(1); setIvl(""); setUnit("days");
  }
  return (
    <Card title={"New " + t.noun}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input autoFocus value={name} aria-label="Wave name" placeholder="Wave name…" onChange={function (e) { setName(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") save(); }} style={inputStyle} />
        {type === "weekly" && <Chips options={x.dayLabels} value={day} valueOf={function (i) { return i; }} onPick={setDay} />}
        {type === "seasonal" && <Chips options={x.monthLabels} value={month} valueOf={function (i) { return i + 1; }} onPick={setMonth} />}
        {type === "custom" && (
          <>
            <IntervalInput value={ivl} unit={unit} onValue={setIvl} onUnit={setUnit} />
            <div style={{ fontSize: 12.5, color: MUTED }}>Time between resets. Leave blank for a one-time list.</div>
          </>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <PillButton onClick={save}>Add wave</PillButton>
          <PillButton variant="ghost" onClick={function () { setOpen(false); }}>Cancel</PillButton>
        </div>
      </div>
    </Card>
  );
}

export default function WavesFull(props) {
  var se = props.showEmojis === true;
  var [type, setType] = useState("daily");
  var waves = props.waves || {};
  var list = waves[type] || [];
  var tabs = TYPES.map(function (t) { return { id: t.id, label: t.label, count: (waves[t.id] || []).length || null }; });
  var x = props.api;
  return (
    <FullViewPage testId="redesign-waves">
      <FullViewHeader title="Waves" emoji="〰️" showEmojis={se} subtitle="Routines that reset on their own" />
      <PillTabs label="Wave types" tabs={tabs} value={type} onChange={setType} testIdPrefix="waves-tab-" showEmojis={se} />
      {!list.length && <Card><Empty>{"No " + TYPES.filter(function (t) { return t.id === type; })[0].noun + "s yet."}</Empty></Card>}
      {list.map(function (w) { return <WaveCard key={w.id} wave={w} type={type} api={x} />; })}
      <AddWave key={type} type={type} api={x} />
      {props.footer}
    </FullViewPage>
  );
}
