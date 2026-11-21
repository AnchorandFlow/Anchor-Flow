// Final type (af_redesign): Playfair Display + Lato, one Google Fonts link,
// the html.af-rd safety net, and the flag-off path left as it was.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { RD_FONTS_URL, LEGACY_FONTS_URL, installFonts, redesignTypeCss, PLAYFAIR, LATO } from "../../src/design/redesignType.js";
import { font } from "../../src/design/tokens.js";

function freshDoc() { return document.implementation.createHTMLDocument("t"); }

describe("font loading", function () {
  it("new look: one link, only Playfair 600/700 + italic 500 and Lato 400/700/900, display=swap", function () {
    expect(RD_FONTS_URL).toBe("https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&family=Playfair+Display:ital,wght@0,600;0,700;1,500&display=swap");
    var d = freshDoc();
    installFonts(d, true);
    var links = d.head.querySelectorAll('link[rel="stylesheet"]');
    expect(links.length).toBe(1);
    expect(links[0].href).toBe(RD_FONTS_URL);
    expect(d.documentElement.classList.contains("af-rd")).toBe(true);
    expect(d.getElementById("af-rd-type")).not.toBeNull();
    installFonts(d, true); // idempotent
    expect(d.head.querySelectorAll('link[rel="stylesheet"]').length).toBe(1);
  });
  it("flag off: the original font link, no class, no type stylesheet", function () {
    expect(LEGACY_FONTS_URL).toBe("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&family=Lato:wght@400;700&family=Playfair+Display:wght@600;700&display=swap");
    var d = freshDoc();
    installFonts(d, false);
    expect(d.head.querySelector("link").href).toBe(LEGACY_FONTS_URL);
    expect(d.documentElement.className).toBe("");
    expect(d.getElementById("af-rd-type")).toBeNull();
  });
  it("index.html keeps the preconnects and has no font stylesheet of its own", function () {
    var html = fs.readFileSync("index.html", "utf8");
    expect(html).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />');
    expect(html).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />');
    expect(html).not.toContain("fonts.googleapis.com/css2");
    expect(fs.readFileSync("src/App.jsx", "utf8")).toContain('import "./design/redesignType.js"');
  });
});

describe("type rules", function () {
  it("tokens: Playfair (Georgia fallback) and Lato (system-ui fallback)", function () {
    expect(PLAYFAIR).toBe("'Playfair Display', Georgia, serif");
    expect(LATO).toBe("'Lato', system-ui, sans-serif");
    expect(font.heading).toBe(PLAYFAIR);
    expect(font.body).toBe(LATO);
  });
  it("safety net: leftover Cormorant / DM Sans map to Playfair / Lato; serif under 18px becomes Lato bold", function () {
    var css = redesignTypeCss();
    expect(css).toContain("html.af-rd [style*=\"DM Sans\"]{font-family:" + LATO + "!important}");
    expect(css).toContain("html.af-rd [style*=\"Cormorant\"]{font-family:" + PLAYFAIR + "!important}");
    ["14px", "17.5px", "0.85rem", "1.05rem"].forEach(function (sz) {
      expect(css).toContain('html.af-rd [style*="Playfair"][style*="font-size: ' + sz + ';"]');
      expect(css).toContain('html.af-rd [style*="Cormorant"][style*="font-size: ' + sz + ';"]');
    });
    expect(css).not.toContain('font-size: 18px;"]');
    expect(css).toContain("{font-family:" + LATO + "!important;font-weight:700!important;font-style:normal!important}");
  });
  it("text fields are 16px in the new look (iPhone doesn't zoom); checkboxes and buttons are left alone", function () {
    var css = redesignTypeCss();
    expect(css).toContain('html.af-rd input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]),html.af-rd textarea,html.af-rd select{font-size:16px!important}');
    var d = document;
    var st = d.createElement("style"); st.textContent = css; d.head.appendChild(st);
    d.documentElement.classList.add("af-rd");
    var i = d.createElement("input"); i.style.fontSize = "13px"; d.body.appendChild(i);
    var c = d.createElement("input"); c.type = "checkbox"; c.style.fontSize = "13px"; d.body.appendChild(c);
    var sel = d.createElement("select"); sel.style.fontSize = "0.8rem"; d.body.appendChild(sel);
    try {
      expect(getComputedStyle(i).fontSize).toBe("16px");
      expect(getComputedStyle(sel).fontSize).toBe("16px");
      expect(getComputedStyle(c).fontSize).toBe("13px");
    } finally { d.documentElement.classList.remove("af-rd"); st.remove(); i.remove(); c.remove(); sel.remove(); }
  });
  it("phone body text at 15px: Lighthouse overview cards, school-info hint, Maintenance banners and next-due hint", function () {
    var app = fs.readFileSync("src/App.jsx", "utf8");
    var v = fs.readFileSync("src/components/AnchorVault.jsx", "utf8");
    expect(app).toContain('{open && <div style={lhIn({ fontSize:REDESIGN?"15px":"0.83rem"');
    expect(app).toContain('<div style={lhIn({ fontSize:"15px", color:"#7a7568", margin:"-0.3rem 0 0.6rem" })}>Where to find a login');
    expect(v).toContain('style:{fontSize:vc?15:13,color:vc?"rgba(250,248,244,0.85)"');
    expect((v.match(/gap:9,fontSize:vc\?15:12,/g) || []).length).toBe(2);
  });
  it("the safety net really applies in the browser engine (jsdom cascade)", function () {
    var d = document;
    var st = d.createElement("style"); st.textContent = redesignTypeCss(); d.head.appendChild(st);
    d.documentElement.classList.add("af-rd");
    var el = d.createElement("div"); el.style.fontFamily = "'Cormorant Garamond', serif"; el.style.fontSize = "14px"; d.body.appendChild(el);
    var big = d.createElement("div"); big.style.fontFamily = "'Cormorant Garamond', serif"; big.style.fontSize = "22px"; d.body.appendChild(big);
    try {
      expect(getComputedStyle(el).fontFamily).toContain("Lato");
      expect(getComputedStyle(el).fontWeight).toBe("700");
      expect(getComputedStyle(big).fontFamily).toContain("Playfair Display");
    } finally { d.documentElement.classList.remove("af-rd"); st.remove(); el.remove(); big.remove(); }
  });
  it("new-look screens never set Playfair below 18px in source", function () {
    var files = fs.readdirSync("src/redesign").filter(function (f) { return /\.jsx?$/.test(f); }).map(function (f) { return "src/redesign/" + f; })
      .concat(["src/shell/CompassPanel.jsx", "src/shell/TopNav.jsx", "src/shell/AppFooter.jsx"]);
    var bad = [];
    files.forEach(function (f) {
      var src = fs.readFileSync(f, "utf8");
      (src.match(/\{[^{}]*\}/g) || []).forEach(function (b) {
        if (!/fontFamily: ?(font\.heading|HEAD|font\.anchor\.heading)\b/.test(b)) return;
        var m = /fontSize: ?"?([0-9.]+)(px|rem)?"?/.exec(b);
        if (!m) return;
        var px = parseFloat(m[1]) * (m[2] === "rem" ? 16 : 1);
        if (px < 18) bad.push(f + ": " + b.slice(0, 80));
      });
    });
    expect(bad).toEqual([]);
  });
});
