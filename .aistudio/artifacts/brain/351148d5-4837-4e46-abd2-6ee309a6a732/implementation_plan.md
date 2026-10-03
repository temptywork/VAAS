# Precision Homography & Visual Registration Engine Upgrade

Upgrades the visual registration pipeline with rotation-invariant Oriented ORB descriptors, Hartley-normalized Direct Linear Transform (DLT) with MSAC and Huber Iterative Reweighted Least Squares (IRLS), automatic keyframe chaining with root-frame loop closure for wide camera sweeps, adaptive 4-corner velocity stabilization, and user-selectable geometric motion models.

## User Review & Critical Decisions

> [!IMPORTANT]
> All core architectural choices were confirmed during interactive planning:
> - **Confirmed Decision 1 (Algorithmic Stack)**: Implement all four upgrades—Oriented ORB descriptors, Hartley-normalized DLT with MSAC + Huber IRLS, automatic keyframe chaining, and adaptive 4-corner velocity filtering.
> - **Confirmed Decision 2 (Geometric Motion Model Control)**: Provide a user-selectable motion model in the Registration Settings UI (`HYBRID`, `PROJECTIVE_8DOF`, `AFFINE_6DOF`, and `SIMILARITY_4DOF`).
> - **Confirmed Decision 3 (Wide-Pan Reference Strategy)**: Use automatic keyframe handoff when panning across wide angles, paired with direct root-reference relocking (loop closure) and manual re-anchor override.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the client-side computer vision tracker into an industrial-grade homography estimation pipeline capable of locking tactical symbols, boundaries, and custom imagery onto live video feeds across camera rotations, perspective tilts, and wide horizontal/vertical pans.
- **Target Audience / Persona**: Tactical exercise operators, range safety controllers, and field observers monitoring live webcam, mobile camera, or RTSP/ONVIF video feeds.
- **Key Value**:
  - **Sub-Pixel Stationary Lock**: Adaptive 4-corner velocity filtering eliminates micro-jitter when the camera is still while reacting instantaneously during fast slews.
  - **Rotation & Tilt Resilience**: Oriented ORB descriptors and Hartley-normalized IRLS homography estimation preserve geometric alignment even when handheld or vehicle-mounted cameras roll or tilt.
  - **Extended Pan Range**: Automatic keyframe chaining bridges wide pans beyond the initial field of view while preventing drift by relocking to the master reference frame whenever it returns to view.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Motion Model Selection**: In **System Settings → Registration**, the operator selects from four geometric solver modes (*Hybrid Adaptive*, *8-DOF Projective Homography*, *6-DOF Affine*, or *4-DOF Rigid Similarity*) via a clean segmented selector with live descriptions of each model's degrees of freedom.
  2. **Automatic Keyframe Chaining & Manual Override**: As the operator pans across a wide scene, the engine automatically spawns intermediate keyframes and chains their homographies ($H_{\text{total}} = H_{k \to \text{cur}} \cdot H_{0 \to k}$). The top toolbar and Registration Settings provide immediate one-click **Re-Anchor Reference** and **Clear Keyframe Chain** controls.
  3. **Real-Time Homography Telemetry**: In the **CV Registration Inspector**, the operator inspects live tabular readouts for active motion model, keyframe chain depth, condition number / inlier ratio, corner velocity (px/frame), and the $3 \times 3$ normalized homography matrix.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Precision scientific & tactical instrumentation console with deep obsidian structural surfaces (`#07090E` / `slate-950`), crisp `1px` hairline borders (`border-slate-800`), and high-contrast tabular numerals (`font-mono tabular-nums`).
  - *Color Palette & Mood*: 60% dark obsidian viewport framing, 30% slate control drawers (`slate-900/95`), and 10% calibrated phosphor accents—laser cyan (`#38bdf8`) for active homography controls, emerald (`#34d399`) for locked inlier consensus, and amber (`#fbbf24`) for keyframe handoff states.
  - *Typography & Hierarchy*: Clean sans-serif labels paired with monospace tabular figures (`tabular-nums`) for all matrix cells, residuals, angles, and frame timings so fluctuating telemetry never shifts layout width.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Hartley Isotropic Normalization + Huber IRLS over Raw DLT**
  - *Chosen Approach*: Center source and destination point sets at the origin and scale average radius to $\sqrt{2}$ prior to constructing the $8 \times 8$ system, followed by 2 rounds of Huber-weighted Iterative Reweighted Least Squares (IRLS) and Tikhonov perspective damping on $H_{20}, H_{21}$.
  - *Why*: Raw pixel coordinates ($640 \times 360$) produce $x^2$ terms on the order of $4 \times 10^5$ alongside $1.0$, creating ill-conditioned normal matrices ($\kappa > 10^6$) that amplify sensor noise into perspective wobble. Hartley normalization reduces the condition number by orders of magnitude.
  - *Alternatives Considered*: Unnormalized Gaussian elimination was fast but unstable under 8-DOF projective estimation.
