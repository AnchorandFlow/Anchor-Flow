// src/shell/TopNav.jsx — af_redesign top navigation, replacing the 68px side
// rail. Left: anchor logo + "ANCHOR & FLOW" (wordmark hidden on phones).
// Right: the four section icons (Today, Flow, Anchor, Ripples) in their
// pillar colors — current one solid with aria-current="page", others a pale
// tint — then a divider and the gold Compass button. Phone (≤600px): 40px
// icons, no labels, Compass as a round button.
//
// Fixed at the top (an ancestor clips overflow, so sticky would not hold);
// its height is published as --af-nav-h: the page pads by it, and the
// fixed Anchor overlays (Vault, Safe Harbor, Ripples, Anchor hub) start below
// it instead of covering it.
import { useEffect, useRef } from "react";
import AnchorLogo from "../components/AnchorLogo.jsx";
import { color, font } from "../design/tokens.js";
import { NAV_SECTIONS } from "./navModel.js";

var STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

export function SectionGlyph(props) {
  var s = props.size || 20;
  var body;
  if (props.id === "today" || props.id === "compass") {
    body = (<>
      <circle cx="12" cy="12" r="8.5" {...STROKE} />
      <path d="M15.5 8.5l-2.2 5-4.8 2 2.2-5z" {...STROKE} fill="currentColor" fillOpacity="0.25" />
    </>);
  } else if (props.id === "flow") {
    body = (<>
      <path d="M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0" {...STROKE} />
      <path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" {...STROKE} />
    </>);
  } else if (props.id === "anchor") {
    body = (<>
      <circle cx="12" cy="5" r="2" {...STROKE} />
      <path d="M12 7v13M8 11h8M5 14c0 3.5 3 6 7 6s7-2.5 7-6" {...STROKE} />
    </>);
  } else {
    body = (<>
      <circle cx="12" cy="12" r="2" {...STROKE} />
      <circle cx="12" cy="12" r="5.5" {...STROKE} opacity="0.75" />
      <circle cx="12" cy="12" r="9" {...STROKE} opacity="0.45" />
    </>);
  }
  return <svg aria-hidden="true" width={s} height={s} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>{body}</svg>;
}

var CSS = [
  ".af-topnav{position:fixed;top:0;left:0;right:0;z-index:210;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px)}",
  ".af-topnav-in{max-width:1200px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box}",
  ".af-tn-brand{display:flex;align-items:center;gap:8px;background:none;border:none;padding:4px;border-radius:10px;cursor:pointer;color:inherit;min-width:0}",
  ".af-tn-word{font-size:12px;font-weight:800;letter-spacing:.16em;white-space:nowrap}",
  ".af-tn-right{display:flex;align-items:center;gap:6px;min-width:0}",
  ".af-tn-sec{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;padding:2px;cursor:pointer;border-radius:14px;color:inherit;font:inherit}",
  ".af-tn-ico{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;transition:transform .15s}",
  ".af-tn-sec:hover .af-tn-ico{transform:translateY(-1px)}",
  ".af-tn-label{font-size:10.5px;font-weight:700;letter-spacing:.02em;line-height:1}",
  ".af-tn-div{width:1px;height:34px;margin:0 6px;flex-shrink:0}",
  ".af-tn-compass{display:flex;align-items:center;gap:7px;height:44px;padding:0 16px 0 12px;border:none;border-radius:999px;cursor:pointer;background:linear-gradient(135deg,#DDBB70,#B08840);color:#1B2B44;font-weight:800;font-size:14px;box-shadow:0 3px 10px rgba(176,136,64,.35);flex-shrink:0}",
  ".af-topnav button:focus-visible,.af-topnav a:focus-visible{outline:3px solid #C8A253;outline-offset:3px}",
  "@media (max-width:600px){.af-topnav-in{padding:8px 12px;gap:8px}.af-tn-word,.af-tn-label,.af-tn-compass-label{display:none}.af-tn-ico{width:40px;height:40px}.af-tn-right{gap:5px}.af-tn-div{margin:0 3px;height:28px}.af-tn-compass{width:40px;height:40px;padding:0;justify-content:center}}",
  "@media (max-width:360px){.af-tn-ico{width:36px;height:36px}.af-tn-compass{width:36px;height:36px}.af-tn-brand svg{width:26px;height:26px}}",
].join("");

// props: current ("today"|"flow"|"anchor"|"ripples"|null), dark (navy page),
//        ripplesOn, onSection(id), onCompass(), onHome()
export default function TopNav(props) {
  var ref = useRef(null);
  useEffect(function () {
    var el = ref.current;
    if (!el || typeof document === "undefined") return undefined;
    function publish() { document.documentElement.style.setProperty("--af-nav-h", el.offsetHeight + "px"); }
    publish();
    var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", publish);
    return function () { if (ro) ro.disconnect(); window.removeEventListener("resize", publish); };
  }, []);
  var dark = props.dark === true;
  var ink = dark ? color.surface : color.anchorNavy;
  var bg = props.background || (dark ? color.anchorNavy : color.background);
  var secs = NAV_SECTIONS.filter(function (s) { return s.id !== "ripples" || props.ripplesOn !== false; });
  return (
    <nav ref={ref} className="af-topnav" aria-label="Sections" data-testid="top-nav" data-dark={dark ? "true" : undefined}
      style={{ background: bg, color: ink, fontFamily: font.body, borderBottom: "1px solid " + (dark ? "rgba(242,234,216,0.12)" : "rgba(27,43,68,0.08)") }}>
      <style>{CSS}</style>
      <div className="af-topnav-in">
        <button type="button" className="af-tn-brand" onClick={props.onHome} aria-label="Anchor & Flow — Today" data-testid="nav-brand">
          <AnchorLogo size={30} color={dark ? color.surface : color.anchorNavy} />
          <span className="af-tn-word">ANCHOR &amp; FLOW</span>
        </button>
        <div className="af-tn-right">
          {secs.map(function (s) {
            var on = props.current === s.id;
            return (
              <button key={s.id} type="button" className="af-tn-sec" data-testid={"nav-" + s.id}
                aria-current={on ? "page" : undefined} aria-label={s.label} title={s.label}
                onClick={function () { props.onSection(s.id); }}>
                <span className="af-tn-ico" style={{ background: on ? s.tone.full : s.tone.tint, color: on ? "#FFFFFF" : s.tone.full, boxShadow: on ? (dark ? "0 0 0 2px #F2EAD8, 0 3px 10px rgba(0,0,0,0.25)" : "0 3px 10px rgba(27,43,68,0.22)") : "none" }}>
                  <SectionGlyph id={s.id} size={20} />
                </span>
                <span className="af-tn-label" style={{ color: on ? ink : (dark ? "rgba(242,234,216,0.75)" : "rgba(27,43,68,0.7)") }}>{s.label}</span>
              </button>
            );
          })}
          <span className="af-tn-div" aria-hidden="true" style={{ background: dark ? "rgba(242,234,216,0.25)" : "rgba(27,43,68,0.15)" }} />
          <button type="button" className="af-tn-compass" data-testid="nav-compass" aria-label="Compass" aria-haspopup="dialog" onClick={props.onCompass}>
            <SectionGlyph id="compass" size={20} />
            <span className="af-tn-compass-label">Compass</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
