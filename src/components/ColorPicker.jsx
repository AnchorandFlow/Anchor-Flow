import { useState, useRef, useEffect } from "react";

var RECENT_COLORS_KEY = "af_recent_colors";
var MAX_RECENT = 6;
var WHEEL_SIZE = 140;

function loadRecentColors() {
  try {
    var raw = localStorage.getItem(RECENT_COLORS_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(function(c) { return typeof c === "string"; }) : [];
  } catch (e) { return []; }
}

function saveRecentColor(hex) {
  try {
    var cur = loadRecentColors().filter(function(c) { return c.toLowerCase() !== hex.toLowerCase(); });
    var next = [hex].concat(cur).slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next));
    return next;
  } catch (e) { return loadRecentColors(); }
}

// h: 0-360, s/l: 0-100 → [r,g,b] 0-255
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  var k = function(n) { return (n + h / 30) % 12; };
  var a = s * Math.min(l, 1 - l);
  var f = function(n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function rgbToHex(r, g, b) {
  var toHex = function(x) { return x.toString(16).padStart(2, "0"); };
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function isValidHex(v) { return /^#[0-9a-fA-F]{6}$/.test(v); }

export default function ColorPicker(props) {
  var value = props.value || "#7a9e8e";
  var onChange = props.onChange || function() {};
  var size = props.size || 22;

  var [open, setOpen] = useState(false);
  var [recentColors, setRecentColors] = useState(loadRecentColors);
  var [hexInput, setHexInput] = useState(value);
  var canvasRef = useRef(null);
  var wrapRef = useRef(null);

  useEffect(function() { setHexInput(value); }, [value, open]);

  // Close on outside click.
  useEffect(function() {
    if (!open) return;
    function onDocDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return function() { document.removeEventListener("mousedown", onDocDown); };
  }, [open]);

  // Draw the HSL wheel — hue by angle, saturation by distance from center,
  // fixed lightness 50 so every point on the wheel is a fully "pickable" color.
  useEffect(function() {
    if (!open) return;
    var canvas = canvasRef.current;
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    var cx = w / 2, cy = h / 2, radius = Math.min(cx, cy);
    var imgData = ctx.createImageData(w, h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var dx = x - cx, dy = y - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var idx = (y * w + x) * 4;
        if (dist > radius) { imgData.data[idx + 3] = 0; continue; }
        var angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        var sat = (dist / radius) * 100;
        var rgb = hslToRgb(angle, sat, 50);
        imgData.data[idx] = rgb[0];
        imgData.data[idx + 1] = rgb[1];
        imgData.data[idx + 2] = rgb[2];
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [open]);

  function pickFromWheel(clientX, clientY) {
    var canvas = canvasRef.current;
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var cx = rect.width / 2, cy = rect.height / 2;
    var x = clientX - rect.left - cx;
    var y = clientY - rect.top - cy;
    var radius = Math.min(cx, cy);
    var dist = Math.min(Math.sqrt(x * x + y * y), radius);
    var angle = Math.atan2(y, x) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    var sat = (dist / radius) * 100;
    var rgb = hslToRgb(angle, sat, 50);
    var hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    onChange(hex);
    setHexInput(hex);
  }

  function onWheelPointerDown(e) {
    e.preventDefault();
    pickFromWheel(e.clientX, e.clientY);
    function onMove(ev) { pickFromWheel(ev.clientX, ev.clientY); }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleHexInput(v) {
    if (!v.startsWith("#")) v = "#" + v;
    setHexInput(v);
    if (isValidHex(v)) onChange(v);
  }

  function selectRecent(c) {
    onChange(c);
    setHexInput(c);
  }

  function handleDone() {
    setRecentColors(saveRecentColor(value));
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen(!open)} aria-label="Pick color" title="Pick color"
        style={{ width: size, height: size, borderRadius: "50%", background: value, border: "2px solid rgba(0,0,0,0.15)", cursor: "pointer", padding: 0, flexShrink: 0 }} />
      {open && (
        <div style={{ position: "absolute", zIndex: 1000, top: size + 6, left: 0, background: "var(--color-bg-primary,#fff)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.18)", width: 176 }}>
          {recentColors.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Recent</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {recentColors.slice(0, MAX_RECENT).map(function(c, i) {
                  var sel = value.toLowerCase() === c.toLowerCase();
                  return (
                    <button key={c + i} type="button" onClick={() => selectRecent(c)} title={c}
                      style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: sel ? "2px solid #333" : "2px solid transparent", cursor: "pointer", padding: 0, flexShrink: 0 }} />
                  );
                })}
              </div>
            </div>
          )}
          <canvas ref={canvasRef} width={WHEEL_SIZE} height={WHEEL_SIZE}
            onPointerDown={onWheelPointerDown}
            style={{ width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: "50%", display: "block", margin: "0 auto 10px", cursor: "crosshair", touchAction: "none" }} />
          <input value={hexInput} onChange={(e) => handleHexInput(e.target.value)}
            placeholder="#rrggbb" maxLength={7}
            style={{ width: "100%", boxSizing: "border-box", padding: "5px 8px", fontSize: 12, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 6, marginBottom: 10, fontFamily: "monospace", background: "var(--color-bg-primary,#fff)", color: "inherit" }} />
          <button type="button" onClick={handleDone}
            style={{ width: "100%", background: value, color: "#fff", border: "none", borderRadius: 7, padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Done</button>
        </div>
      )}
    </div>
  );
}
