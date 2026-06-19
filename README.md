# TimeParadoxLab / Kidi

**TimeParadoxLab / Kidi** is a local-first research visualization for a speculative singular-boundary model. It combines typed singular algebra, an alpha/W corridor, light-baseline comparison, projected-speed analysis, and a V–W feasibility field.

The project is not presented as verified physics. It is a browser-based simulator for exploring one mathematical idea:

> A singular boundary should be preserved as typed structure, not collapsed into infinity.

---

## Status

Current build includes:

* typed singular states: `Real`, `Singular`, `Bottom`
* split-complex alpha/W boundary geometry
* 2D spacetime view
* 2D alpha-plane view
* 3D `(x,t,α)` volume view
* light-speed reference baseline
* Kidi projected-speed panel
* V–W correlation field
* diagnostics panel
* event log
* offline `standalone.html`
* self-test support

---

## Honesty boundary

This repository is a **research visualization**, not a proof of real-world faster-than-light travel or real time travel.

It does **not** claim:

* verified new physics,
* physical faster-than-light transport,
* a photon rest frame,
* real time travel,
* a replacement for special relativity,
* a true algebraic inverse of zero.

The split-complex unit `j` is only a direction unit:

```math
j^2 = 1
```

It is not `1/0`.

A Kidi state is a typed boundary object. The simulator does not assert that there is a normal number `K` such that:

```math
0 \cdot K = 1
```

Instead, boundary and contradiction states are preserved as data:

```ts
Real(value)
Singular(coeff, order, branch, reason)
Bottom(reason)
```

---

## Brainstorm history

This section documents how the project evolved.

### 1. Starting point: do not call `1/0` infinity

The first idea was simple:

> Do not force `1/0` to become infinity. Treat it as a singular tag attached to the numerator.

Instead of:

```math
\frac{1}{0}=\infty
```

the model uses a formal singular notation:

```math
\frac{1}{0}=1\#
```

More generally:

```math
\frac{a}{0}=a\#
```

This does not mean `a#` is a normal number. It means the calculation reached a singular boundary and preserved the coefficient `a`.

So the first design rule became:

> Singular events should stay visible as typed information.

---

### 2. From `a#` to typed states

The next problem was safety. If `a#` is allowed to behave like a normal number, the algebra becomes unsafe.

So the model separates values into three states:

```ts
Real(value)
Singular(coeff, order, branch, reason)
Bottom(reason)
```

Their meanings are:

| State                                    | Meaning                                      |
| ---------------------------------------- | -------------------------------------------- |
| `Real(value)`                            | ordinary finite value                        |
| `Singular(coeff, order, branch, reason)` | Kidi boundary state                          |
| `Bottom(reason)`                         | contradiction or irreducible undefined state |

A contradiction is not treated as “larger infinity”. It becomes `Bottom`.

Example:

```text
reverse arrival + feedback loop = Bottom
```

This lets the simulator display paradoxes instead of hiding them.

---

### 3. Split-complex alpha axis

To visualize the boundary, the model introduced a split-complex style coordinate:

```math
z=x+j\alpha
```

with:

```math
j^2=1
```

The split invariant is:

```math
\Delta_{\text{split}}=x^2-\alpha^2
```

The Kidi boundary appears when:

```math
\Delta_{\text{split}}=0
```

so:

```math
x^2-\alpha^2=0
```

therefore:

```math
\alpha=\pm x
```

This gives three regions:

| Region         | Condition   | Meaning                                 |
| -------------- | ----------- | --------------------------------------- |
| Real domain    | `x²−α² > 0` | ordinary projected corridor             |
| Kidi boundary  | `x²−α² = 0` | singular boundary                       |
| Alpha/W domain | `x²−α² < 0` | no real projected time under this model |

---

### 4. From 2D to 3D

The first visualization was a 2D alpha-plane:

```text
x-axis = spatial displacement
alpha-axis = W / singular displacement
```

The Kidi boundary lines are:

```math
\alpha=+x
```

