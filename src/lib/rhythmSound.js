// src/lib/rhythmSound.js — soft generated chimes for Rhythm (Web Audio; no
// audio files). Adapted from the Rhythm mockup: short sine tones with a gentle
// attack and an exponential fade. The context is created on the first tap
// (Start / Spin) because iOS Safari only allows audio after a user gesture.
var actx = null;

export function audioReady() {
  if (!actx) {
    try {
      var AC = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
      actx = AC ? new AC() : null;
    } catch { actx = null; }
  }
  try { if (actx && actx.state === "suspended") actx.resume(); } catch { /* ignore */ }
  return actx;
}

function tone(freq, start, dur, peak) {
  var c = actx;
  if (!c) return;
  try {
    var o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    var t0 = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak || 0.14, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch { /* audio unavailable */ }
}

export var chime = {
  work: function () { tone(523.25, 0, 0.9); tone(659.25, 0.10, 0.9); },
  brk: function () { tone(659.25, 0, 0.8); tone(783.99, 0.10, 0.9); },
  sticker: function () { tone(659.25, 0, 0.5); tone(987.77, 0.08, 0.6); },
  setDone: function () { tone(523.25, 0, 0.6); tone(659.25, 0.12, 0.6); tone(783.99, 0.24, 0.6); tone(1046.5, 0.36, 0.9); },
  allDone: function () { tone(523.25, 0, 0.7); tone(659.25, 0.14, 0.7); tone(783.99, 0.28, 1.0); tone(1046.5, 0.42, 1.1); },
  warn: function () { tone(440, 0, 0.5, 0.08); },
  tick: function () { tone(880, 0, 0.06, 0.05); },
};
