#!/usr/bin/env python3
import sys

def swap(path, old, new, label):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        count = content.count(old)
        if count == 0:
            print(f"✗ {label} — anchor not found in {path}")
            return False
        if count > 1:
            print(f"✗ {label} — anchor appears {count} times (not unique) in {path}")
            return False
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content.replace(old, new, 1))
        print(f"✓ {label}")
        return True
    except Exception as e:
        print(f"✗ {label} — {e}")
        return False

results = []
APP = "src/App.jsx"

# ── A. Add drag state to ShoppingTab ────────────────────────────────────────
# After pendingOps ref and shopUserId function declaration (line ~7333)
results.append(swap(APP,
'    var pendingOps=useRef(new Set());\n    function shopUserId(){try{var _u=JSON.parse(localStorage.getItem("af_authUser")||"null");return(_u&&_u.id)?_u.id:"";}catch(e){return "";}}',
'    var pendingOps=useRef(new Set());\n    var shopDrag=useRef({id:null,clone:null,fromStore:null,overStore:null});\n    var [shopDraggingId,setShopDraggingId]=useState(null);\n    var [shopDragOverStore,setShopDragOverStore]=useState(null);\n    function shopUserId(){try{var _u=JSON.parse(localStorage.getItem("af_authUser")||"null");return(_u&&_u.id)?_u.id:"";}catch(e){return "";}}',
"A. ShoppingTab: shopDrag ref + shopDraggingId + shopDragOverStore state"))

# ── B. Add handleMoveStore + shopPointerDown + useEffect before addItem ──────
results.append(swap(APP,
'    function addItem(text,store,photoUrl){',
'''    function handleMoveStore(id,targetStoreLabel){
      var cur=shoppingItems.find(function(x){return x.id===id;});
      if(!cur)return;
      setShoppingItems(function(p){return p.map(function(x){return x.id===id?Object.assign({},x,{store:targetStoreLabel,category:""}):x;});});
      if(SHOPPING_V2&&householdId){
        pendingOps.current.add(id+":UPDATE");
        supabase.rpc("shopping_update_item",{p_id:id,p_household_id:householdId,p_text:cur.text,p_store:targetStoreLabel,p_category:"",p_photo:cur.photo||"",p_updated_by:shopUserId()}).then(function(r){if(r&&r.error)pendingOps.current.delete(id+":UPDATE");});
      }
    }
    function shopPointerDown(e,id){
      if(e.button!==undefined&&e.button!==0)return;
      e.stopPropagation();
      var cur=shoppingItems.find(function(x){return x.id===id;});
      shopDrag.current.id=id;
      shopDrag.current.fromStore=cur?normalizeStore(cur.store):null;
      shopDrag.current.overStore=null;
      var srcEl=document.querySelector("[data-shopid='"+id+"']");
      if(srcEl){
        var clone=srcEl.cloneNode(true);
        clone.style.cssText="position:fixed;top:"+(e.clientY-20)+"px;left:"+(e.clientX-40)+"px;width:"+srcEl.offsetWidth+"px;opacity:0.85;background:white;boxShadow:0 4px 16px rgba(0,0,0,0.22);borderRadius:8px;zIndex:9999;pointerEvents:none;transition:none;";
        document.body.appendChild(clone);
        shopDrag.current.clone=clone;
      }
      setShopDraggingId(id);
    }
    useEffect(function(){
      if(!shopDraggingId)return;
      function onMove(e){
        if(shopDrag.current.clone){shopDrag.current.clone.style.top=(e.clientY-20)+"px";shopDrag.current.clone.style.left=(e.clientX-40)+"px";}
        var el=document.elementFromPoint(e.clientX,e.clientY);
        var storeEl=el&&el.closest("[data-shopstore]");
        var overStore=storeEl?storeEl.getAttribute("data-shopstore"):null;
        if(overStore!==shopDrag.current.overStore){shopDrag.current.overStore=overStore;setShopDragOverStore(overStore);}
      }
      function onUp(){
        if(shopDrag.current.clone){try{shopDrag.current.clone.remove();}catch(ex){}shopDrag.current.clone=null;}
        var overStore=shopDrag.current.overStore;
        var fromStore=shopDrag.current.fromStore;
        var dragId=shopDrag.current.id;
        shopDrag.current={id:null,clone:null,fromStore:null,overStore:null};
        setShopDraggingId(null);
        setShopDragOverStore(null);
        if(dragId&&overStore){
          var targetSt=FIXED_STORES.find(function(s){return s.id===overStore;});
          if(targetSt&&targetSt.label!==fromStore)handleMoveStore(dragId,targetSt.label);
        }
      }
      window.addEventListener("pointermove",onMove);
      window.addEventListener("pointerup",onUp);
      return function(){window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);};
    },[shopDraggingId]);
    function addItem(text,store,photoUrl){''',
"B. ShoppingTab: handleMoveStore + shopPointerDown + drag useEffect"))