and:

```math
\alpha=-x
```

Then the project added time `t`, giving a 3D teaching volume:

```text
(x, t, α)
```

In this view, the two boundary lines extend along time and become two Kidi branch planes.

So the 3D scene is not the proof itself. It is a visual teaching layer for the boundary structure.

---

### 5. Original 5D framing

The broader speculative model can be written as:

```math
ds^2=c^2dt^2-dx^2-dy^2-dz^2+d\alpha^2
```

For the Bob-to-Alice simulator, this is reduced to:

```math
ds^2=c^2dt^2-dx^2+d\alpha^2
```

For a null signal:

```math
0=c^2dt^2-dx^2+d\alpha^2
```

which gives:

```math
|dt_{\text{signal}}|=\frac{\sqrt{dx^2-d\alpha^2}}{c}
```

This produced the first TimeParadoxLab phases:

| Phase    |          α / W | Branch | Meaning                       |    |   |     |                    |
| -------- | -------------: | ------ | ----------------------------- | -- | - | --- | ------------------ |
| Ordinary |            `0` | `+`    | ordinary light-speed behavior |    |   |     |                    |
| Shortcut |            `0< | α      | <                             | dx | ` | `+` | projected shortcut |
| Boundary |              ` | α      | =                             | dx | ` | `+` | Kidi boundary      |
| Paradox  |  near boundary | `−`    | reverse arrival               |    |   |     |                    |
| Feedback | reverse + loop | `−`    | contradiction / Bottom        |    |   |     |                    |

---

### 6. Important correction: negative time is not required

The project later separated two different ideas:

1. **Kidi corridor shortcut**
2. **Time paradox**

The shortcut only requires:

```math
0<|W|<D
```

where:

```math
D=|dx|
```

This can let a path arrive before the ordinary `α=0` light baseline while still arriving after the send time.

The paradox layer needs extra choices such as reverse branch or feedback loop.

So the main correction was:

> The core Kidi corridor feasibility model does not need negative time.

The time-paradox module remains useful as an advanced exploration layer, but it is not required for the main V–W feasibility result.

---

### 7. Light-speed reference baseline

To make the shortcut meaningful, the simulator needed a stable comparison path.

The ordinary light baseline is:

```math
dt_{\text{light}}=\frac{|dx|}{c}
```

```math
t_{\text{light arrival}}=t_{\text{send}}+\frac{|dx|}{c}
```

This baseline uses:

```text
α = 0
```

It is not a photon rest frame. It is only a comparison ruler.

Default example:

```text
Bob x = 0
Alice x = 5
send t = 2
c = 1
```

The light baseline arrives at:

```math
t=2+5=7
```

If the Kidi path arrives at `t=5`, the app reports that it arrives 2 time units before the baseline.

---

### 8. Equivalent projected speed

The next layer asks:

> What ordinary 3D speed would reproduce the same arrival time if there were no W/alpha corridor?

Using:

```math
\Delta_{\text{signal}}=dx^2-dW^2
```

the equivalent projected speed is:

```math
v_{\text{equiv}}=\frac{c|dx|}{\sqrt{dx^2-dW^2}}
```

and:

```math
\beta_{\text{equiv}}=\frac{v_{\text{equiv}}}{c}
```

Define:

```math
\eta=\frac{|W|}{|dx|}
```

Then:

```math
\beta_{\text{equiv}}=\frac{1}{\sqrt{1-\eta^2}}
```

This shows how a nonzero W/alpha component can create a projected speed greater than `c`.

This is still not a claim of verified real-world FTL. It is an equivalent projected speed inside the model.

---

### 9. Final core insight: V–W correlation

The most important later correction was this:

> The project should not only show projected speed. It should show the relationship between local speed `V` and W displacement.

The question became:

```text
Can local speed V stay below c, while still arriving before the ordinary α=0 light baseline?
```

Inside the reduced Kidi corridor model, the answer is yes if W is large enough.

Define:

```math
D=|dx|
```

