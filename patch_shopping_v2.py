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

# ── 1. SHOPPING_V2 module-level flag ─────────────────────────────────────────
results.append(swap(APP,
'const APP_VERSION = "2026-06-03-vault-refresh";',
'const APP_VERSION = "2026-06-03-vault-refresh";\nvar SHOPPING_V2 = localStorage.getItem("af_shopping_v2") === "true";',
"1. SHOPPING_V2 module-level flag"))

# ── 2. pendingOps + shopUserId + Realtime useEffect inside ShoppingTab ────────
results.append(swap(APP,
'    const recognitionRef=useRef(null);\n    const photoInputRef=useRef(null);\n\n    // Normalize store name from old free-text to fixed store id',
'''    const recognitionRef=useRef(null);
    const photoInputRef=useRef(null);
    var pendingOps=useRef(new Set());
    function shopUserId(){try{var _u=JSON.parse(localStorage.getItem("af_authUser")||"null");return(_u&&_u.id)?_u.id:"";}catch(e){return "";}}

    useEffect(function(){
      if(!SHOPPING_V2||!householdId)return;
      var channel=supabase.channel("shopping-"+householdId)
        .on("postgres_changes",{event:"*",schema:"public",table:"shopping_items",filter:"household_id=eq."+householdId},function(payload){
          var et=payload.eventType;
          if(et==="INSERT"){
            var ins=payload.new;
            if(!ins||!ins.id)return;
            setShoppingItems(function(prev){
              if(prev.some(function(x){return x.id===ins.id;}))return prev;
              return prev.concat([{id:ins.id,text:ins.text||"",store:ins.store||"Grocery",done:!!ins.done,category:ins.category||"",photo:ins.photo||null}]);
            });
          } else if(et==="UPDATE"){
            var upd=payload.new;
            if(!upd||!upd.id)return;
            var toggleKey=upd.id+":"+String(upd.done);
            var editKey=upd.id+":UPDATE";
            if(pendingOps.current.has(toggleKey)){pendingOps.current.delete(toggleKey);return;}
            if(pendingOps.current.has(editKey)){pendingOps.current.delete(editKey);return;}
            setShoppingItems(function(prev){
              return prev.map(function(x){return x.id===upd.id?{id:x.id,text:upd.text||"",store:upd.store||"Grocery",done:!!upd.done,category:upd.category||"",photo:upd.photo||null}:x;});
            });
          } else if(et==="DELETE"){
            var delId=payload.old&&payload.old.id;
            if(!delId)return;
            var delKey=delId+":DELETE";
            if(pendingOps.current.has(delKey)){pendingOps.current.delete(delKey);return;}
            setShoppingItems(function(prev){return prev.filter(function(x){return x.id!==delId;});});
          }
        }).subscribe();
      return function(){supabase.removeChannel(channel);};
    },[householdId]);

    // Normalize store name from old free-text to fixed store id''',
"2. pendingOps + shopUserId + Realtime useEffect"))

# ── 3. named handlers (handleToggle/Delete/Save) + modified addItem ───────────
results.append(swap(APP,
'''    function addItem(text,store,photoUrl){
      if(!text.trim())return;
      var s=store||newStore;
      setShoppingItems(p=>[...p,{id:uid(),text:text.trim(),store:s,done:false,photo:photoUrl||null,category:""}]);
      lastStore[1](s);setNewStore(s);
    }''',
'''    function handleToggle(id){
      var cur=shoppingItems.find(function(x){return x.id===id;});
      if(!cur)return;
      var newDone=!cur.done;
      setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,done:newDone}:x;});});
      if(SHOPPING_V2&&householdId){
        pendingOps.current.add(id+":"+String(newDone));
        supabase.rpc("shopping_toggle_item",{p_id:id,p_household_id:householdId,p_done:newDone,p_updated_by:shopUserId()}).then(function(r){if(r&&r.error){pendingOps.current.delete(id+":"+String(newDone));setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,done:!newDone}:x;});});}});
      }
    }
    function handleDelete(id){
      setShoppingItems(function(p){return p.filter(function(x){return x.id!==id;});});
      if(SHOPPING_V2&&householdId){
        pendingOps.current.add(id+":DELETE");
        supabase.rpc("shopping_delete_item",{p_id:id,p_household_id:householdId,p_updated_by:shopUserId()}).then(function(r){if(r&&r.error)pendingOps.current.delete(id+":DELETE");});
      }
    }
    function handleSave(id,val){
      var cur=shoppingItems.find(function(x){return x.id===id;})||{store:"Grocery",category:"",photo:null};
      setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,text:val}:x;});});
      if(SHOPPING_V2&&householdId){
        pendingOps.current.add(id+":UPDATE");
        supabase.rpc("shopping_update_item",{p_id:id,p_household_id:householdId,p_text:val,p_store:cur.store||"Grocery",p_category:cur.category||"",p_photo:cur.photo||"",p_updated_by:shopUserId()}).then(function(r){if(r&&r.error)pendingOps.current.delete(id+":UPDATE");});
      }
    }
    function addItem(text,store,photoUrl){
      if(!text.trim())return;
      var s=store||newStore;
      var _id=uid();
      setShoppingItems(p=>[...p,{id:_id,text:text.trim(),store:s,done:false,photo:photoUrl||null,category:""}]);
      lastStore[1](s);setNewStore(s);
      if(SHOPPING_V2&&householdId){
        supabase.rpc("shopping_add_item",{p_id:_id,p_household_id:householdId,p_text:text.trim(),p_store:s,p_category:"",p_photo:photoUrl||"",p_created_by:shopUserId()}).then(function(r){if(r&&r.error)console.warn("[AF] shopping_add_item failed:",r.error.message);});
      }
    }''',
"3. handleToggle + handleDelete + handleSave + addItem V2"))

