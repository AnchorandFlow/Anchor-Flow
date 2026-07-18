import os
APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "App.jsx")
with open(APP, "r") as f:
    code = f.read()
line = "import ExhaleSection from './components/ExhaleSection.jsx';\n"
if line in code:
    print("Import already present — nothing to do")
else:
    idx = code.index("import ")
    eol = code.index("\n", idx)
    code = code[:eol+1] + line + code[eol+1:]
    with open(APP, "w") as f:
        f.write(code)
    print("Done — import added")
