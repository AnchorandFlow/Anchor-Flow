// src/redesign/exhaleModel.js — pure state changes for the redesigned Exhale
// screen (af_redesign). Operates on the EXISTING af_exhale_buckets shape:
//   { bucketNames: [5 names], items: [{ id, text, notes, bucketIndex,
//     createdAt, color, done?, archived?, ... }] }
// Fields used: bucketIndex (bucket), done (completion — the same field the
// current Today screen writes via writeExhaleBucketItemDone), text. Nothing
// new is added to items or to the key. Unknown item fields are preserved.
//
// Why not exhale_cards: those rows (and exhale_move_card / exhale_update_card)
// back the retired column board (af_exhale_groups); bucket items have never
// been exhale_cards rows. Bucket items sync across devices the same way the
// current Exhale screen syncs them: write af_exhale_buckets, mark it dirty,
// dispatch af-data-changed -> household push; other devices pull it.

export var LS_KEY = "af_exhale_buckets";
export var DEFAULT_BUCKET_NAMES = ["Exhaled", "Today", "Tomorrow", "This Weekend", "Someday"];
export var BUCKET_COLORS = ["#4A9E8E", "#6ABAAA", "#7AB3D4", "#8BAF8B", "#A99AC4"]; // = ExhaleSection
export var EXHALED = 0, TODAY = 1, TOMORROW = 2;
export var SWIPE_PX = 72; // horizontal drag needed to count as a swipe

export function normalize(b) {
  var names = b && Array.isArray(b.bucketNames) && b.bucketNames.length ? b.bucketNames : DEFAULT_BUCKET_NAMES.slice();
  var items = b && Array.isArray(b.items) ? b.items : [];
  return Object.assign({}, b || {}, { bucketNames: names, items: items });
}

export function bucketName(b, idx) {
  var n = b && b.bucketNames && b.bucketNames[idx];
  return typeof n === "string" && n.trim() ? n : DEFAULT_BUCKET_NAMES[idx];
}

// Same visibility rule as ExhaleSection.visibleBucketItems (archived and
// other people's private items hidden).
export function isVisible(it, myPersonId) {
  if (!it || it.archived) return false;
  if (it.private && it.createdBy && myPersonId && it.createdBy !== myPersonId) return false;
  return true;
}

// Open items keep their stored order; completed items go to the bottom.
export function bucketItems(b, idx, myPersonId) {
  var all = normalize(b).items.filter(function (it) { return isVisible(it, myPersonId) && it.bucketIndex === idx; });
  return all.filter(function (it) { return !it.done; }).concat(all.filter(function (it) { return !!it.done; }));
}

export function openCount(b, idx, myPersonId) {
  return bucketItems(b, idx, myPersonId).filter(function (it) { return !it.done; }).length;
}

function patchItem(b, id, patch) {
  var nb = normalize(b);
  var found = false;
  var items = nb.items.map(function (it) {
    if (it && it.id === id) { found = true; return Object.assign({}, it, patch); }
    return it;
  });
  return found ? Object.assign({}, nb, { items: items }) : nb;
}

function findItem(b, id) {
  return normalize(b).items.filter(function (it) { return it && it.id === id; })[0] || null;
}

export function toggleDone(b, id) {
  var it = findItem(b, id);
  if (!it) return normalize(b);
  return patchItem(b, id, { done: !it.done });
}

export function setDone(b, id, done) {
  return patchItem(b, id, { done: !!done });
}

export function moveTo(b, id, destIdx) {
  var it = findItem(b, id);
  if (!it || it.bucketIndex === destIdx) return normalize(b);
  return patchItem(b, id, { bucketIndex: destIdx });
}

// Empty text is not saved (the edit is cancelled instead).
export function editText(b, id, text) {
  var t = String(text || "").trim();
  var it = findItem(b, id);
  if (!it || !t || t === it.text) return normalize(b);
  return patchItem(b, id, { text: t });
}

// Same item shape as ExhaleSection.addBucketItem, prepended.
export function addItem(b, text, bucketIndex, makeId, now) {
  var t = String(text || "").trim();
  var nb = normalize(b);
  if (!t) return nb;
  var idx = bucketIndex == null ? EXHALED : bucketIndex;
  var item = { id: makeId(), text: t, notes: "", bucketIndex: idx, createdAt: now(), color: BUCKET_COLORS[idx % BUCKET_COLORS.length] };
  return Object.assign({}, nb, { items: [item].concat(nb.items) });
}

export function readBuckets(storage) {
  try { var v = JSON.parse((storage || localStorage).getItem(LS_KEY) || "null"); return normalize(v); } catch { return normalize(null); }
}

// Same write path as ExhaleSection.lsSet: write, dirty-mark, notify sync.
export function writeBuckets(nb, storage) {
  var s = storage || localStorage;
  try { s.setItem(LS_KEY, JSON.stringify(nb)); } catch { return; }
  try {
    var dirty = JSON.parse(s.getItem("af_dirtyKeys") || "[]");
    if (!Array.isArray(dirty)) dirty = [];
    if (dirty.indexOf("exhale_buckets") === -1) { dirty.push("exhale_buckets"); s.setItem("af_dirtyKeys", JSON.stringify(dirty)); }
  } catch { /* storage blocked */ }
  try { window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: "exhale_buckets" } })); } catch { /* no window */ }
}

// Read-modify-write against the LATEST stored value, so a change made
// elsewhere since this screen rendered (Sunset, Today, quick-add) is kept.
export function commit(fn, storage) {
  var next = fn(readBuckets(storage));
  writeBuckets(next, storage);
  return next;
}