# ── C. Add data-shopstore + drag-over highlight to store section outer div ───
results.append(swap(APP,
'              <div key={st.id} style={{...card({padding:"0",marginBottom:"0.65rem",border:"1.5px solid "+T.borderSoft})}}>\n                {/* Store header */}',
'              <div key={st.id} data-shopstore={st.id} style={{...card({padding:"0",marginBottom:"0.65rem",border:"1.5px solid "+(shopDragOverStore===st.id?"#4a7fa8":T.borderSoft),outline:shopDragOverStore===st.id?"2px solid #4a7fa8aa":"none",transition:"outline 0.1s,border 0.1s"})}}>\n                {/* Store header */}',
"C. Store section: data-shopstore + drag-over highlight"))

# ── D1. ShopItemRow: add onDragStart prop ────────────────────────────────────
results.append(swap(APP,
'  _hfRenders.ShopItemRow = function ShopItemRow({item, onToggle, onDelete, onSave}) {',
'  _hfRenders.ShopItemRow = function ShopItemRow({item, onToggle, onDelete, onSave, onDragStart}) {',
"D1. ShopItemRow: add onDragStart prop"))

# ── D2. ShopItemRow: add data-shopid to outer div ───────────────────────────
results.append(swap(APP,
'      <div style={{borderBottom:`1px solid ${T.borderSoft}`}}>',
'      <div data-shopid={item.id} style={{borderBottom:`1px solid ${T.borderSoft}`}}>',
"D2. ShopItemRow: data-shopid on outer div"))

# ── D3. ShopItemRow: add drag handle before checkbox ────────────────────────
results.append(swap(APP,
'            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.44rem 0"}}>\n              <button onClick={()=>onToggle(item.id,item.done)}',
'            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.44rem 0"}}>\n              {onDragStart&&<span onPointerDown={function(e){onDragStart(e,item.id);}} style={{cursor:"grab",color:T.textFaint,fontSize:"0.9rem",userSelect:"none",touchAction:"none",padding:"0 2px",flexShrink:0,lineHeight:1}}>⠿</span>}\n              <button onClick={()=>onToggle(item.id,item.done)}',
"D3. ShopItemRow: drag handle (⠿) before checkbox"))

# ── E. hasCats ShopItemRow: pass onDragStart ─────────────────────────────────
results.append(swap(APP,
'                                    <ShopItemRow key={item.id} item={item}\n                                      onToggle={handleToggle}\n                                      onDelete={handleDelete}\n                                      onSave={handleSave}\n                                    />',
'                                    <ShopItemRow key={item.id} item={item}\n                                      onToggle={handleToggle}\n                                      onDelete={handleDelete}\n                                      onSave={handleSave}\n                                      onDragStart={shopPointerDown}\n                                    />',
"E. hasCats ShopItemRow: pass onDragStart={shopPointerDown}"))

# ── F. non-hasCats ShopItemRow: pass onDragStart ─────────────────────────────
results.append(swap(APP,
'                            <ShopItemRow key={item.id} item={item}\n                              onToggle={handleToggle}\n                              onDelete={handleDelete}\n                              onSave={handleSave}\n                            />',
'                            <ShopItemRow key={item.id} item={item}\n                              onToggle={handleToggle}\n                              onDelete={handleDelete}\n                              onSave={handleSave}\n                              onDragStart={shopPointerDown}\n                            />',
"F. non-hasCats ShopItemRow: pass onDragStart={shopPointerDown}"))

passed = sum(1 for r in results if r)
total  = len(results)
print(f"\nApplied: {passed} of {total}")
sys.exit(0 if passed == total else 1)
