#!/usr/bin/env python3
"""
verify.py — offline verification without Node.

Uses the vendored Babel inside a small embedded JS engine (py_mini_racer) to:
  1. transpile the WHOLE UI bundle (catches any syntax error),
  2. execute the real TypeScript core + self-tests,
  3. server-render the full React tree (catches render-time errors),
     with React DOM Server + a minimal Three.js/DOM stub.

  pip install py_mini_racer
  python verify.py
"""
import json, pathlib, re, sys, urllib.request
from py_mini_racer import py_mini_racer

ROOT = pathlib.Path(__file__).parent
IMPORT_FROM = re.compile(r"^import\s+[\s\S]*?from\s*['\"][^'\"]*['\"];", re.M)
IMPORT_BARE = re.compile(r"^import\s+['\"][^'\"]*['\"];", re.M)
EXPORT_KW = re.compile(r"^export\s+", re.M)

def strip(s):
    s = IMPORT_FROM.sub("", s); s = IMPORT_BARE.sub("", s); s = EXPORT_KW.sub("", s)
    return s

def cat(files):
    return "\n".join(strip((ROOT / f).read_text(encoding="utf-8")) for f in files)

# dependency order (mirrors build_standalone.py)
FULL = [
    "src/core/singular.ts", "src/core/physics.ts", "src/core/simulation.ts",
    "src/core/schemas.ts", "src/core/export.ts", "src/core/geometry3d.ts",
    "src/core/camera.ts", "src/core/projection.ts", "src/core/colorRules.ts",
    "src/core/useElementSize.ts", "src/core/selfTest.ts",
    "src/components/DiagnosticsPanel.tsx", "src/components/EventLog.tsx",
    "src/components/VolumeLegend.tsx", "src/components/HoverInspector.tsx",
    "src/components/HelpOverlay.tsx", "src/components/SpacetimeCanvas.tsx",
    "src/components/AlphaPlaneCanvas.tsx", "src/components/ProjectionSpeedCanvas.tsx",
    "src/components/VWCorrelationFieldPanel.tsx", "src/components/Volume3DView.tsx",
    "src/components/LayerToggleGroup.tsx", "src/components/ControlPanel.tsx",
    "src/components/TimeParadoxLab.tsx",
]
# pure core only (no React/THREE) — runnable in a bare JS engine
CORE = [
    "src/core/singular.ts", "src/core/physics.ts", "src/core/simulation.ts",
    "src/core/schemas.ts", "src/core/export.ts", "src/core/geometry3d.ts",
    "src/core/camera.ts", "src/core/projection.ts", "src/core/colorRules.ts",
    "src/core/selfTest.ts",
]
TS_PRESET = "['typescript',{allExtensions:true,isTSX:true}]"
REACT_PRESET = "['react',{runtime:'classic'}]"

def transform(ctx, var, presets, src):
    ctx.eval(f"globalThis.{var}_src=" + json.dumps(src))
    ctx.eval(f"globalThis.{var}=Babel.transform({var}_src,{{filename:'a.tsx',sourceType:'script',presets:[{presets}]}}).code;''", timeout=90000)

def main():
    ctx = py_mini_racer.MiniRacer()
    print("loading babel…"); ctx.eval((ROOT / "vendor/babel.min.js").read_text(encoding="utf-8"))
    print("babel", ctx.eval("Babel.version"))

    # 1) transpile the full UI bundle
    full = "const {useState,useRef,useEffect,useMemo,useCallback}=React;\n" + cat(FULL)
    try:
        transform(ctx, "__full", f"{TS_PRESET},{REACT_PRESET}", full)
        print("FULL UI bundle transpiled OK — length", ctx.eval("__full.length"))
    except Exception as e:
        print("FULL TRANSPILE FAILED:\n", str(e)[:2500]); sys.exit(1)

    # 2) execute the real core + self-tests
    core = cat(CORE) + "\nglobalThis.__results=JSON.stringify(runSelfTests());\n"
    transform(ctx, "__core", TS_PRESET, core)
    ctx.eval("(0,eval)(globalThis.__core);")
    results = json.loads(ctx.eval("globalThis.__results"))
    passed = sum(1 for r in results if r["pass"])
    print(f"\n=== SELF-TESTS in V8: {passed}/{len(results)} passed ===")
    for r in results:
        print(("  OK  " if r["pass"] else "  XX  ") + r["name"] + ("" if r["pass"] else f"   [{r['detail']}]"))
    core_ok = passed == len(results)

    # 3) SSR render of the full tree
    rds = ROOT / "_rds.js"
    if not rds.exists():
        try:
            urllib.request.urlretrieve(
                "https://unpkg.com/react-dom@18.3.1/umd/react-dom-server-legacy.browser.production.min.js", rds)
        except Exception as e:
            print("\n(SSR render check skipped — could not fetch react-dom-server:", e, ")")
            sys.exit(0 if core_ok else 2)
    ctx.eval("globalThis.self=globalThis; globalThis.window=globalThis;"
             "globalThis.performance={now:function(){return 0}};"
             "globalThis.requestAnimationFrame=function(){return 0};globalThis.cancelAnimationFrame=function(){};"
             "globalThis.devicePixelRatio=1; globalThis.document={getElementById:function(){return {}}};"
             "globalThis.ResizeObserver=function(){this.observe=function(){};this.disconnect=function(){}};"
             "globalThis.THREE={Color:function(){},Vector2:function(){},Vector3:function(){},Scene:function(){},"
             "PerspectiveCamera:function(){},WebGLRenderer:function(){}};")
    ctx.eval((ROOT / "vendor/react.production.min.js").read_text(encoding="utf-8"))
    ctx.eval(rds.read_text(encoding="utf-8"))
    ssr = full + "\nglobalThis.__html=ReactDOMServer.renderToStaticMarkup(React.createElement(TimeParadoxLab));\n"
    transform(ctx, "__ssr", f"{TS_PRESET},{REACT_PRESET}", ssr)
    try:
        ctx.eval("(0,eval)(globalThis.__ssr);", timeout=30000)
    except Exception as e:
        print("\nSSR RENDER THREW:\n", str(e)[:2500]); sys.exit(1)
    html = ctx.eval("globalThis.__html")
    print("\nSSR render OK — markup length", len(html))
    needles = ["TimeParadoxLab 3D", "3D Volume", "Diagnostics", "Event log", "Controls",
               "Export JSON", "Isometric", "3D layers", "Run self-tests"]
    miss = [n for n in needles if n not in html]
    for n in needles:
        print(("  found  " if n not in miss else "  MISSING ") + n)
    sys.exit(0 if (core_ok and not miss) else 2)

if __name__ == "__main__":
    main()
