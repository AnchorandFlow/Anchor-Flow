// src/redesign/AnchorHubsFull.jsx — redesigned Home, People and Horizon full
// views (af_redesign). Rendered by HomeFlow's HomeTab / PeopleTab /
// HorizonTab closures, which keep every read and write (af_home_info,
// af_home_cleaning, ...) and pass data + handlers in; this file is markup and
// local UI state (selected pill, revealed sensitive rows) only.
//
// Each legacy accordion hub becomes a pill. Sensitive records show a lock and
// a hint until tapped; Health's PIN-locked notes never reveal here (tapping
// opens Health, which asks for the PIN).
import { useState } from "react";
import { AnchorScreen, AnchorCard, ARow, ALabel, AEmpty, APill, ACheck, LockRow } from "./AnchorFullView.jsx";
import { INK_SOFT, CARD_LINE } from "./anchorKit.js";
import { emo, goAnchor } from "./fullViewKit.js";
import { formatTripRange } from "./vaultChrome.js";

// Each pill's card carries no title of its own: the selected pill already
// names it (only extra cards on the same pill, like Sensitive or Zones, keep
// a title).

function useReveal() {
  var [revealed, setRevealed] = useState({});
  function toggle(id) { setRevealed(function (p) { var n = Object.assign({}, p); n[id] = !p[id]; return n; }); }
  return [revealed, toggle];
}

function SensitiveList(props) {
  if (!props.records.length) return null;
  return (
    <AnchorCard title="Sensitive" testId={props.testId || "sensitive-card"}>
      {props.records.map(function (r, i) {
        return <LockRow key={r.id} first={i === 0} record={r} revealed={props.revealed[r.id]}
          onTap={function () { if (r.pin) { props.openVault(r.section); return; } props.onToggle(r.id); }} />;
      })}
    </AnchorCard>
  );
}

function OpenLink(props) {
  return <div style={{ marginTop: 12 }}><APill small testId={props.testId} onClick={props.onClick}>{props.children}</APill></div>;
}

// ── Home ─────────────────────────────────────────────────────────────────────
var HOME_TABS = [
  { id: "info", label: "Household Info", emoji: "🏡" },
  { id: "cleaning", label: "Cleaning", emoji: "🧹" },
  { id: "maintenance", label: "Maintenance", emoji: "🔧" },
  { id: "inventory", label: "Inventory", emoji: "📦" },
  { id: "reminders", label: "Reminders", emoji: "🔔" },
  { id: "subs", label: "Subscriptions", emoji: "💳" },
];