- **Decision 2: 4-Corner Screen-Space Velocity Filtering over Matrix Element Blending**
  - *Chosen Approach*: Project the 4 canonical viewport corners $(0,0), (640,0), (640,360), (0,360)$ through the raw homography, filter the 4 points in 2D screen space using an adaptive velocity-gated alpha-beta filter, and reconstruct the exact $3 \times 3$ homography from the 4 filtered corners.
  - *Why*: Linearly blending $3 \times 3$ projective matrices is mathematically invalid because $H$ is a homogeneous projective mapping; element-wise averaging warps determinants. Filtering the 4 canonical corners in screen space guarantees a geometrically valid homography at every frame and adapts damping to camera speed.
- **Decision 3: Dual-Target Matching (Root Reference + Active Keyframe Chain)**
  - *Chosen Approach*: Always attempt matching against the root reference frame ($F_0$) first; if overlap drops due to wide panning, match against the latest chained keyframe ($F_k$) and compose $H_{0 \to \text{cur}} = H_{k \to \text{cur}} \cdot H_{0 \to k}$.
  - *Why*: Pure frame-to-frame concatenation accumulates drift over time, whereas matching only against $F_0$ loses lock when panning past 40% of the field of view. Dual-target matching achieves wide-angle coverage and instant zero-drift loop closure whenever the camera returns to the original area.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Pipeline Diagram

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           LIVE VIDEO FRAME (640 × 360)                            │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│              1. ORIENTED ORB FEATURE EXTRACTION (Spatial Grid Bins)               │
│  • Adaptive FAST-9 Corner Detection (16×12 grid bins for uniform spatial spread)  │
│  • Intensity Centroid Orientation: θ = atan2(m01, m10) over R=15 circular patch   │
│  • Steered 128-bit BRIEF Descriptor with 5-Pixel Cross Sensor Noise Filtering     │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│              2. DUAL-ANCHOR FEATURE MATCHING & KEYFRAME CHAINING                  │
│  • Mutual Cross-Check Brute-Force Hamming Matcher + Lowe's Ratio Test             │
│  • Orientation Consistency Gate: |Δθ - median(Δθ)| ≤ 35°                          │
│  • Root Frame (F₀) Direct Match (Zero Drift Loop Closure)                         │
│  • Fallback Active Keyframe (Fₖ) Match: H₀→cur = Hₖ→cur × H₀→k                    │
│  • Auto-Spawn Keyframe Fₖ₊₁ when translation > 85px & inliers ≥ 14                │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│              3. MULTI-MODEL MSAC & HARTLEY-NORMALIZED IRLS SOLVER                 │
│  • User-Selectable Mode: HYBRID | PROJECTIVE_8DOF | AFFINE_6DOF | SIMILARITY_4DOF │
│  • Quality-Guided MSAC: Truncated squared error loss Σ min(eᵢ², T²)               │
│  • Hartley Isotropic Normalization (Centroid → 0, Mean Radius → √2)               │
│  • 2-Iteration Huber IRLS Refinement + Perspective Regularization (H₂₀, H₂₁)      │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│              4. ADAPTIVE 4-CORNER VELOCITY TEMPORAL STABILIZER                    │
│  • Project Canonical Corners [(0,0), (640,0), (640,360), (0,360)] via H_raw       │
│  • Compute Mean Corner Displacement Velocity v (px/frame)                         │
│  • Adaptive Gain α(v): Deadband Damping (v < 1.2px) → Fast Tracking (v > 6px)     │
│  • Reconstruct Exact 3×3 Homography H_smooth from Filtered Canonical Corners      │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Additions

- **`HomographyMotionModel`**: `'HYBRID' | 'PROJECTIVE_8DOF' | 'AFFINE_6DOF' | 'SIMILARITY_4DOF'`
- **`RegistrationSettings` Extensions**:
  - `motionModel`: Active `HomographyMotionModel` (default `'HYBRID'`).
  - `enableKeyframeChaining`: Boolean toggle for automatic wide-pan keyframe handoff (default `true`).
  - `adaptiveCornerFiltering`: Boolean toggle for velocity-adaptive 4-corner stabilization (default `true`).
- **`RegistrationMetrics` Extensions**:
  - `activeMotionModel`: The concrete model used on the current frame (`'PROJECTIVE_8DOF' | 'AFFINE_6DOF' | 'SIMILARITY_4DOF'`).
  - `keyframeCount`: Number of active chained keyframes from the root anchor.
  - `cornerVelocityPx`: Instantaneous screen-space corner motion speed in px/frame.

### Interactive Component & State Mapping

- **Registration Settings Panel**:
  - Segmented button bar and dropdown for selecting `motionModel` (`HYBRID`, `PROJECTIVE_8DOF`, `AFFINE_6DOF`, `SIMILARITY_4DOF`)—updates `regSettings.motionModel` immediately in the live CV engine.
  - Toggle switches for **Automatic Keyframe Chaining (Wide Pan)** and **Adaptive 4-Corner Velocity Stabilization**.
  - **Reset Keyframe Chain / Re-Anchor Now** button that clears intermediate keyframes and captures a fresh root reference frame.
- **Diagnostics Inspector Drawer**:
  - Displays the active motion model, keyframe chain status (`ROOT ANCHOR` vs `CHAINED KF #N`), corner velocity readout, and normalized $3 \times 3$ homography matrix in tabular monospace format.
