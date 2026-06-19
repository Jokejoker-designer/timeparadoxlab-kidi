/**
 * ControlPanel — scenario inputs, phase presets, α / branch / close-loop
 * controls, transport, 3D camera presets, 3D layer toggles, and the self-test
 * runner. Every slider has a numeric textbox twin for keyboard/AT users.
 */
import { Scenario, Phase } from '../core/simulation';
import { Branch } from '../core/singular';
import { TestResult } from '../core/selfTest';
import { CameraPreset, ALL_PRESETS } from '../core/camera';
import { LayerVisibility } from './Volume3DView';
import { LayerToggleGroup } from './LayerToggleGroup';

interface Props {
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  alpha: number;
  setAlpha: (a: number) => void;
  branch: Branch;
  setBranch: (b: Branch) => void;
  closeLoop: boolean;
  setCloseLoop: (b: boolean) => void;
  phases: Phase[];
  activePhaseId: string | null;
  onSelectPhase: (p: Phase) => void;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  speed: number;
  setSpeed: (s: number) => void;
  onRunTests: () => void;
  testResults: TestResult[] | null;
  cameraPreset: CameraPreset;
  setCameraPreset: (p: CameraPreset) => void;
  layerVisibility: LayerVisibility;
  onToggleLayer: (k: keyof LayerVisibility) => void;
  wLabel: boolean;
  setWLabel: (b: boolean) => void;
  showLightBaseline: boolean;
  setShowLightBaseline: (b: boolean) => void;
  showSubCPath: boolean;
  setShowSubCPath: (b: boolean) => void;
  onHelp: () => void;
}

const PRESET_LABEL: Record<CameraPreset, string> = {
  iso: 'Isometric',
  front: 'Front (x,t)',
  top: 'Top (x,α)',
  side: 'Side (t,α)',
  follow: 'Follow signal',
};

