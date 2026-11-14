// src/redesign/ShoppingFull.jsx — redesigned Shopping full view (af_redesign).
// Rendered by HomeFlow's ShoppingTab closure, which keeps all state and every
// write (blob + shopping_* RPCs when af_shopping_v2 is on); this file is
// markup only. Sub-sections: one pill per store (the selected pill is also
// where new items go, same as the legacy store chips). In-store mode shows
// the store's list as large tap targets grouped by aisle.
import { useState } from "react";
import { radius, shadow, font } from "../design/tokens.js";
import { FullViewPage, FullViewHeader, PillTabs, Card, CheckRow, CheckCircle, SectionLabel, Empty, PillButton } from "./FullView.jsx";
import { inputStyle, emoPrefix, NAVY, MUTED, HAIRLINE, wrapText } from "./fullViewKit.js";
import { groupByAisle } from "./fullViewData.js";

function ShopRow(props) {
  var it = props.item;
  var [editing, setEditing] = useState(false);
  var [val, setVal] = useState(it.text || "");
  var [showPhoto, setShowPhoto] = useState(false);
  if (editing) {
    return (
      <div data-testid={"shop-item-" + it.id} style={{ padding: "10px 0", borderTop: props.first ? "none" : "1px solid " + HAIRLINE, display: "flex", flexDirection: "column", gap: 8 }}>
        <input autoFocus value={val} aria-label="Edit item" onChange={function (e) { setVal(e.target.value); }}
          onKeyDown={function (e) { if (e.key === "Enter") { props.onSave(it.id, val); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
          style={inputStyle} />
        {props.stores.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: MUTED }}>Move to</span>
            {props.stores.filter(function (s) { return s.label !== props.storeLabel; }).map(function (s) {
              return <PillButton key={s.id} small variant="secondary" onClick={function () { props.onMove(it.id, s.label); setEditing(false); }}>{s.label}</PillButton>;
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PillButton small onClick={function () { props.onSave(it.id, val); setEditing(false); }}>Save</PillButton>
          <PillButton small variant="secondary" onClick={function () { setEditing(false); }}>Cancel</PillButton>
          <PillButton small variant="ghost" style={{ color: "#8F4F44" }} onClick={function () { props.onDelete(it.id); }}>Delete</PillButton>
        </div>
      </div>
    );
  }
  return (
    <div data-testid={"shop-item-" + it.id}>
      <CheckRow first={props.first} done={it.done} text={it.text}
        onToggle={function () { props.onToggle(it.id, it.done); }}
        right={
          <>
            {it.photo && <button type="button" aria-label="Toggle item photo" onClick={function () { setShowPhoto(function (v) { return !v; }); }} style={{ width: 28, height: 28, padding: 0, border: "none", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "none" }}><img src={it.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></button>}
            <button type="button" aria-label={"Edit " + it.text} onClick={function () { setVal(it.text || ""); setEditing(true); }} style={{ background: "none", border: "none", padding: "4px 6px", cursor: "pointer", color: MUTED, fontFamily: font.body, fontSize: 12.5, fontWeight: 600 }}>Edit</button>
            <button type="button" aria-label={"Delete " + it.text} onClick={function () { props.onDelete(it.id); }} style={{ background: "none", border: "none", padding: "4px 6px", cursor: "pointer", color: MUTED, fontSize: 17, lineHeight: 1 }}>×</button>
          </>
        } />
      {showPhoto && it.photo && <img src={it.photo} alt={it.text} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: radius.sm, marginBottom: 8 }} />}
    </div>
  );
}

function CategoryEditor(props) {
  var [name, setName] = useState("");
  var cats = props.categories || [];
  function update(fn) { props.setCategories(fn); }
  function add() {
    var n = name.trim();
    if (!n) return;
    update(function (p) { return p.concat([{ id: n.toLowerCase().replace(/\s+/g, "_"), label: n, emoji: "📦" }]); });
    setName("");
  }
  return (
    <Card title="Aisles" right={<PillButton small variant="ghost" onClick={props.onClose}>Done</PillButton>}>
      <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 6 }}>Subcategories for Grocery and Costco, in store order.</div>
      {cats.map(function (c, ci) {
        var label = props.catLabel(c), em = props.catEmoji(c);
        return (
          <div key={props.catId(c) || label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderTop: ci ? "1px solid " + HAIRLINE : "none" }}>
            {props.showEmojis && <input aria-label="Aisle emoji" value={em} onChange={function (e) { var v = e.target.value; update(function (p) { return p.map(function (x, i) { return i === ci ? (typeof x === "string" ? { id: x, label: x, emoji: v } : Object.assign({}, x, { emoji: v })) : x; }); }); }} style={Object.assign({}, inputStyle, { width: 44, padding: "6px", textAlign: "center" })} />}
            <input aria-label="Aisle name" value={label} onChange={function (e) { var v = e.target.value; update(function (p) { return p.map(function (x, i) { return i === ci ? (typeof x === "string" ? { id: v, label: v, emoji: "" } : Object.assign({}, x, { label: v })) : x; }); }); }} style={Object.assign({}, inputStyle, { flex: 1, padding: "6px 10px", fontSize: 14 })} />
            <button type="button" aria-label="Move up" onClick={function () { update(function (p) { var a = p.slice(); if (ci > 0) { var t = a[ci - 1]; a[ci - 1] = a[ci]; a[ci] = t; } return a; }); }} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 4 }}>↑</button>
            <button type="button" aria-label="Move down" onClick={function () { update(function (p) { var a = p.slice(); if (ci < a.length - 1) { var t = a[ci + 1]; a[ci + 1] = a[ci]; a[ci] = t; } return a; }); }} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 4 }}>↓</button>
            <button type="button" aria-label={"Remove " + label} onClick={function () { update(function (p) { return p.filter(function (_, i) { return i !== ci; }); }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8F4F44", padding: 4, fontSize: 16 }}>×</button>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={name} placeholder="New aisle…" aria-label="New aisle" onChange={function (e) { setName(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") add(); }} style={Object.assign({}, inputStyle, { flex: 1 })} />
        <PillButton onClick={add}>Add</PillButton>
      </div>
    </Card>
  );
}

function InStore(props) {
  var se = props.showEmojis;
  var open = props.items.filter(function (i) { return !i.done; });
  var done = props.items.filter(function (i) { return i.done; });
  var aisles = props.store.hasCats ? groupByAisle(open, props.categories, props.catLabel, props.catEmoji) : [{ key: "all", label: null, items: open }];
  function big(it) {
    return (
      <button key={it.id} type="button" aria-pressed={!!it.done} data-testid={"instore-item-" + it.id} onClick={function () { props.onToggle(it.id, it.done); }}
        style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", boxSizing: "border-box", minHeight: 56, background: "#FFFFFF", border: "none", borderRadius: radius.md, boxShadow: shadow.card, padding: "12px 16px", marginBottom: 8, textAlign: "left", cursor: "pointer", fontFamily: font.body, fontSize: 17, color: NAVY, opacity: it.done ? 0.45 : 1, textDecoration: it.done ? "line-through" : "none" }}>
        <CheckCircle decorative done={it.done} />
        <span style={wrapText}>{it.text}</span>
      </button>
    );
  }
  return (
    <div data-testid="in-store" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {!open.length && <Card><Empty>{done.length ? "Everything's in the cart." : "Nothing on the " + props.store.label + " list."}</Empty></Card>}
      {aisles.map(function (a) {
        if (!a.items.length) return null;
        return (
          <div key={a.key}>
            {a.label && <SectionLabel>{emoPrefix(se, a.emoji) + a.label}</SectionLabel>}
            {a.items.map(big)}
          </div>
        );
      })}
      {done.length > 0 && (
        <div>
          <SectionLabel>{"In the cart · " + done.length}</SectionLabel>
          {done.map(big)}
        </div>
      )}
    </div>
  );
}

export default function ShoppingFull(props) {
  var se = props.showEmojis === true;
  var [inStore, setInStore] = useState(false);
  var [showCats, setShowCats] = useState(false);
  var [draft, setDraft] = useState("");
  var items = props.items || [];
  var stores = props.stores || [];
  var store = stores.filter(function (s) { return s.label === props.activeStore; })[0] || stores[0] || { id: "grocery", label: props.activeStore || "Grocery", hasCats: true };
  var storeItems = items.filter(function (i) { return props.normalizeStore(i.store) === store.label; });
  var left = items.filter(function (i) { return !i.done; }).length;
  var storeOpen = storeItems.filter(function (i) { return !i.done; });
  var storeDone = storeItems.filter(function (i) { return i.done; });
  var tabs = stores.map(function (s) {
    var n = items.filter(function (i) { return !i.done && props.normalizeStore(i.store) === s.label; }).length;
    return { id: s.label, label: s.label, emoji: s.emoji, count: n || null };
  });

  function add() {
    if (!draft.trim()) return;
    props.onAdd(draft, store.label);
    setDraft("");
  }

  var subtitle = left === 0 ? "All caught up — nothing left to buy." : left + " item" + (left === 1 ? "" : "s") + " left" + (inStore ? " · in-store mode" : " across " + tabs.filter(function (t) { return t.count; }).length + " store" + (tabs.filter(function (t) { return t.count; }).length === 1 ? "" : "s"));

  var listBody;
  if (!storeItems.length) {
    listBody = <Empty>{"Nothing on the " + store.label + " list."}</Empty>;
  } else if (store.hasCats) {
    var groups = groupByAisle(props.sort(storeOpen), props.categories, props.catLabel, props.catEmoji);
    listBody = (
      <div>
        {groups.map(function (g, gi) {
          return (
            <div key={g.key}>
              <SectionLabel style={gi === 0 ? { marginTop: 0 } : null}>{emoPrefix(se, g.emoji) + g.label}</SectionLabel>
              {g.items.map(function (it, i) { return <ShopRow key={it.id} item={it} first={i === 0} stores={stores} storeLabel={store.label} onToggle={props.onToggle} onDelete={props.onDelete} onSave={props.onSave} onMove={props.onMove} />; })}
            </div>
          );
        })}
        {storeDone.length > 0 && (
          <div>
            <SectionLabel>{"Done · " + storeDone.length}</SectionLabel>
            {props.sort(storeDone).map(function (it, i) { return <ShopRow key={it.id} item={it} first={i === 0} stores={stores} storeLabel={store.label} onToggle={props.onToggle} onDelete={props.onDelete} onSave={props.onSave} onMove={props.onMove} />; })}
          </div>
        )}
      </div>
    );
  } else {
    var ordered = props.sort(storeOpen).concat(props.sort(storeDone));
    listBody = <div>{ordered.map(function (it, i) { return <ShopRow key={it.id} item={it} first={i === 0} stores={stores} storeLabel={store.label} onToggle={props.onToggle} onDelete={props.onDelete} onSave={props.onSave} onMove={props.onMove} />; })}</div>;
  }

  return (
    <FullViewPage testId="redesign-shopping">
      <FullViewHeader title="Shopping" emoji="🛒" showEmojis={se} subtitle={subtitle}
        action={items.length > 0 ? (
          inStore
            ? <PillButton testId="instore-exit" onClick={function () { setInStore(false); }}>Done shopping</PillButton>
            : <PillButton testId="instore-enter" onClick={function () { setInStore(true); }}>In-store mode</PillButton>
        ) : null} />

      <PillTabs label="Stores" tabs={tabs} value={store.label} showEmojis={se} testIdPrefix="store-" onChange={props.onSelectStore} />

      {inStore ? (
        <InStore store={store} items={props.sort(storeItems)} categories={props.categories} catLabel={props.catLabel} catEmoji={props.catEmoji} onToggle={props.onToggle} showEmojis={se} />
      ) : (
        <>
          <Card testId="shop-add">
            <div style={{ display: "flex", gap: 8 }}>
              <input value={draft} aria-label={"Add to " + store.label} placeholder={"Add to " + store.label + "…"}
                onChange={function (e) { setDraft(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") add(); }}
                style={Object.assign({}, inputStyle, { flex: 1 })} />
              <PillButton testId="shop-add-btn" onClick={add}>Add</PillButton>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              <PillButton small variant="secondary" onClick={props.voice.listening ? props.voice.stop : props.voice.start}>{props.voice.listening ? "Stop listening" : emoPrefix(se, "🎙️") + "Speak"}</PillButton>
              <PillButton small variant="secondary" disabled={props.photo.busy} onClick={props.photo.pick}>{props.photo.busy ? "Reading photo…" : emoPrefix(se, "📷") + "Photo"}</PillButton>
              {store.hasCats && <PillButton small variant="secondary" disabled={props.autoSort.busy} onClick={props.autoSort.run}>{props.autoSort.busy ? "Sorting…" : emoPrefix(se, "✨") + "Sort into aisles"}</PillButton>}
              <PillButton small variant={props.az ? "primary" : "secondary"} onClick={props.toggleAZ}>A–Z</PillButton>
            </div>
            {props.status && <div role="status" style={{ marginTop: 8, fontSize: 12.5, color: MUTED }}>{props.status}</div>}
            {props.photoInput}
          </Card>

          <Card testId="shop-list" title={emoPrefix(se, store.emoji) + store.label}
            right={storeDone.length > 0 ? <PillButton small variant="ghost" onClick={function () { props.onClearCompleted(store.label); }}>Clear done</PillButton> : null}>
            {listBody}
          </Card>

          {showCats
            ? <CategoryEditor categories={props.categories} setCategories={props.setCategories} catLabel={props.catLabel} catEmoji={props.catEmoji} catId={props.catId} showEmojis={se} onClose={function () { setShowCats(false); }} />
            : null}

          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            {!showCats && <PillButton small variant="ghost" onClick={function () { setShowCats(true); }}>Edit aisles</PillButton>}
            {items.length > 0 && <PillButton small variant="ghost" style={{ color: MUTED }} onClick={props.onClearAll}>Clear whole list</PillButton>}
          </div>
        </>
      )}
      {props.footer}
    </FullViewPage>
  );
}
