// src/redesign/GoogleCalendarRow.jsx — the Google Calendar connection, as
// one row (Settings › Calendar, and the Calendar tab):
//   connected: "Connected as <email> · Last synced <time>" + Sync now / Disconnect
//   needs confirming: a readable message + Reconnect
//   not connected (on this device): Connect Google Calendar
// Pure UI; HomeFlow owns the token, the fetch and the writes.
import { font, color as COLOR } from "../design/tokens.js";

var NAVY = COLOR.anchorNavy, MUTED = "#5B6472", LINE = "rgba(27,43,68,0.16)";
var BTN = { minHeight: 40, padding: "0 16px", borderRadius: 10, fontFamily: font.body, fontSize: 15, fontWeight: 700, cursor: "pointer" };

function when(ts) {
  if (!ts) return "not yet";
  var d = new Date(ts);
  var today = new Date();
  var t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === today.toDateString() ? "today " + t : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + t;
}

// props: status { connected, account, lastSynced, syncing, error, needsReconnect, count },
//        onConnect, onSync, onDisconnect, compact
export default function GoogleCalendarRow(props) {
  var s = props.status || {};
  return (
    <div data-testid="gcal-row" data-state={s.needsReconnect ? "reconnect" : s.connected ? "connected" : "off"} style={{ fontFamily: font.body, color: NAVY, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: "50%", background: "#EEF3FB", border: "1.5px solid #C9D8F2", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#2F6BD8", flexShrink: 0 }}>G</span>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Google Calendar</div>
          <div data-testid="gcal-status" style={{ fontSize: 15, color: MUTED, overflowWrap: "anywhere" }}>
            {s.connected
              ? ["Connected as " + (s.account || "your Google account"), "Last synced " + (s.syncing ? "now…" : when(s.lastSynced))].join(" · ")
              : s.needsReconnect ? "Connected as " + (s.account || "your Google account") + " · needs confirming"
              : "Not connected on this device"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {s.connected && <button type="button" data-testid="gcal-sync" disabled={s.syncing} onClick={props.onSync} style={Object.assign({}, BTN, { border: "none", background: NAVY, color: "#FFFFFF", opacity: s.syncing ? 0.6 : 1 })}>{s.syncing ? "Syncing…" : "Sync now"}</button>}
          {s.needsReconnect && <button type="button" data-testid="gcal-reconnect" onClick={props.onConnect} style={Object.assign({}, BTN, { border: "none", background: "#2F6BD8", color: "#FFFFFF" })}>Reconnect</button>}
          {!s.connected && !s.needsReconnect && <button type="button" data-testid="gcal-connect" onClick={props.onConnect} style={Object.assign({}, BTN, { border: "none", background: "#2F6BD8", color: "#FFFFFF" })}>Connect Google Calendar</button>}
          {(s.connected || s.needsReconnect) && <button type="button" data-testid="gcal-disconnect" onClick={props.onDisconnect} style={Object.assign({}, BTN, { border: "1.5px solid " + LINE, background: "#FFFFFF", color: NAVY })}>Disconnect</button>}
        </div>
      </div>
      {s.error && <div role="alert" data-testid="gcal-error" style={{ fontSize: 15, lineHeight: 1.45, background: "#FBEFEC", border: "1px solid #E7C3BB", color: "#8A3B30", borderRadius: 10, padding: "10px 12px" }}>{s.error}</div>}
      {!props.compact && s.connected && typeof s.count === "number" && <div style={{ fontSize: 13, color: MUTED }}>{s.count + " Google event" + (s.count === 1 ? "" : "s") + " from the calendars ticked in Google Calendar. Read-only here — edit them in Google."}</div>}
      {!props.compact && !s.connected && !s.needsReconnect && <div style={{ fontSize: 13, color: MUTED }}>Each person connects on their own device. Events show for the whole household, marked "Google".</div>}
    </div>
  );
}
