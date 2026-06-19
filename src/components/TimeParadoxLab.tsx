/**
 * TimeParadoxLab — top-level component. Owns scenario + phase + animation +
 * selection + camera + layer state, drives the timeline with requestAnimationFrame,
 * and composes the six WO panels: control panel, 2D spacetime slice, 2D
 * alpha-plane slice, 3D (x,t,α) volume, diagnostics, and event log.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SCENARIO,
  DEMO_PHASES,
  Scenario,
  Phase,
  SimEvent,
  evaluatePhase,
  buildEvents,
  snapshotOf,
} from '../core/simulation';
import { Branch, Real } from '../core/singular';
import { runSelfTests, TestResult } from '../core/selfTest';
import { CameraPreset, ALL_PRESETS } from '../core/camera';
import { Vec3 } from '../core/geometry3d';
import { useElementSize } from '../core/useElementSize';
import { downloadEventLog } from '../core/export';
import { ControlPanel } from './ControlPanel';
import { SpacetimeCanvas } from './SpacetimeCanvas';
import { AlphaPlaneCanvas } from './AlphaPlaneCanvas';
import { ProjectionSpeedCanvas } from './ProjectionSpeedCanvas';
import { VWCorrelationFieldPanel } from './VWCorrelationFieldPanel';
import { Volume3DView, LayerVisibility } from './Volume3DView';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { EventLog } from './EventLog';
import { VolumeLegend } from './VolumeLegend';
import { HoverInspector } from './HoverInspector';
import { HelpOverlay } from './HelpOverlay';

const DURATION = 2.6; // seconds for a full traversal at speed 1
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const DEFAULT_LAYERS: LayerVisibility = {
  axes: true,
  grids: true,
  loci: true,
  nullSurfaces: true,
  worldlines: true,
  signal: true,
  shadows: true,
  history: false,
};

function eventWorldPoint(ev: SimEvent | null): Vec3 | null {
  if (!ev || !ev.payload) return null;
  const arr = ev.payload.arrival as Vec3 | undefined;
  const snd = ev.payload.send as Vec3 | undefined;
  if (ev.type === 'SEND' || ev.type === 'PHASE_CHANGE') return snd ?? null;
  if (arr && arr.every(Number.isFinite)) return arr;
  return snd ?? null;
}

export function TimeParadoxLab() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [alpha, setAlphaRaw] = useState(0);
  const [branch, setBranchRaw] = useState<Branch>('+');
  const [closeLoop, setCloseLoopRaw] = useState(false);
  const [activePhaseId, setActivePhaseId] = useState<string | null>('ordinary');

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [clock, setClock] = useState(0);
  const [speed, setSpeed] = useState(1);

  const [events, setEvents] = useState<SimEvent[]>([]);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hoverText, setHoverText] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [helpOpen, setHelpOpen] = useState(false);
  const [wLabel, setWLabel] = useState(true);
  const [showLightBaseline, setShowLightBaseline] = useState(true);
  const [showSubCPath, setShowSubCPath] = useState(true);
  const seqRef = useRef(0);

  const setAlpha = (a: number) => { setAlphaRaw(a); setActivePhaseId(null); };
  const setBranch = (b: Branch) => { setBranchRaw(b); setActivePhaseId(null); };
  const setCloseLoop = (b: boolean) => { setCloseLoopRaw(b); setActivePhaseId(null); };

  const livePhase: Phase = useMemo(() => {
    const named = activePhaseId ? DEMO_PHASES.find((d) => d.id === activePhaseId) : null;
    return {
      id: activePhaseId ?? 'custom',
      name: named ? named.name : `Custom (α=${alpha.toFixed(2)}, ${branch})`,
      alpha,
      branch,
      closeLoop,
      expectedArrival: named ? named.expectedArrival : NaN,
      blurb: named ? named.blurb : 'Custom phase from the sliders.',
    };
  }, [activePhaseId, alpha, branch, closeLoop]);

  const diag = useMemo(() => evaluatePhase(scenario, livePhase), [scenario, livePhase]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const highlight = useMemo(() => eventWorldPoint(selectedEvent), [selectedEvent]);

  const logPhase = (ph: Phase) => {
    const d = evaluatePhase(scenario, ph);
    const evs = buildEvents(d, seqRef.current);
    seqRef.current += evs.length;
    setEvents((prev) => [...prev, ...evs]);
  };

  const runLive = () => { setProgress(0); logPhase(livePhase); setPlaying(true); };

  const onSelectPhase = (ph: Phase) => {
    setActivePhaseId(ph.id);
    setAlphaRaw(ph.alpha);
    setBranchRaw(ph.branch);
    setCloseLoopRaw(!!ph.closeLoop);
    setProgress(0);
    logPhase(ph);
    setPlaying(true);
  };

  const onPlay = () => { if (progress >= 1 - 1e-6 || progress === 0) runLive(); else setPlaying(true); };
  const onPause = () => setPlaying(false);
  const onReset = () => { setPlaying(false); setProgress(0); setEvents([]); setSelectedEventId(null); seqRef.current = 0; };

  const onExport = () => {
    if (events.length === 0) return;
    downloadEventLog(events);
    const ev: SimEvent = {
      id: `evt-${String(seqRef.current).padStart(4, '0')}`,
      seq: seqRef.current,
      type: 'EXPORT',
      level: 'info',
      phaseId: livePhase.id,
      message: `Exported ${events.length} events as JSON`,
      timestamp: Date.now() / 1000,
      scenario: snapshotOf(scenario, livePhase),
      typedState: Real(events.length),
    };
    seqRef.current += 1;
    setEvents((prev) => [...prev, ev]);
  };

  const onToggleLayer = (k: keyof LayerVisibility) => setLayers((prev) => ({ ...prev, [k]: !prev[k] }));
  const cycleCamera = () => setCameraPreset((prev) => ALL_PRESETS[(ALL_PRESETS.indexOf(prev) + 1) % ALL_PRESETS.length]);
  const onRunTests = () => setTestResults(runSelfTests());

  // keyboard shortcuts (kept fresh via a ref so the listener stays stable)
  const actions = useRef<any>({});
  actions.current = { onPlay, onPause, onReset, onExport, cycleCamera, onSelectPhase, onToggleLayer, setHelpOpen, playing };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const a = actions.current;
      if (e.key === ' ') { e.preventDefault(); a.playing ? a.onPause() : a.onPlay(); }
      else if (e.key === 'r' || e.key === 'R') a.onReset();
      else if (e.key === 'e' || e.key === 'E') a.onExport();
      else if (e.key === 'c' || e.key === 'C') a.cycleCamera();
      else if (e.key === 'l' || e.key === 'L') a.onToggleLayer('history');
      else if (e.key === '?') a.setHelpOpen((v: boolean) => !v);
      else if (e.key >= '1' && e.key <= '5') {
        const idx = parseInt(e.key, 10) - 1;
        if (DEMO_PHASES[idx]) a.onSelectPhase(DEMO_PHASES[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // animation loop
  useEffect(() => {
    const boundaryPulse = diag.splitDomain === 'SINGULAR_BOUNDARY';
    if (!playing && !boundaryPulse) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setClock((c) => c + dt);
      if (playing) setProgress((pr) => Math.min(1, pr + (dt * speed) / DURATION));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, diag.splitDomain]);

  useEffect(() => { if (playing && progress >= 1 - 1e-6) setPlaying(false); }, [progress, playing]);

  // responsive sizes
  const stCard = useElementSize<HTMLDivElement>();
  const apCard = useElementSize<HTMLDivElement>();
  const psCard = useElementSize<HTMLDivElement>();
  const corrCard = useElementSize<HTMLDivElement>();
  const volCard = useElementSize<HTMLDivElement>();
  const sliceH = (w: number) => clampN(Math.round(w * 0.72), 340, 560);
  const projH = clampN(Math.round(psCard.size.width * 0.62), 320, 480);
  const corrH = clampN(Math.round(corrCard.size.width * 0.62), 320, 480);
  const volH = clampN(Math.round(volCard.size.width * 0.52), 460, 760);

  return (
    <div className="lab">
      <header className="lab-header">
        <div>
          <h1>TimeParadoxLab 3D</h1>
          <div className="subtitle">
            5D singular-spacetime simulator · split-complex geometry · (x,t,α) volume · typed singular states
          </div>
        </div>
        <div className="disclaimer">
          Research visualisation, not verified physics. The α-axis is a modeling coordinate
          for singular structure; +dα² is a speculative two-time signature, not standard SR.
        </div>
      </header>

      <div className="lab-grid">
        <aside className="col-left">
          <ControlPanel
            scenario={scenario} setScenario={setScenario}
            alpha={alpha} setAlpha={setAlpha}
            branch={branch} setBranch={setBranch}
            closeLoop={closeLoop} setCloseLoop={setCloseLoop}
            phases={DEMO_PHASES} activePhaseId={activePhaseId} onSelectPhase={onSelectPhase}
            playing={playing} onPlay={onPlay} onPause={onPause} onReset={onReset}
            speed={speed} setSpeed={setSpeed}
            onRunTests={onRunTests} testResults={testResults}
            cameraPreset={cameraPreset} setCameraPreset={setCameraPreset}
            layerVisibility={layers} onToggleLayer={onToggleLayer}
            wLabel={wLabel} setWLabel={setWLabel}
            showLightBaseline={showLightBaseline} setShowLightBaseline={setShowLightBaseline}
            showSubCPath={showSubCPath} setShowSubCPath={setShowSubCPath}
            onHelp={() => setHelpOpen(true)}
          />
        </aside>

        <main className="col-center">
          <div className="slice-row">
            <div ref={stCard.ref} className="canvas-card">
              <SpacetimeCanvas diag={diag} progress={progress} width={stCard.size.width} height={sliceH(stCard.size.width)} highlight={highlight} showLightBaseline={showLightBaseline} showSubCPath={showSubCPath} />
            </div>
            <div ref={apCard.ref} className="canvas-card">
              <AlphaPlaneCanvas diag={diag} progress={progress} pulse={clock} width={apCard.size.width} height={sliceH(apCard.size.width)} highlight={highlight} />
            </div>
          </div>

          <div className="slice-row">
            <div ref={psCard.ref} className="canvas-card">
              <ProjectionSpeedCanvas diag={diag} width={psCard.size.width} height={projH} pulse={clock} />
            </div>
            <div ref={corrCard.ref} className="canvas-card">
              <VWCorrelationFieldPanel diag={diag} width={corrCard.size.width} height={corrH} pulse={clock} />
            </div>
          </div>

          <div ref={volCard.ref} className="panel volume-wrap">
            <Volume3DView
              diag={diag} events={events} progress={progress}
              width={volCard.size.width} height={volH}
              cameraPreset={cameraPreset} layerVisibility={layers}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
              onHoverText={setHoverText}
              showLightBaseline={showLightBaseline}
            />
          </div>

          <EventLog events={events} selectedEventId={selectedEventId} onSelectEvent={setSelectedEventId} onExport={onExport} />
        </main>

        <aside className="col-right">
          <DiagnosticsPanel diag={diag} />
          <HoverInspector diag={diag} hoverText={hoverText} selectedEvent={selectedEvent} />
          <div className="panel">
            <h3>3D legend</h3>
            <VolumeLegend />
          </div>
        </aside>
      </div>

      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