```math
\eta=\frac{|W|}{D}
```

```math
\beta=\frac{V}{c}
```

The effective corridor distance is:

```math
D_{\text{eff}}=D\sqrt{1-\eta^2}
```

The sub-c corridor travel time is:

```math
t_{\text{sub-c}}=\frac{D_{\text{eff}}}{V}
```

The ordinary light baseline is:

```math
t_{\text{light}}=\frac{D}{c}
```

The sub-c corridor beats the baseline when:

```math
t_{\text{sub-c}}<t_{\text{light}}
```

which simplifies to:

```math
\beta^2+\eta^2>1
```

with:

```math
0<\beta<1
```

and:

```math
0<\eta<1
```

This is the main V–W feasibility field.

The key insight is:

```text
higher W  -> lower required V
higher V  -> lower required W
```

---

## Core formulas

### Split-complex boundary

```math
z=x+j\alpha,\qquad j^2=1
```

```math
\Delta_{\text{split}}=x^2-\alpha^2
```

```math
\Delta_{\text{split}}=0 \iff \alpha=\pm x
```

---

### Signal time

```math
0=c^2dt^2-dx^2+dW^2
```

```math
|dt_{\text{signal}}|=\frac{\sqrt{dx^2-dW^2}}{c}
```

---

### Light baseline

```math
dt_{\text{light}}=\frac{|dx|}{c}
```

```math
t_{\text{light arrival}}=t_{\text{send}}+\frac{|dx|}{c}
```

---

### Equivalent projected speed

```math
v_{\text{equiv}}=\frac{c|dx|}{\sqrt{dx^2-dW^2}}
```

```math
\beta_{\text{equiv}}=\frac{1}{\sqrt{1-\eta^2}}
```

where:

```math
\eta=\frac{|W|}{|dx|}
```

---

### V–W feasibility field

```math
D=|dx|
```

```math
\eta=\frac{|W|}{D}
```

```math
\beta=\frac{V}{c}
```

```math
D_{\text{eff}}=D\sqrt{1-\eta^2}
```

```math
t_{\text{sub-c}}=\frac{D_{\text{eff}}}{V}
```

The boundary curve is:

```math
\beta^2+\eta^2=1
```

The feasible sub-c shortcut region is:

```math
\beta^2+\eta^2>1,\qquad 0<\beta<1,\qquad 0<\eta<1
```

---

## Region classification

| Condition                 | Class                     | Meaning                          |
| ------------------------- | ------------------------- | -------------------------------- |
| `β²+η² < 1`               | `SUBC_TOO_SLOW`           | W and V are not enough           |
| `β²+η² = 1`               | `EQUAL_TO_LIGHT_BASELINE` | arrives with the light baseline  |
| `β²+η² > 1`, `β<1`, `η<1` | `SUBC_BEATS_LIGHT`        | local sub-c speed beats baseline |
| `η = 1`                   | `KIDI_BOUNDARY`           | effective distance tends to zero |
| `η > 1`                   | `NO_REAL_CORRIDOR`        | no real projected corridor       |
| feedback contradiction    | `Bottom`                  | causal loop contradiction        |

---

## Panels

| Panel                 | Purpose                                               |
| --------------------- | ----------------------------------------------------- |
| Controls              | phase, W/alpha, branch, speed, toggles, camera, tests |
| Spacetime `(x,t)`     | Bob/Alice worldlines, signal path, light baseline     |
| Alpha-plane `(x,α)`   | split boundary lines `α=±x`                           |
| 3D Volume `(x,t,α)`   | Kidi planes, signal path, baseline, orbit camera      |
| Projection Speed      | equivalent projected speed `β_equiv`                  |
| V–W Correlation Field | feasibility map for `β²+η²>1`                         |
| Diagnostics           | typed values, margins, domain labels                  |
| Event Log             | state transitions and JSON export                     |

---

## Built-in demo

Default scenario:

```text
Bob x = 0
Alice x = 5
send t = 2
c = 1
```