export function HomeFull(props) {
  var p = props;
  var [tab, setTab] = useState("info");
  var se = p.showEmojis === true;

  function body() {
    if (tab === "info") {
      var cats = p.infoCategories.filter(function (c) { return p.homeInfo.some(function (i) { return (i.category || "General") === c; }); });
      return (
        <AnchorCard testId="home-info" right={<APill small testId="home-info-add" onClick={p.onAddInfo}>+ Add</APill>}>
          {p.homeInfo.length === 0 && <AEmpty>No home info saved yet. Wi-Fi password, utilities, vendor and emergency contacts.</AEmpty>}
          {cats.map(function (cat, ci) {
            return (
              <div key={cat}>
                <ALabel first={ci === 0}>{cat}</ALabel>
                {p.homeInfo.filter(function (i) { return (i.category || "General") === cat; }).map(function (item, ii) {
                  return <ARow key={item.id} first={ii === 0} testId={"home-info-" + item.id} label={item.label} sub={item.value || null} onClick={function () { p.onEditInfo(item); }} />;
                })}
              </div>
            );
          })}
        </AnchorCard>
      );
    }
    if (tab === "cleaning") {
      var z = p.activeZone;
      var zt = (z && z.tasks) || [];
      var zDone = zt.filter(function (t) { return t.done; }).length;
      return (
        <>
          <AnchorCard title={z ? z.name : "Cleaning"} testId="home-zone"
            right={z ? <span style={{ fontSize: 13.5, color: INK_SOFT, fontWeight: 700 }}>{zDone + " of " + zt.length}</span> : null}>
            {p.zones.length === 0 && <AEmpty>Organize your home into cleaning zones. Today's active zone appears in Today's Home Focus.</AEmpty>}
            {z && z.rooms && <div style={{ fontSize: 13.5, color: INK_SOFT, marginBottom: 6 }}>{z.rooms}</div>}
            {z && zt.length === 0 && <AEmpty>No tasks in this zone yet.</AEmpty>}
            {zt.map(function (t, i) {
              return (
                <div key={t.id} data-testid={"zone-task-" + t.id} data-done={t.done ? "true" : "false"}
                  style={{ display: "flex", alignItems: "center", gap: 12, borderTop: i === 0 ? "none" : "1px solid " + CARD_LINE }}>
                  <ACheck done={t.done} label={t.text} onToggle={function () { p.onToggleTask(t.id); }} testId={"zone-check-" + t.id} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ARow first label={t.text} done={t.done} onClick={function () { p.onToggleTask(t.id); }} />
                  </div>
                </div>
              );
            })}
            {zt.some(function (t) { return t.done; }) && <OpenLink testId="zone-reset" onClick={p.onResetZone}>Reset zone</OpenLink>}
          </AnchorCard>
          <AnchorCard title="Zones" testId="home-zones" right={<APill small variant="secondary" testId="zone-add" onClick={p.onAddZone}>+ Add zone</APill>}>
            {p.zones.length === 0 && <AEmpty>No zones yet.</AEmpty>}
            {p.zones.map(function (zz, zi) {
              var active = zi === p.activeZoneIndex;
              return (
                <ARow key={zz.id} first={zi === 0} testId={"zone-" + zz.id} label={zz.name}
                  sub={(zz.rooms || "No rooms set") + " · " + (zz.tasks || []).length + " task" + ((zz.tasks || []).length !== 1 ? "s" : "")}
                  right={
                    <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {active ? <span style={{ fontSize: 12.5, fontWeight: 700, color: INK_SOFT, padding: "6px 4px" }}>This week</span>
                        : <APill small variant="secondary" onClick={function () { p.onSetActiveZone(zi); }}>Set</APill>}
                      <APill small variant="secondary" ariaLabel={"Edit " + zz.name} onClick={function () { p.onEditZone(zz); }}>Edit</APill>
                    </span>
                  } />
              );
            })}
          </AnchorCard>
        </>
      );
    }
    if (tab === "maintenance") {
      var m = p.maintenanceDueSoon;
      return (
        <AnchorCard testId="home-maintenance">
          {p.maintenanceCount === 0 ? <AEmpty>No maintenance items yet. Add your first in Maintenance.</AEmpty> : (
            m.length === 0 ? <AEmpty>All clear.</AEmpty> : (
              <>
                <ALabel first>Next due</ALabel>
                <ARow first label={m[0].name} value={p.formatDue(m[0].nextDue)} testId={"maint-" + m[0].id} />
                {m.length > 1 && <ALabel>Upcoming</ALabel>}
                {m.slice(1).map(function (s, i) { return <ARow key={s.id} first={i === 0} label={s.name} value={p.formatDue(s.nextDue)} testId={"maint-" + s.id} />; })}
              </>
            )
          )}
          <OpenLink testId="open-systems" onClick={function () { p.openVault("systems"); }}>Open Maintenance</OpenLink>
        </AnchorCard>
      );
    }
    if (tab === "inventory") {
      return (
        <AnchorCard testId="home-inventory" right={<span style={{ fontSize: 13.5, color: INK_SOFT, fontWeight: 700 }}>{p.inventoryCount + " tracked"}</span>}>
          <ALabel first>Running low</ALabel>
          {p.inventoryLow.length === 0 ? <AEmpty>All stocked.</AEmpty>
            : p.inventoryLow.map(function (it, i) { return <ARow key={it.id || i} first={i === 0} icon={emo(se, "⚠️")} label={it.name} testId={"low-" + (it.id || i)} />; })}
          <OpenLink testId="open-inventory" onClick={function () { p.openVault("inventory"); }}>Open Inventory</OpenLink>
        </AnchorCard>
      );
    }
    if (tab === "reminders") {
      return (
        <AnchorCard testId="home-reminders">
          {p.reminders.length === 0 ? <AEmpty>No reminders yet. Add your first in Reminders.</AEmpty>
            : p.reminders.slice(0, 6).map(function (r, i) { return <ARow key={r.id} first={i === 0} icon={emo(se, r.emoji || "🔁")} label={r.label} value={p.reminderLabel(r)} testId={"reminder-" + r.id} />; })}
          <OpenLink testId="open-recurring" onClick={function () { p.openVault("recurring"); }}>Open Reminders</OpenLink>
        </AnchorCard>
      );
    }
    return (
      <AnchorCard testId="home-subs">
        {p.subs.length === 0 ? <AEmpty>No subscriptions tracked yet. Add your first in Subscriptions.</AEmpty>
          : p.subs.map(function (s, i) { return <ARow key={s.id || i} first={i === 0} label={s.name} value={s.amount ? ("$" + s.amount + " / " + s.cycle) : s.cycle} testId={"sub-" + (s.id || i)} />; })}
        <OpenLink testId="open-subs" onClick={function () { p.openVault("subs"); }}>Open Subscriptions</OpenLink>
      </AnchorCard>
    );
  }

  return (
    <AnchorScreen section="home" testId="home-full" title="Home" emoji="🏡" subtitle="Your household operations center" showEmojis={se} onBack={goAnchor}
      tabs={HOME_TABS} value={tab} onChange={setTab}>
      {body()}
      {p.infoModal || null}
      {p.zoneModal || null}
    </AnchorScreen>
  );
}