# ── 4. deleteSelected with V2 bulk-delete branch ──────────────────────────────
results.append(swap(APP,
'    function deleteSelected(){setShoppingItems(p=>p.filter(i=>!selectedItems[i.id]));setSelectedItems({});}',
'''    function deleteSelected(){
      if(SHOPPING_V2&&householdId){
        var toDelete=Object.keys(selectedItems).filter(function(id){return selectedItems[id];});
        toDelete.forEach(function(id){
          pendingOps.current.add(id+":DELETE");
          supabase.rpc("shopping_delete_item",{p_id:id,p_household_id:householdId,p_updated_by:shopUserId()}).then(function(r){if(r&&r.error)pendingOps.current.delete(id+":DELETE");});
        });
      }
      setShoppingItems(function(p){return p.filter(function(i){return !selectedItems[i.id];});});
      setSelectedItems({});
    }''',
"4. deleteSelected V2 bulk-delete"))

# ── 5. checkSelected with V2 bulk-toggle branch ───────────────────────────────
results.append(swap(APP,
'    function checkSelected(){setShoppingItems(p=>p.map(i=>selectedItems[i.id]?{...i,done:true}:i));setSelectedItems({});}',
'''    function checkSelected(){
      if(SHOPPING_V2&&householdId){
        var toCheck=Object.keys(selectedItems).filter(function(id){return selectedItems[id];});
        toCheck.forEach(function(id){
          pendingOps.current.add(id+":true");
          supabase.rpc("shopping_toggle_item",{p_id:id,p_household_id:householdId,p_done:true,p_updated_by:shopUserId()}).then(function(r){if(r&&r.error)pendingOps.current.delete(id+":true");});
        });
      }
      setShoppingItems(function(p){return p.map(function(i){return selectedItems[i.id]?{...i,done:true}:i;});});
      setSelectedItems({});
    }''',
"5. checkSelected V2 bulk-toggle"))

# ── 6. hasCats path: inline lambdas → named handlers ─────────────────────────
results.append(swap(APP,
'                                    <ShopItemRow key={item.id} item={item} selected={!!selectedItems[item.id]} onSelect={toggleSelect}\n                                      onToggle={function(id){setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,done:!x.done}:x;});});}}\n                                      onDelete={function(id){setShoppingItems(function(p){return p.filter(function(x){return x.id!==id;});});}}\n                                      onSave={function(id,val){setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,text:val}:x;});});}}\n                                    />',
'                                    <ShopItemRow key={item.id} item={item} selected={!!selectedItems[item.id]} onSelect={toggleSelect}\n                                      onToggle={handleToggle}\n                                      onDelete={handleDelete}\n                                      onSave={handleSave}\n                                    />',
"6. hasCats JSX: inline lambdas → named handlers"))

# ── 7. non-hasCats path: inline lambdas → named handlers ─────────────────────
results.append(swap(APP,
'                            <ShopItemRow key={item.id} item={item} selected={!!selectedItems[item.id]} onSelect={toggleSelect}\n                              onToggle={function(id){setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,done:!x.done}:x;});});}}\n                              onDelete={function(id){setShoppingItems(function(p){return p.filter(function(x){return x.id!==id;});});}}\n                              onSave={function(id,val){setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,text:val}:x;});});}}\n                            />',
'                            <ShopItemRow key={item.id} item={item} selected={!!selectedItems[item.id]} onSelect={toggleSelect}\n                              onToggle={handleToggle}\n                              onDelete={handleDelete}\n                              onSave={handleSave}\n                            />',
"7. non-hasCats JSX: inline lambdas → named handlers"))

passed = sum(1 for r in results if r)
total  = len(results)
print(f"\nApplied: {passed} of {total}")
sys.exit(0 if passed == total else 1)