| Phase    | W / α | Branch     | Result                         |
| -------- | ----: | ---------- | ------------------------------ |
| Ordinary |   `0` | `+`        | light baseline, arrival `t=7`  |
| Shortcut |   `4` | `+`        | arrival `t=5`, before baseline |
| Boundary |   `5` | `+`        | Kidi Boundary                  |
| Paradox  | `√24` | `−`        | reverse arrival `t=1`          |
| Feedback | `√24` | `−` + loop | `Bottom` contradiction         |

V–W example:

```text
D = 5
V = 0.8c
W = 4
```

Then:

```math
\beta=0.8
```

```math
\eta=0.8
```

```math
\beta^2+\eta^2=1.28>1
```

So the classification is:

```text
SUBC_BEATS_LIGHT
```

But the local speed is still:

```text
V < c
```

The model beats the light baseline by reducing effective corridor distance, not by making local speed exceed `c`.

---

## Run locally

### Offline standalone

Open:

```text
standalone.html
```

If your browser blocks `file://`, run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/standalone.html
```

---

### Development mode

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

---

### Rebuild standalone

```bash
python build_standalone.py
```

Optional verification:

```bash
python verify.py
```

---

## Architecture

```text
src/core/
  singular.ts       typed Real / Singular / Bottom algebra
  physics.ts        split-complex, signal laws, baseline, V-W field
  simulation.ts     phases, diagnostics, events
  geometry3d.ts     3D geometry helpers
  projection.ts     screen/world projection helpers
  schemas.ts        event/export schemas
  export.ts         export utilities
  selfTest.ts       built-in self-tests

src/components/
  TimeParadoxLab.tsx
  ControlPanel.tsx
  SpacetimeCanvas.tsx
  AlphaPlaneCanvas.tsx
  Volume3DView.tsx
  ProjectionSpeedCanvas.tsx
  VWCorrelationFieldPanel.tsx
  DiagnosticsPanel.tsx
  EventLog.tsx

vendor/
  React, ReactDOM, Three.js, Babel for offline standalone mode

standalone.html
  offline browser build

build_standalone.py
  generates standalone.html
```

---

## Data flow

```text
Controls
  -> Scenario / Phase / W / Branch / V
  -> simulation.ts
  -> physics.ts
  -> typed diagnostics
  -> panels + event log
```

Calculation and visualization are separated:

```text
core/        pure math and state transitions
components/ React visualization
vendor/     offline runtime libraries
```

---

## Why the reduced model is enough

The broad theoretical frame may be written as:

```math
(x,y,z,t,W)
```

But the V–W feasibility proof only needs:

```math
(D,W,V,t)
```

or normalized:

```math
(\eta,\beta)
```

Therefore, the main Kidi corridor proof does not need negative time, reverse branch, or feedback paradox.

The reduced model is enough to show:

```math
V<c
```

while:

```math
t_{\text{sub-c}}<t_{\text{light}}
```

if:

```math
\beta^2+\eta^2>1
```

The paradox module remains as an optional advanced layer for studying causal-loop behavior.

---

## Current project scope

TimeParadoxLab / Kidi is:

```text
local-first
frontend-only
offline runnable
browser based
research visualization
```

It is not:

```text
a backend service
a database app
a real physics engine
a verified FTL simulator
a time-travel proof
```

---

## Roadmap

Possible future extensions:

* Newton–Puiseux branch decomposition
* theorem/derivation viewer
* exportable simulation reports
* GitHub Pages live demo
* clearer educational mode
* comparison between reduced model and full 5D framing
* improved screenshots and diagrams
* paper-style explanation

---

## Suggested repository description

```text
A local-first research visualization of typed Kidi singular states, alpha/W corridor geometry, light-baseline comparison, and V-W feasibility fields.
```

---

## License

No license is selected in this README.

Before accepting outside contributions or encouraging reuse, add a `LICENSE` file such as MIT, Apache-2.0, or another license that matches the intended release strategy.
