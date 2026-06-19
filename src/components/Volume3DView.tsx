/**
 * Volume3DView — the (x, t, α) volume rendered with plain Three.js.
 *
 * Layers (independently toggleable): axes box, grids, worldlines, signal path,
 * send/receive markers, singular loci planes α=±x, null surfaces from the send
 * event, slice shadows. Custom orbit/pan/zoom is derived from camera.ts (no
 * OrbitControls dependency). Hover/click raycasts markers for cross-panel
 * linking. Falls back to a readable message if WebGL is unavailable.
 *
 * THREE is imported for the Vite build and resolves to the vendored UMD global
 * in the offline standalone (the import line is stripped at build time).
 */
import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { Diagnostics, SimEvent } from '../core/simulation';
import { buildSceneGeometry, Vec3 } from '../core/geometry3d';
import { appearanceForValue, DOMAIN_COLORS } from '../core/colorRules';
import {
  SphericalCamera,
  CameraPreset,
  presetCamera,
  cameraPosition,
  clampElevation,
} from '../core/camera';

export interface LayerVisibility {
  axes: boolean;
  grids: boolean;
  loci: boolean;
  nullSurfaces: boolean;
  worldlines: boolean;
  signal: boolean;
  shadows: boolean;
  history: boolean;
}

export interface Volume3DViewProps {
  diag: Diagnostics;
  events: SimEvent[];
  progress: number;
  width: number;
  height: number;
  cameraPreset: CameraPreset;
  layerVisibility: LayerVisibility;
  selectedEventId: string | null;
  onSelectEvent?: (eventId: string | null) => void;
  onHoverText?: (text: string | null) => void;
  /** show the ordinary α=0 light-speed reference baseline (default true) */
  showLightBaseline?: boolean;
}

const hex = (c: string) => new THREE.Color(c);