// ── People ───────────────────────────────────────────────────────────────────
var PEOPLE_TABS = [
  { id: "health", label: "Health", emoji: "🩺" },
  { id: "career", label: "Career", emoji: "📋" },
  { id: "pets", label: "Pets", emoji: "🐾" },
];

export function PeopleFull(props) {
  var p = props;
  var [tab, setTab] = useState("health");
  var [revealed, toggle] = useReveal();
  var se = p.showEmojis === true;
  var subtitle = p.memberCount > 0 ? (p.memberCount + " household member" + (p.memberCount !== 1 ? "s" : "") + " · " + p.overviewStatus) : p.overviewStatus;

  function body() {
    if (tab === "health") {
      return (
        <>
          <AnchorCard testId="people-health">
            {p.healthRows.length === 0 ? <AEmpty>No household members yet. Add people in Settings.</AEmpty>
              : p.healthRows.map(function (r, i) { return <ARow key={r.id} first={i === 0} dot={r.color || "#4A7FA8"} label={r.name} value={r.status} testId={"health-" + r.id} />; })}
            <OpenLink testId="open-health" onClick={function () { p.openVault("health"); }}>Open Health</OpenLink>
          </AnchorCard>
          <SensitiveList records={p.sensitive} revealed={revealed} onToggle={toggle} openVault={p.openVault} />
        </>
      );
    }
    if (tab === "career") {
      return (
        <AnchorCard testId="people-career">
          {p.careerRows.length === 0 ? <AEmpty>No household members yet. Add people in Settings.</AEmpty>
            : p.careerRows.map(function (r, i) { return <ARow key={r.id} first={i === 0} dot={r.color || "#4A7FA8"} label={r.name} value={r.status} testId={"career-" + r.id} />; })}
          <OpenLink testId="open-career" onClick={function () { p.openVault("career"); }}>Open Career</OpenLink>
        </AnchorCard>
      );
    }
    return (
      <AnchorCard testId="people-pets">
        {p.pets.length === 0 ? <AEmpty>No pets yet. Add your first in Pets.</AEmpty>
          : p.pets.map(function (x, i) { return <ARow key={x.id} first={i === 0} icon={emo(se, "🐾")} label={x.name + (x.type ? " · " + x.type : "")} value={x.next ? x.next.name + " in " + x.next.days + "d" : "Up to date"} testId={"pet-" + x.id} />; })}
        <OpenLink testId="open-pets" onClick={function () { p.openVault("pets"); }}>Open Pets</OpenLink>
      </AnchorCard>
    );
  }

  return (
    <AnchorScreen section="people" testId="people-full" title="People" emoji="👥" subtitle={subtitle} showEmojis={se} onBack={goAnchor}
      tabs={PEOPLE_TABS} value={tab} onChange={setTab}>
      {body()}
    </AnchorScreen>
  );
}