export function ControlPanel(p: Props) {
  const numField = (v: number, set: (n: number) => void, step = 1, label = '') => (
    <input
      type="number"
      value={Number.isFinite(v) ? v : 0}
      step={step}
      aria-label={label}
      onChange={(e) => set(parseFloat(e.target.value))}
    />
  );

  const passed = p.testResults ? p.testResults.filter((t) => t.pass).length : 0;
  const total = p.testResults ? p.testResults.length : 0;

  return (
    <div className="panel controls">
      <div className="panel-head">
        <h3>Controls</h3>
        <button className="help-btn" onClick={p.onHelp} aria-label="Keyboard help" title="Help (?)">?</button>
      </div>

      <div className="ctl-block">
        <div className="ctl-title">Demo phases (escalation 0 → ½ → 1 → ⊥)</div>
        <div className="phase-buttons">
          {p.phases.map((ph, i) => (
            <button
              key={ph.id}
              className={p.activePhaseId === ph.id ? 'phase active' : 'phase'}
              onClick={() => p.onSelectPhase(ph)}
              title={`${ph.blurb} (key ${i + 1})`}
            >
              <span className="phase-key">{i + 1}</span> {ph.name}
            </button>
          ))}
        </div>
        {p.activePhaseId && (
          <div className="phase-blurb">{p.phases.find((x) => x.id === p.activePhaseId)?.blurb}</div>
        )}
      </div>

      <div className="ctl-block">
        <div className="ctl-title">{p.wLabel ? 'W / α phase' : 'Alpha phase α'}</div>
        <label className="checkbox wlabel-toggle">
          <input type="checkbox" checked={p.wLabel} onChange={(e) => p.setWLabel(e.target.checked)} />
          label α as W / α
        </label>
        <div className="slider-twin">
          <input
            type="range" min={0} max={8} step={0.01} value={p.alpha}
            aria-label="alpha phase"
            onChange={(e) => p.setAlpha(parseFloat(e.target.value))}
          />
          {numField(p.alpha, p.setAlpha, 0.01, 'alpha phase value')}
        </div>
        <div className="ctl-row">
          <label>
            branch
            <select value={p.branch} onChange={(e) => p.setBranch(e.target.value as Branch)}>
              <option value="+">+ (forward)</option>
              <option value="-">− (reverse)</option>
              <option value="plain">plain</option>
            </select>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={p.closeLoop} onChange={(e) => p.setCloseLoop(e.target.checked)} />
            close causal loop → ⊥
          </label>
        </div>
      </div>

      <div className="ctl-block">
        <div className="ctl-title">Sub-c corridor speed  v = {(p.scenario.betaSub ?? 0.8).toFixed(2)}c</div>
        <div className="slider-twin">
          <input
            type="range" min={0.05} max={0.99} step={0.01}
            value={p.scenario.betaSub ?? 0.8}
            aria-label="sub-c corridor speed beta"
            onChange={(e) => p.setScenario({ ...p.scenario, betaSub: parseFloat(e.target.value) })}
          />
          {numField(p.scenario.betaSub ?? 0.8, (n) => p.setScenario({ ...p.scenario, betaSub: n }), 0.01, 'sub-c corridor speed value')}
        </div>
        <div className="preset-buttons">
          {[0.9, 0.8, 0.5, 0.2].map((b) => (
            <button
              key={b}
              className={Math.abs((p.scenario.betaSub ?? 0.8) - b) < 1e-9 ? 'preset active' : 'preset'}
              onClick={() => p.setScenario({ ...p.scenario, betaSub: b })}
            >
              {b}c
            </button>
          ))}
        </div>
      </div>

      <div className="ctl-block">
        <div className="ctl-title">Scenario</div>
        <div className="ctl-grid">
          <label>Bob x{numField(p.scenario.xBob, (n) => p.setScenario({ ...p.scenario, xBob: n }), 1, 'Bob x')}</label>
          <label>Alice x{numField(p.scenario.xAlice, (n) => p.setScenario({ ...p.scenario, xAlice: n }), 1, 'Alice x')}</label>
          <label>send t{numField(p.scenario.tSend, (n) => p.setScenario({ ...p.scenario, tSend: n }), 1, 'send time')}</label>
          <label>c{numField(p.scenario.c, (n) => p.setScenario({ ...p.scenario, c: n }), 0.1, 'speed of light')}</label>
        </div>
      </div>

      <div className="ctl-block">
        <div className="ctl-title">Timeline</div>
        <div className="transport">
          {p.playing ? <button onClick={p.onPause}>⏸ Pause</button> : <button onClick={p.onPlay}>▶ Play</button>}
          <button onClick={p.onReset}>⟲ Reset</button>
        </div>
        <div className="slider-twin">
          <label className="twin-label">speed</label>
          <input
            type="range" min={0.2} max={3} step={0.1} value={p.speed}
            aria-label="animation speed"
            onChange={(e) => p.setSpeed(parseFloat(e.target.value))}
          />
          {numField(p.speed, p.setSpeed, 0.1, 'animation speed value')}
        </div>
      </div>

      <div className="ctl-block">
        <div className="ctl-title">Display</div>
        <label className="checkbox">
          <input type="checkbox" checked={p.showLightBaseline} onChange={(e) => p.setShowLightBaseline(e.target.checked)} />
          Show light-speed baseline (α=0, β=1)
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={p.showSubCPath} onChange={(e) => p.setShowSubCPath(e.target.checked)} />
          Show sub-c corridor path (gold)
        </label>
      </div>

      <div className="ctl-block">
        <div className="ctl-title">3D camera</div>
        <div className="preset-buttons">
          {ALL_PRESETS.map((preset) => (
            <button
              key={preset}
              className={p.cameraPreset === preset ? 'preset active' : 'preset'}
              onClick={() => p.setCameraPreset(preset)}
            >
              {PRESET_LABEL[preset]}
            </button>
          ))}
        </div>
      </div>

      <div className="ctl-block">
        <LayerToggleGroup visibility={p.layerVisibility} onToggle={p.onToggleLayer} />
      </div>

      <div className="ctl-block">
        <div className="ctl-title">Verification</div>
        <button className="test-btn" onClick={p.onRunTests}>Run self-tests</button>
        {p.testResults && (
          <div className="test-results">
            <div className={passed === total ? 'test-summary ok' : 'test-summary fail'}>{passed}/{total} passed</div>
            {p.testResults.map((t, i) => (
              <div key={i} className={t.pass ? 'test-row pass' : 'test-row fail'}>
                <span>{t.pass ? '✓' : '✗'}</span> {t.name}
                {t.detail && <span className="test-detail"> — {t.detail}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