export function Volume3DView(props: Volume3DViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  // persistent three objects / ephemeral state across renders
  const three = useRef<any>({});
  const cam = useRef<SphericalCamera>({ target: [2.5, 3, 0], radius: 26, azimuth: Math.PI * 0.28, elevation: Math.PI * 0.16 });
  const progressRef = useRef(props.progress);
  const diagRef = useRef(props.diag);
  const pulseRef = useRef(0);

  // ---- mount: renderer + scene + camera + input + animation loop ----------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: any;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e: any) {
      setWebglError(e?.message || 'WebGL is not available in this browser.');
      return;
    }
    if (!renderer || !renderer.getContext || !renderer.getContext()) {
      setWebglError('Could not acquire a WebGL context.');
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(props.width, props.height);
    renderer.setClearColor(0x070a11, 1);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.borderRadius = '10px';
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, props.width / props.height, 0.1, 1000);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(8, 14, 10);
    scene.add(dir);

    // layer groups
    const groups: Record<string, any> = {};
    for (const k of ['axes', 'grids', 'worldlines', 'signal', 'markers', 'loci', 'nullSurfaces', 'shadows', 'history', 'highlight']) {
      groups[k] = new THREE.Group();
      scene.add(groups[k]);
    }

    three.current = { renderer, scene, camera, groups, raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2() };
    buildScene();
    applyLayers();

    // ---- custom orbit / pan / zoom ----
    let dragging: 'orbit' | 'pan' | null = null;
    let lastX = 0, lastY = 0;
    const el = renderer.domElement;

    const onDown = (e: PointerEvent) => {
      dragging = e.button === 2 || e.shiftKey ? 'pan' : 'orbit';
      lastX = e.clientX; lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) { raycastHover(e); return; }
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      const c = cam.current;
      if (dragging === 'orbit') {
        c.azimuth -= dx * 0.01;
        c.elevation = clampElevation(c.elevation + dy * 0.01);
      } else {
        // pan target in the camera's screen plane
        const panScale = c.radius * 0.0016;
        const right: Vec3 = [Math.cos(c.azimuth - Math.PI / 2), 0, Math.sin(c.azimuth - Math.PI / 2)];
        c.target = [
          c.target[0] - right[0] * dx * panScale,
          c.target[1] + dy * panScale,
          c.target[2] - right[2] * dx * panScale,
        ];
      }
    };
    const onUp = (e: PointerEvent) => { dragging = null; try { el.releasePointerCapture(e.pointerId); } catch {} };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.current.radius = Math.max(4, Math.min(120, cam.current.radius * (1 + Math.sign(e.deltaY) * 0.08)));
    };
    const onContext = (e: Event) => e.preventDefault();
    const onClick = (e: PointerEvent) => raycastClick(e);

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContext);
    el.addEventListener('click', onClick);

    // ---- animation loop ----
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      pulseRef.current += dt;
      updateDynamic();
      const pos = cameraPosition(cam.current);
      camera.position.set(pos[0], pos[1], pos[2]);
      camera.lookAt(cam.current.target[0], cam.current.target[1], cam.current.target[2]);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContext);
      el.removeEventListener('click', onClick);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      three.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep refs fresh for the animation loop
  useEffect(() => { progressRef.current = props.progress; }, [props.progress]);

  // rebuild geometry when the diagnostics (or baseline toggle) change
  useEffect(() => {
    diagRef.current = props.diag;
    if (three.current.scene) { buildScene(); applyLayers(); recenterTarget(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.diag, props.showLightBaseline]);

  // resize
  useEffect(() => {
    const t = three.current;
    if (!t.renderer) return;
    t.renderer.setSize(props.width, props.height);
    t.camera.aspect = props.width / props.height;
    t.camera.updateProjectionMatrix();
  }, [props.width, props.height]);

  // camera preset
  useEffect(() => {
    const t = three.current;
    if (!t.scene) return;
    cam.current = presetCamera(props.cameraPreset, cam.current.target, cam.current.radius);
    if (props.cameraPreset === 'follow') recenterTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.cameraPreset]);

  // layers
  useEffect(() => { applyLayers(); /* eslint-disable-next-line */ }, [props.layerVisibility]);

  // selection highlight
  useEffect(() => { applyHighlight(); /* eslint-disable-next-line */ }, [props.selectedEventId, props.events]);

  // ---- scene builders ------------------------------------------------------

  function clearGroup(g: any) {
    while (g.children.length) {
      const c = g.children.pop();
      c.geometry?.dispose?.();
      c.material?.dispose?.();
    }
  }

  function lineMesh(points: Vec3[], color: string, width: number, dashed = false): any {
    const geo = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color: hex(color), dashSize: 0.5, gapSize: 0.3, linewidth: width })
      : new THREE.LineBasicMaterial({ color: hex(color), linewidth: width });
    const line = new THREE.Line(geo, mat);
    if (dashed) line.computeLineDistances();
    return line;
  }

  function quadMesh(positions: number[], indices: number[], color: string, opacity: number): any {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: hex(color), transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
    return new THREE.Mesh(geo, mat);
  }

  function buildScene() {
    const t = three.current;
    if (!t.scene) return;
    const diag = diagRef.current;
    const G = buildSceneGeometry(diag);
    const b = G.bounds;

    // axes box
    clearGroup(t.groups.axes);
    const box = new THREE.Box3(new THREE.Vector3(b.xMin, b.tMin, b.alphaMin), new THREE.Vector3(b.xMax, b.tMax, b.alphaMax));
    const boxHelper = new THREE.Box3Helper(box, hex('#2a3a5a'));
    t.groups.axes.add(boxHelper);
    // axis lines: x cyan, t white, alpha violet
    t.groups.axes.add(lineMesh([[b.xMin, b.tMin, 0], [b.xMax, b.tMin, 0]], '#3fd0ff', 2));
    t.groups.axes.add(lineMesh([[b.xMin, b.tMin, 0], [b.xMin, b.tMax, 0]], '#cfe0ff', 2));
    t.groups.axes.add(lineMesh([[b.xMin, b.tMin, b.alphaMin], [b.xMin, b.tMin, b.alphaMax]], '#aa78ff', 2));

    // grids on the three walls
    clearGroup(t.groups.grids);
    const gx = new THREE.GridHelper(Math.max(b.xMax - b.xMin, b.tMax - b.tMin), 12, 0x223049, 0x162032);
    gx.position.set((b.xMin + b.xMax) / 2, b.tMin, 0);
    t.groups.grids.add(gx);

    // worldlines
    clearGroup(t.groups.worldlines);
    t.groups.worldlines.add(lineMesh(G.worldlines[0].points, '#3fd0ff', 3)); // Bob
    t.groups.worldlines.add(lineMesh(G.worldlines[1].points, '#ff61dc', 3)); // Alice

    // loci planes α = ±x
    clearGroup(t.groups.loci);
    for (const m of G.loci) t.groups.loci.add(quadMesh(m.positions, m.indices, '#ff4646', 0.16));

    // null surfaces
    clearGroup(t.groups.nullSurfaces);
    for (const m of G.nullSurface) {
      const mesh = quadMesh(m.positions, m.indices, '#4aa3ff', 0.10);
      const wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: hex('#4aa3ff'), transparent: true, opacity: 0.25 }),
      );
      t.groups.nullSurfaces.add(mesh);
      t.groups.nullSurfaces.add(wire);
    }

    // signal path (appearance from typed arrival)
    clearGroup(t.groups.signal);
    const app = appearanceForValue(diag.arrival, diag.phase.branch);
    t.groups.signal.add(lineMesh(G.signal.points, app.color, app.thickness, app.dashed));

    // Light-Speed Reference Baseline: ordinary α=0 ray (a fixed comparison ruler)
    const lb = diag.lightBaseline;
    const lbN = lb.tLightArrival.kind === 'Real' ? lb.tLightArrival.value : null;
    if (props.showLightBaseline !== false && lbN !== null) {
      const baseLine = lineMesh(
        [[diag.scenario.xBob, diag.scenario.tSend, 0], [diag.scenario.xAlice, lbN, 0]],
        '#3fd0ff', 2, true,
      );
      baseLine.userData = { baseline: true };
      t.groups.signal.add(baseLine);
    }

    // markers
    clearGroup(t.groups.markers);
    for (const mk of G.markers) {
      const isSend = mk.id === 'send';
      const color = isSend ? '#3fd0ff' : appearanceForValue(diag.arrival, diag.phase.branch).color;
      const sph = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 16),
        new THREE.MeshBasicMaterial({ color: hex(color) }),
      );
      sph.position.set(mk.position[0], mk.position[1], mk.position[2]);
      sph.userData = { marker: mk.id, eventType: isSend ? 'SEND' : diag.contradiction ? 'FEEDBACK_CONTRADICTION' : diag.reverse ? 'REVERSE_ARRIVAL' : 'RECEIVE', label: mk.label, pos: mk.position };
      t.groups.markers.add(sph);
    }

    // slice shadows: project signal onto x-t wall (α=alphaMin) and x-α wall (t=tMin)
    clearGroup(t.groups.shadows);
    const s = G.signal.points;
    const shadowMat = (c: string) => new THREE.LineDashedMaterial({ color: hex(c), opacity: 0.4, transparent: true, dashSize: 0.4, gapSize: 0.25 });
    const xtShadow = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(s.map((p) => new THREE.Vector3(p[0], p[1], b.alphaMin))),
      shadowMat('#56e39f'),
    );
    xtShadow.computeLineDistances();
    const xaShadow = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(s.map((p) => new THREE.Vector3(p[0], b.tMin, p[2]))),
      shadowMat('#e23bd0'),
    );
    xaShadow.computeLineDistances();
    t.groups.shadows.add(xtShadow);
    t.groups.shadows.add(xaShadow);

    // history trails (faint prior arrivals from the event log)
    clearGroup(t.groups.history);
    for (const ev of props.events) {
      const arr = ev.payload?.arrival as Vec3 | undefined;
      const snd = ev.payload?.send as Vec3 | undefined;
      if (arr && snd && arr.every(Number.isFinite)) {
        const trail = lineMesh([snd, arr], '#5b6b86', 1);
        trail.material.transparent = true;
        trail.material.opacity = 0.25;
        t.groups.history.add(trail);
      }
    }

    // highlight holder
    clearGroup(t.groups.highlight);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.06, 10, 28),
      new THREE.MeshBasicMaterial({ color: hex('#ffffff') }),
    );
    ring.visible = false;
    ring.name = 'selRing';
    t.groups.highlight.add(ring);

    applyHighlight();
  }

  function updateDynamic() {
    const t = three.current;
    if (!t.scene) return;
    const diag = diagRef.current;
    const G = buildSceneGeometry(diag);
    const p = Math.max(0, Math.min(1, progressRef.current));
    const send = G.signal.points[0];
    const end = G.signal.points[1];
    // moving marker
    if (!t.movingMarker) {
      t.movingMarker = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      t.groups.signal.add(t.movingMarker);
    }
    t.movingMarker.position.set(
      send[0] + p * (end[0] - send[0]),
      send[1] + p * (end[1] - send[1]),
      send[2] + p * (end[2] - send[2]),
    );
    // boundary pulse on the loci group when on a singular boundary
    const onBoundary = diag.splitDomain === 'SINGULAR_BOUNDARY' || diag.signal.domain === 'SINGULAR_BOUNDARY';
    const pulse = onBoundary ? 0.6 + 0.4 * Math.sin(pulseRef.current * 5) : 0.16;
    t.groups.loci.children.forEach((m: any) => { if (m.material) m.material.opacity = onBoundary ? pulse * 0.4 : 0.16; });
    // selection ring pulse
    const ring = t.groups.highlight.children.find((c: any) => c.name === 'selRing');
    if (ring && ring.visible) ring.rotation.z += 0.05;
  }

  function applyLayers() {
    const t = three.current;
    if (!t.groups) return;
    const v = props.layerVisibility;
    t.groups.axes.visible = v.axes;
    t.groups.grids.visible = v.grids;
    t.groups.worldlines.visible = v.worldlines;
    t.groups.signal.visible = v.signal;
    t.groups.markers.visible = v.signal;
    t.groups.loci.visible = v.loci;
    t.groups.nullSurfaces.visible = v.nullSurfaces;
    t.groups.shadows.visible = v.shadows;
    t.groups.history.visible = v.history;
  }

  function recenterTarget() {
    const diag = diagRef.current;
    const G = buildSceneGeometry(diag);
    const send = G.signal.points[0];
    const end = G.signal.points[1];
    cam.current.target = [(send[0] + end[0]) / 2, (send[1] + end[1]) / 2, (send[2] + end[2]) / 2];
  }

  function eventPoint(ev: SimEvent): Vec3 | null {
    const arr = ev.payload?.arrival as Vec3 | undefined;
    const snd = ev.payload?.send as Vec3 | undefined;
    if (ev.type === 'SEND' || ev.type === 'PHASE_CHANGE') return snd ?? null;
    if (arr && arr.every(Number.isFinite)) return arr;
    return snd ?? null;
  }

  function applyHighlight() {
    const t = three.current;
    if (!t.groups) return;
    const ring = t.groups.highlight.children.find((c: any) => c.name === 'selRing');
    if (!ring) return;
    const ev = props.events.find((e) => e.id === props.selectedEventId);
    const pt = ev ? eventPoint(ev) : null;
    if (pt) {
      ring.position.set(pt[0], pt[1], pt[2]);
      ring.visible = true;
    } else {
      ring.visible = false;
    }
  }

  // ---- raycasting ----------------------------------------------------------

  function setPointer(e: PointerEvent) {
    const t = three.current;
    const rect = t.renderer.domElement.getBoundingClientRect();
    t.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    t.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickMarker(e: PointerEvent): any | null {
    const t = three.current;
    if (!t.camera) return null;
    setPointer(e);
    t.raycaster.setFromCamera(t.pointer, t.camera);
    const hits = t.raycaster.intersectObjects(t.groups.markers.children, false);
    return hits.length ? hits[0].object : null;
  }

  function raycastHover(e: PointerEvent) {
    const obj = pickMarker(e);
    if (!props.onHoverText) return;
    if (obj) {
      const pos = obj.userData.pos as Vec3;
      const app = appearanceForValue(diagRef.current.arrival, diagRef.current.phase.branch);
      props.onHoverText(`${obj.userData.label} @ (x=${pos[0].toFixed(2)}, t=${pos[1].toFixed(2)}, α=${pos[2].toFixed(2)}) — ${app.label}`);
    } else {
      props.onHoverText(null);
    }
  }

  function raycastClick(e: PointerEvent) {
    const obj = pickMarker(e);
    if (!obj || !props.onSelectEvent) return;
    const wantType = obj.userData.eventType as string;
    const ev = props.events.find((x) => x.type === wantType) ?? props.events.find((x) => x.payload && (x.payload as any).send);
    props.onSelectEvent(ev ? ev.id : null);
  }

  // ---- render --------------------------------------------------------------

  const domain = props.diag.splitDomain;
  return (
    <div className="volume3d">
      <div className="panel-head">
        <h3>3D Volume (x, t, α)</h3>
        <span className="domain-pill" style={{ color: DOMAIN_COLORS[domain] }}>{domain}</span>
      </div>
      {webglError ? (
        <div className="webgl-fallback" role="alert">
          3D view unavailable: {webglError}
          <div className="webgl-fallback-sub">The 2D spacetime and alpha-plane slices remain fully usable.</div>
        </div>
      ) : (
        <div
          ref={mountRef}
          className="volume3d-canvas"
          style={{ width: props.width, height: props.height }}
          role="img"
          aria-label={`3D volume of x, t and alpha. Current split-complex domain ${domain}. Drag to orbit, wheel to zoom.`}
        />
      )}
      <div className="volume3d-hint">drag = orbit · shift/right-drag = pan · wheel = zoom · click marker = select event</div>
    </div>
  );
}
