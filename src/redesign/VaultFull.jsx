// src/redesign/VaultFull.jsx — redesigned Vault and Safe Harbor full views
// (af_redesign). Rendered by AnchorVault in place of its legacy shell; every
// section body is AnchorVault's own (same components, same storage), passed
// in as `body`.
//
// Vault: "← Anchor", Playfair title, pills = Overview + each vault section
// that is turned on (Settings › Anchor hidden + feature toggles). Overview
// lists the sections with their record counts and every sensitive record as
// a locked hint (tap to show; Health's PIN-locked notes open Health, which
// asks for the PIN).
//
// Safe Harbor: SafeHarbor.jsx draws its own header and pills when given
// `redesign`; this only supplies the navy page.
import { useState, useEffect } from "react";
import { AnchorPage, AnchorScreen, AnchorCard, AnchorBody, ARow, LockRow, AEmpty } from "./AnchorFullView.jsx";
import { EmojiScope } from "./FullView.jsx";
import { emo } from "./fullViewKit.js";
import { vaultSections, sensitiveRecords } from "./anchorData.js";
import { readAnchorStores } from "./anchorStores.js";

function readRecurringCount() {
  try { var v = JSON.parse(localStorage.getItem("af_recurring") || "[]"); return Array.isArray(v) ? v.length : 0; } catch { return 0; }
}

// Sections reached from another section that belong to a pill.
var PILL_FOR = { travel: "trips" };

function vaultPills(store, anchorHidden, featureFlags, recurringCount) {
  var secs = vaultSections(store, anchorHidden, featureFlags);
  var out = [{ id: "home", label: "Overview", emoji: "🗝️" }];
  secs.forEach(function (v) {
    out.push({ id: v.id, label: v.label, emoji: v.icon, count: v.count });
    if (v.id === "systems" && !(anchorHidden && anchorHidden.recurring)) out.push({ id: "recurring", label: "Reminders", emoji: "🔁", count: recurringCount });
  });
  return out;
}

// props: activeSection, onSection(id), featureFlags, onBack, body (the
//        legacy section element for activeSection), scrollRef
export default function VaultFull(props) {
  var [s, setS] = useState(readAnchorStores);
  var [recurringCount, setRecurringCount] = useState(readRecurringCount);
  var [revealed, setRevealed] = useState({});
  useEffect(function () {
    function refresh() { setS(readAnchorStores()); setRecurringCount(readRecurringCount()); }
    window.addEventListener("af-data-changed", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("af-anchor-hidden-changed", refresh);
    return function () {
      window.removeEventListener("af-data-changed", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("af-anchor-hidden-changed", refresh);
    };
  }, []);
  var se = s.showEmojis === true;
  var section = props.activeSection || "home";

  if (section === "safeharbor") {
    return <AnchorPage overlay testId="safeharbor-full" scrollRef={props.scrollRef}>{props.body}</AnchorPage>;
  }

  var pills = vaultPills(s, s.anchorHidden, props.featureFlags, recurringCount);
  var pillValue = PILL_FOR[section] || section;

  function overview() {
    var sens = sensitiveRecords(s.travelProfile, s.health, s.people, s.anchorHidden, props.featureFlags);
    var rows = pills.filter(function (p) { return p.id !== "home"; });
    return (
      <>
        <AnchorCard title="Records" testId="vault-records">
          {rows.length === 0 && <AEmpty>Every vault section is turned off. Turn them on in Settings.</AEmpty>}
          {rows.map(function (p, i) {
            return <ARow key={p.id} first={i === 0} testId={"vault-" + p.id} icon={emo(se, p.emoji)} label={p.label}
              value={p.count ? p.count + " record" + (p.count === 1 ? "" : "s") : "empty"}
              onClick={function () { props.onSection(p.id); }} />;
          })}
        </AnchorCard>
        {sens.length > 0 && (
          <AnchorCard title="Sensitive" testId="sensitive-card">
            {sens.map(function (r, i) {
              return <LockRow key={r.id} first={i === 0} record={r} revealed={revealed[r.id]}
                onTap={function () {
                  if (r.pin) { props.onSection(r.section); return; }
                  setRevealed(function (p) { var n = Object.assign({}, p); n[r.id] = !p[r.id]; return n; });
                }} />;
            })}
          </AnchorCard>
        )}
      </>
    );
  }

  return (
    <AnchorScreen overlay testId="vault-full" title="Vault" emoji="🗝️" subtitle="Records for your home and family, kept in one place" showEmojis={se}
      onBack={props.onBack} tabs={pills} value={pillValue} onChange={props.onSection} testIdPrefix="vault-pill-" scrollRef={props.scrollRef}>
      {section === "home" ? overview() : (
        <AnchorBody><EmojiScope showEmojis={se}>{props.body}</EmojiScope></AnchorBody>
      )}
    </AnchorScreen>
  );
}
