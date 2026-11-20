// src/shell/AppFooter.jsx — af_redesign footer at the end of every main
// screen's scroll. Left: "Anchor & Flow · a steadier home, in every season".
// Right: Settings (opens Settings), Contact us (the existing contact page on
// the marketing site), Help (the existing in-app "Send feedback" form — there
// is no help page), Privacy. Phone: centered, smaller, one row of links.
import { font } from "../design/tokens.js";
import { CONTACT_URL, PRIVACY_URL } from "./navModel.js";


function fire(name) { try { window.dispatchEvent(new CustomEvent(name)); } catch { /* no window */ } }

var CSS = [
  ".af-foot{box-sizing:border-box;width:100%;max-width:1200px;margin:0 auto;padding:28px 20px calc(24px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;justify-content:space-between;gap:12px 20px;flex-wrap:wrap;font-size:13px}",
  ".af-foot-links{display:flex;gap:18px;align-items:center}",
  ".af-foot a,.af-foot button{color:inherit;text-decoration:none;font:inherit;background:none;border:none;padding:4px 2px;cursor:pointer;border-radius:6px;white-space:nowrap}",
  ".af-foot a:hover,.af-foot button:hover{text-decoration:underline}",
  ".af-foot a:focus-visible,.af-foot button:focus-visible{outline:3px solid #C8A253;outline-offset:2px}",
  // Phone: centered; extra room at the bottom so Quick Capture (fixed, bottom
  // right) never sits on the links at the end of the scroll.
  "@media (max-width:600px){.af-foot{flex-direction:column;justify-content:center;text-align:center;font-size:11.5px;gap:8px;padding:22px 12px calc(84px + env(safe-area-inset-bottom,0px))}.af-foot-links{gap:12px;flex-wrap:nowrap}}",
].join("");

// props: dark (navy / teal page)
export default function AppFooter(props) {
  var dark = props.dark === true;
  return (
    <footer className="af-foot" data-testid="app-footer" style={{ fontFamily: font.body, color: dark ? "rgba(242,234,216,0.72)" : "rgba(27,43,68,0.68)", borderTop: "1px solid " + (dark ? "rgba(242,234,216,0.12)" : "rgba(27,43,68,0.10)") }}>
      <style>{CSS}</style>
      <span>Anchor &amp; Flow · a steadier home, in every season</span>
      <span className="af-foot-links">
        <button type="button" data-testid="footer-settings" onClick={function () { fire("af-open-settings"); }}>Settings</button>
        <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" data-testid="footer-contact">Contact us</a>
        <button type="button" data-testid="footer-help" onClick={function () { fire("af-open-feedback"); }}>Help</button>
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" data-testid="footer-privacy">Privacy</a>
      </span>
    </footer>
  );
}
