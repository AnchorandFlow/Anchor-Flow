#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch: wrap AuthModal inputs in a <form> element.
- Silences Chrome "password field not in form" console warning
- Enter-to-submit now works natively via onSubmit
- Buttons inside the form get type="button" so they don't accidentally submit
Run from repo root:  python3 patch_auth_form.py
"""

PATH = "src/App.jsx"

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

def swap(old, new, label):
    global src
    count = src.count(old)
    if count != 1:
        raise SystemExit("FAILED [" + label + "]: anchor found " + str(count) + " times (need exactly 1). No changes written.")
    src = src.replace(old, new)
    print("OK  [" + label + "]")

# ── 1. Open the <form> just before the hidden anti-autofill fields ──────────
swap(
    '        {/* Hidden fake fields to defeat browser autofill */}\n'
    '        <input type="text" style={{display:"none"}} autoComplete="username"/>',
    '        <form onSubmit={e=>{e.preventDefault();handleSubmit();}}>\n'
    '        {/* Hidden fake fields to defeat browser autofill */}\n'
    '        <input type="text" style={{display:"none"}} autoComplete="username"/>',
    "open form"
)

# ── 2. "Switch to Sign In" button is inside the form -> type=button ─────────
swap(
    '              <button onClick={()=>switchMode("signin")} style={{display:"block",marginTop:"0.4rem",',
    '              <button type="button" onClick={()=>switchMode("signin")} style={{display:"block",marginTop:"0.4rem",',
    "guard switch-mode button"
)

# ── 3. Main button becomes the form submit ──────────────────────────────────
swap(
    '        <button onClick={handleSubmit} disabled={loading} style={btnP(',
    '        <button type="submit" disabled={loading} style={btnP(',
    "submit button"
)

# ── 4. Close the </form> right after the submit button ──────────────────────
swap(
    '          {loading ? (mode==="reset"?"Sending\u2026":mode==="signin"?"Signing in\u2026":"Creating account\u2026") : mode==="reset" ? "Send Reset Email" : mode==="signin" ? "Sign In" : "Create Account"}\n'
    '        </button>\n',
    '          {loading ? (mode==="reset"?"Sending\u2026":mode==="signin"?"Signing in\u2026":"Creating account\u2026") : mode==="reset" ? "Send Reset Email" : mode==="signin" ? "Sign In" : "Create Account"}\n'
    '        </button>\n'
    '        </form>\n',
    "close form"
)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(src)

print("\nAll 4 swaps applied. Next steps:")
print("  npx esbuild src/App.jsx --target=es2019 --loader:.jsx=jsx --outfile=/dev/null")
print('  ./deploy.sh "wrap auth inputs in form element"')
