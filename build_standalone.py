#!/usr/bin/env python3
"""
build_standalone.py — generate a single offline-runnable standalone.html from the
canonical TypeScript source in src/.

No Node toolchain required. The script concatenates the modules in dependency
order, strips `import`/`export` (everything ends up in one scope), and embeds the
result. At page load, vendored @babel/standalone transpiles the TS/TSX in-browser
and runs it. React/ReactDOM are vendored UMD globals.

Run:  python build_standalone.py
Then: double-click standalone.html  (works fully offline)
"""
import re
import pathlib

ROOT = pathlib.Path(__file__).parent

# dependency order: core first, then leaf components, then the orchestrator
ORDER = [
    "src/core/singular.ts",
    "src/core/physics.ts",
    "src/core/simulation.ts",
    "src/core/schemas.ts",
    "src/core/export.ts",
    "src/core/geometry3d.ts",
    "src/core/camera.ts",
    "src/core/projection.ts",
    "src/core/colorRules.ts",
    "src/core/useElementSize.ts",
    "src/core/selfTest.ts",
    "src/components/DiagnosticsPanel.tsx",
    "src/components/EventLog.tsx",
    "src/components/VolumeLegend.tsx",
    "src/components/HoverInspector.tsx",
    "src/components/HelpOverlay.tsx",
    "src/components/SpacetimeCanvas.tsx",
    "src/components/AlphaPlaneCanvas.tsx",
    "src/components/ProjectionSpeedCanvas.tsx",
    "src/components/VWCorrelationFieldPanel.tsx",
    "src/components/Volume3DView.tsx",
    "src/components/LayerToggleGroup.tsx",
    "src/components/ControlPanel.tsx",
    "src/components/TimeParadoxLab.tsx",
]

# NOTE: anchored at line start (re.M) so the word "import"/"export" appearing
# inside a comment or string is never mistaken for a module statement.
IMPORT_FROM = re.compile(r"^import\s+[\s\S]*?from\s*['\"][^'\"]*['\"];", re.M)
IMPORT_BARE = re.compile(r"^import\s+['\"][^'\"]*['\"];", re.M)
EXPORT_KW = re.compile(r"^export\s+", re.M)


def strip_module_syntax(src: str) -> str:
    src = IMPORT_FROM.sub("", src)
    src = IMPORT_BARE.sub("", src)
    src = EXPORT_KW.sub("", src)
    return src


def build() -> str:
    parts = []
    for rel in ORDER:
        code = (ROOT / rel).read_text(encoding="utf-8")
        parts.append(f"// ===================== {rel} =====================\n" + strip_module_syntax(code))

    combined = (
        "const { useState, useRef, useEffect, useMemo, useCallback } = React;\n\n"
        + "\n\n".join(parts)
        + "\n\n// ===================== bootstrap =====================\n"
        + "ReactDOM.createRoot(document.getElementById('root')).render(\n"
        + "  React.createElement(TimeParadoxLab)\n"
        + ");\n"
    )

    # defensive: a literal </script> in source would close the host element early
    combined = re.sub(r"</script", "<\\/script", combined, flags=re.I)

    css = (ROOT / "src/styles.css").read_text(encoding="utf-8")

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>TimeParadoxLab — 5D Singularity Simulator (standalone)</title>
<style>
{css}
.boot-error {{ color:#ff6b6b; padding:24px; white-space:pre-wrap; font-family:ui-monospace,monospace; }}
.booting {{ color:#8ea4c6; padding:24px; font-family:ui-monospace,monospace; }}
</style>
</head>
<body>
<div id="root"><div class="booting">Compiling TimeParadoxLab in-browser (vendored Babel)…</div></div>

<!-- vendored, offline: React + ReactDOM + Three.js + Babel standalone -->
<script src="vendor/react.production.min.js"></script>
<script src="vendor/react-dom.production.min.js"></script>
<script src="vendor/three.min.js"></script>
<script src="vendor/babel.min.js"></script>

<!-- canonical TypeScript source (generated from src/) -->
<script type="text/plain" id="appsrc">
{combined}
</script>

<script>
(function () {{
  function fail(err) {{
    var root = document.getElementById('root');
    root.innerHTML = '<div class="boot-error">TimeParadoxLab failed to start:\\n\\n' +
      ((err && err.message) ? err.message : String(err)) + '</div>';
    console.error(err);
  }}
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {{
    return fail(new Error('Vendored React/ReactDOM not found. Keep the vendor/ folder next to this file.'));
  }}
  if (typeof Babel === 'undefined') {{
    return fail(new Error('Vendored Babel not found. Keep vendor/babel.min.js next to this file.'));
  }}
  if (typeof THREE === 'undefined') {{
    return fail(new Error('Vendored Three.js not found. Keep vendor/three.min.js next to this file.'));
  }}
  try {{
    var src = document.getElementById('appsrc').textContent;
    var out = Babel.transform(src, {{
      filename: 'TimeParadoxLab.tsx',
      presets: [
        ['typescript', {{ allExtensions: true, isTSX: true }}],
        ['react', {{ runtime: 'classic' }}]
      ]
    }}).code;
    new Function(out)();
  }} catch (err) {{
    fail(err);
  }}
}})();
</script>
</body>
</html>
"""
    return html


def main():
    html = build()
    out = ROOT / "standalone.html"
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out}  ({len(html):,} bytes)")


if __name__ == "__main__":
    main()