// ── Horizon ──────────────────────────────────────────────────────────────────
var HORIZON_TABS = [
  { id: "travel", label: "Travel", emoji: "🧳" },
  { id: "celebrations", label: "Celebrations", emoji: "🎉" },
  { id: "safeharbor", label: "Safe Harbor", emoji: "⚓" },
];

export function HorizonFull(props) {
  var p = props;
  var [tab, setTab] = useState("travel");
  var [revealed, toggle] = useReveal();
  var se = p.showEmojis === true;

  function body() {
    if (tab === "travel") {
      return (
        <>
          <AnchorCard title="Upcoming trips" testId="horizon-travel">
            {p.trips.length === 0 ? <AEmpty>No upcoming trips. Add your first in Travel.</AEmpty>
              : p.trips.slice(0, 6).map(function (x, i) { return <ARow key={x.trip.id || x.trip.name} first={i === 0} icon={emo(se, "🧳")} label={x.trip.name} sub={formatTripRange(x.trip.startDate, x.trip.endDate) || "Add dates"} value={x.days + "d"} testId={"trip-" + (x.trip.id || i)} />; })}
            <OpenLink testId="open-trips" onClick={function () { p.openVault("trips"); }}>Open Travel</OpenLink>
          </AnchorCard>
          <SensitiveList records={p.sensitive} revealed={revealed} onToggle={toggle} openVault={p.openVault} />
        </>
      );
    }
    if (tab === "celebrations") {
      return (
        <AnchorCard testId="horizon-celebrations">
          {p.celebrations.length === 0 ? <AEmpty>No celebrations yet. Add your first in Celebrations.</AEmpty>
            : p.celebrations.slice(0, 6).map(function (c, i) { return <ARow key={c.id} first={i === 0} icon={emo(se, "🎉")} label={c.name} value={c.dateLabel + " · " + c.diff + "d"} testId={"celeb-" + c.id} />; })}
          <OpenLink testId="open-gifts" onClick={function () { p.openVault("gifts"); }}>Open Celebrations</OpenLink>
        </AnchorCard>
      );
    }
    return (
      <AnchorCard testId="horizon-safeharbor">
        <ARow first label="Grab items" value={String(p.grabItemCount)} />
        <ARow label="Local plans" value={String(p.hazardCount)} />
        <ARow label="Last reviewed" value={p.lastReviewed ? (formatTripRange(p.lastReviewed, p.lastReviewed) || p.lastReviewed) : "Never"} />
        <OpenLink testId="open-safeharbor" onClick={function () { p.openVault("safeharbor"); }}>Open Safe Harbor</OpenLink>
      </AnchorCard>
    );
  }

  return (
    <AnchorScreen section="horizon" testId="horizon-full" title="Horizon" emoji="🌄" subtitle="What's ahead" showEmojis={se} onBack={goAnchor}
      tabs={HORIZON_TABS} value={tab} onChange={setTab}>
      {body()}
    </AnchorScreen>
  );
}
