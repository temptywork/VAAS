# Product Requirements Document (PRD)

## Project Name: VAAS — Vijay Ashish Augmentation System
**Codename:** Tactical AR Overlay & Exercise Visualization System  
**Document Version:** 3.0.0  
**Status:** Approved / Implemented Base (with ONVIF PTZ, FFmpeg & PTZ Spatial Memory)  
**Target Environment:** Web Client & Full-Stack Node.js (Vite + React + TypeScript + Express + FFmpeg + HTML5 Canvas)  
**Security / Operational Classification:** Unclassified — Military Training & Exercise Simulation Only  

---

## 1. Executive Summary & Purpose

The **Vijay Ashish Augmentation System (VAAS)** is a lightweight, high-performance, single-screen tactical visualization and synthetic target annotation software designed for military field exercises, training simulations, and observation post operations.

Operating entirely within the browser without requiring heavy distributed backends, GPS antennas, or Inertial Navigation Systems (INS), VAAS leverages computer vision (CV) visual registration and planar homography estimation to project simulated tactical graphics, military unit symbols (MIL-STD/NATO inspired), and exercise boundaries directly onto live or simulated video streams. As the camera pans, tilts, or zooms, the system dynamically reprojects annotations to maintain accurate optical anchoring against physical or synthetic terrain.

---

## 2. Problem Statement & Operational Rationale

During field training exercises:
1. **GPS-Denied / Degraded Environments:** Physical terrain training often occurs in electronic warfare (EW) contested zones or rugged areas where satellite navigation is unavailable or unreliable.
2. **Expensive Hardware Dependency:** Traditional augmented reality (AR) systems rely on heavy sensor pods, calibrated PTZ encoders, or high-cost INS units that cannot be deployed rapidly across standard consumer or tactical tablets.
3. **Training Realism & Target Tracking:** Observers, evaluators, and commanders need to visualize simulated opposing forces (OPFOR), fortified positions, minefields, and phase lines superimposed over real terrain without deploying physical target mockups.
4. **Single-Screen Usability:** Operators in the field require an intuitive, low-latency interface that can run on ruggedized laptops, mobile devices with environment-facing cameras, or command center feeds with minimal setup.

VAAS solves these challenges by combining feature-based visual tracking, 3x3 homography projection, and scenario management in a pure client-side web application.

---

## 3. High-Level Architecture & Operating Principles

```
                  +-------------------------------------------------+
                  |                 VIDEO INGESTION                 |
                  |  - Exercise Terrain Simulator (Pan/Tilt/Zoom)   |
                  |  - Mobile Rear Camera (Environment / Torch)     |
                  |  - Front Camera / System Webcam                 |
                  |  - RTSP IP Camera Stream Configuration          |
                  +------------------------+------------------------+
                                           |
                                           v
                  +-------------------------------------------------+
                  |      CV VISUAL REGISTRATION PIPELINE            |
                  |  1. Offscreen Frame Extraction (640x360 @ 30+FPS) |
                  |  2. FAST / Harris Corner Detection & NMS        |
                  |  3. 256-bit Binary Descriptors (ORB/BRIEF)      |
                  |  4. Hamming Distance + Lowe's Ratio Test        |
                  |  5. 4-Point DLT RANSAC Homography Estimation     |
                  |  6. Least-Squares Inlier Refinement             |
                  |  7. Exponential Moving Average (EMA) Smoothing  |
                  +------------------------+------------------------+
                                           |
                                           v
                  +-------------------------------------------------+
                  |             TACTICAL CANVAS ENGINE              |
                  |  - Dynamic Reprojection: [x,y,1]' = H * [X,Y,1]'|
                  |  - Standard Military Feature Library            |
                  |  - Custom Vector (SVG) & Raster (PNG/JPG) Icons|
                  |  - Multi-Layer Exercise Boundaries & Polygons   |
                  |  - Tactical Reticle, Compass & HUD Telemetry    |
                  |  - Master Layers Visibility & Fullscreen Mode   |
                  +------------------------+------------------------+
                                           |
                                           v
                  +-------------------------------------------------+
                  |            DATA & SCENARIO LIFECYCLE            |
                  |  - Built-in Scenarios (Crimson Shield, Desert)  |
                  |  - Browser LocalStorage Scenario Persistence    |
                  |  - Export / Import Portable JSON Schema         |
                  +-------------------------------------------------+
```

### 3.1 Frame Coordinate Transformation
All tactical features (symbols, boundary vertices) are pinned in an arbitrary **Reference Frame Coordinate System** $(X_{\text{ref}}, Y_{\text{ref}})$ established at a captured moment in time. When the camera moves, the homography matrix $H$ maps reference coordinates to dynamic screen coordinates $(x_{\text{cur}}, y_{\text{cur}})$:

$$\begin{bmatrix} x' \\ y' \\ w' \end{bmatrix} = \mathbf{H} \begin{bmatrix} X_{\text{ref}} \\ Y_{\text{ref}} \\ 1 \end{bmatrix}, \quad x_{\text{cur}} = \frac{x'}{w'}, \quad y_{\text{cur}} = \frac{y'}{w'}$$

Conversely, when an operator clicks on the screen to place a new feature, the inverse homography $H^{-1}$ projects the click back into reference space:

$$\begin{bmatrix} X' \\ Y' \\ W' \end{bmatrix} = \mathbf{H}^{-1} \begin{bmatrix} x_{\text{screen}} \\ y_{\text{screen}} \\ 1 \end{bmatrix}, \quad X_{\text{ref}} = \frac{X'}{W'}, \quad Y_{\text{ref}} = \frac{Y'}{W'}$$

---

## 4. Detailed Feature Specifications

### 4.1 Computer Vision & Visual Registration Pipeline

| Parameter | Value / Default | Description |
| :--- | :--- | :--- |
| **Extraction Canvas** | $640 \times 360$ px | Downsampled dedicated offscreen buffer for sub-10ms frame processing |
| **Max Features** | 260 keypoints | Maximum corners retained after non-maximum suppression (NMS) |
| **Corner Detector** | FAST / Harris scoring | Multi-scale corner response across high-contrast terrain features |
| **Descriptor Format** | 256-bit binary | ORB/BRIEF-inspired binary pattern sampled from local intensity gradients |
| **Matcher** | Brute-force k-NN | Hamming distance matcher with Lowe's ratio test threshold ($\le 0.74$) |
| **Geometric Model** | Planar Homography ($3 \times 3$) | 4-point Direct Linear Transform (DLT) inside RANSAC loop |
| **RANSAC Threshold** | 4.5 px | Maximum reprojection error allowed for inlier classification |
| **RANSAC Iterations** | 160 iterations | Maximum random sample trials to identify dominant geometric consensus |
| **Min Inliers for Lock**| 8 inliers | Minimum verified correspondences required for `GOOD` registration state |
| **Temporal Smoothing** | $\alpha = 0.65$ | Exponential Moving Average (EMA) matrix filter to damp high-frequency jitter |
| **Refinement** | Least-Squares SVD | Iterative optimization over all consensus inliers post-RANSAC |

#### Registration States & Fail-Safe Behavior
* **`GOOD` (Green):** Inlier count $\ge \text{minInliers}$, reprojection error $\le 4.5\text{px}$. Overlays update smoothly.
* **`DEGRADED` (Amber):** Correspondence count falling ($4 \le \text{inliers} < 8$). Jitter damping increased.
* **`LOST` (Red / Flashing):** Inliers $< 4$ or degenerate matrix ($\det(H) \approx 0$). **Fail-safe lock:** Overlays freeze at their last reliable screen position to prevent disorienting jumps until visual lock is restored or the operator presses "Set View as Reference".
* **`UNINITIALIZED` (Slate):** No reference frame has been acquired.

---

### 4.2 Video Stream & Sensor Capture Subsystem

1. **Exercise Terrain Simulator:**
   * Procedural tactical training ground renderer with customizable terrain elevations, mountain ridges, roads, defensive works, bunkers, radar masts, and foliage.
   * Pan offset ($\pm 400\text{px}$), Tilt offset ($\pm 200\text{px}$), Zoom factor ($0.6\times$ to $2.2\times$).
   * Environmental vibration / vehicle turret jitter simulation.
   * Auto-patrol continuous panning mode.
   * **FLIR Thermal Imaging Mode:** Synthetic white-hot IR palette rendering hot targets against cold terrain.

2. **Mobile Device Rear Camera (Environment Mode):**
   * Hardware-accelerated `getUserMedia` binding with `facingMode: 'environment'`.
   * High-definition capture constraint resolution ($1920\times 1080$, $1280\times 720$, or $3840\times 2160$).
   * Automatic multi-device camera sensor enumeration (`videoinput`).
   * **Hardware Tactical Torch:** One-click toggle for physical camera LED flashlight on supported mobile devices.
   * Quick front/rear camera facing flip button.

3. **Webcam / System Camera:**
   * Universal support for USB webcams, integrated laptop sensors, and capture cards.

4. **RTSP IP Camera Ingestion (Architecture Config):**
   * Configurable RTSP stream URL (`rtsp://user:pass@ip:port/stream`).
   * Auto-reconnect interval (1–60s) and frame buffer size controls (1–10 frames).

5. **Reference Frame Management:**
   * Instantaneous "Set View as Reference" (Capture Reference) command via Toolbar, Fullscreen Ribbon, or Settings.
   * Resets the optical anchor to the current camera viewpoint, updating candidate keypoints.

---

### 4.3 Tactical Feature Library & Military Symbology

The system provides standard military tactical symbols, custom SVG/PNG/JPG graphics, and full-spectrum color overrides.

#### 4.3.1 Standard Feature Library

| Symbol Type | Name | Shape | Default Label | Default Color | NATO / Tactical Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tank` | Simulated Tank | Diamond | `SIM TANK 01` | `#ef4444` (Red) | Armored combat vehicle / main battle tank |
| `bunker` | Simulated Bunker | Square | `SIM BUNKER ALPHA` | `#f59e0b` (Amber) | Fortified defensive position / pillbox |
| `gun` | Simulated Gun | Cross | `SIM ARTY 01` | `#ec4899` (Magenta) | Artillery / direct fire weapon position |
| `comm` | Communications Node | Antenna | `SIM COMM NODE` | `#3b82f6` (Blue) | Tactical communications relay / radar post |
| `personnel` | Simulated Personnel | Circle | `SIM PERS 01` | `#10b981` (Green) | Dismounted squad / infantry patrol |
| `vehicle` | Simulated Vehicle | Rectangle | `SIM LOG VEH` | `#eab308` (Yellow) | Utility transport / logistics convoy |
| `observation_post`| Observation Post | Triangle | `SIM OP 01` | `#06b6d4` (Cyan) | Elevated forward observation post (OP) |
| `headquarters` | Headquarters | Star | `SIM EXERCISE HQ` | `#a855f7` (Purple) | Tactical Operations Center (TOC) / HQ |
| `custom` | Custom Symbol | Custom | `CUSTOM SYMBOL 01` | `#38bdf8` (Sky) | User-imported SVG, PNG, or JPG graphic |

#### 4.3.2 Custom Vector & Raster Graphic Importer
* Drag-and-drop or file upload for `.svg`, `.png`, and `.jpg` tactical symbols.
* Pre-loaded vector presets: Modern Main Battle Tank, Fortified Sentry Bunker, Tactical Radar Array, Precision Crosshair Reticle.
* Automatic SVG path recoloring and dynamic raster tinting.

#### 4.3.3 Full-Spectrum Feature Color Customization
* 11 quick-access military tactical presets:
  * Hostile / OPFOR (`#ef4444`)
  * Caution / Warning (`#f59e0b`)
  * Support / Logistics (`#eab308`)
  * Friendly / Infantry (`#10b981`)
  * Medical / Status (`#22c55e`)
  * Recon / Observation (`#06b6d4`)
  * Tactical AR / Air (`#38bdf8`)
  * Command / Comm (`#3b82f6`)
  * Headquarters / HQ (`#a855f7`)
  * Artillery / Fire Support (`#ec4899`)
  * Neutral / Mark (`#f8fafc`)
* Custom 6-character Hex code picker with live color swatch.
* Modifies symbol strokes, fill accents, callout border badges, and leader lines.

#### 4.3.4 Plotted Features Manager
* Search bar to filter placed features by callout label or unit type.
* Individual feature visibility toggle (Eye icon).
* Global "Hide All" / "Unhide All" features toggle.
* Inline feature color updating directly from the list.
* Individual feature deletion and 2-step protected bulk deletion.
* Interactive canvas selection and drag-and-drop repositioning.

---

### 4.4 Multi-Layer Boundary & Spatial Polygon Subsystem

1. **Multi-Layer Architecture:**
   * Unlimited named boundary layers (e.g., "SIMULATED / EXERCISE BOUNDARY", "PHASE LINE ALPHA", "FORWARD EDGE OF BATTLE AREA").
   * Independent line styling: 1px to 12px thickness slider.
   * Independent color palette (9 tactical presets plus hex input).
   * Open polyline or closed polygon geometry.
   * Adjustable polygon fill opacity (0% to 40%).

2. **Interactive Drawing Workflow:**
   * One-click "Draw Boundary" mode on canvas.
   * Crosshair cursor with live coordinate feedback.
   * Click-to-add vertex in reference frame coordinates.
   * Real-time rubberband preview to current mouse position.
   * Toolbar & modal controls: "Undo Last Point", "Complete / Finish Layer", and "Cancel Drawing".

3. **Boundary Layer Manager:**
   * Two-column management modal with layer hierarchy on the left and selected boundary properties on the right.
   * Visibility toggles per boundary and global "Hide All" / "Unhide All".
   * Rapid point-clearing and layer deletion.

4. **Safety & Exercise Markings:**
   * All boundary segments are explicitly watermarked and labeled according to military simulation standards.

---

### 4.5 User Interface, HUD & Viewport Controls

#### 4.5.1 Tactical Canvas HUD
* Military HUD corner brackets and center crosshair reticle with 1px fine cyan strokes.
* Dynamic status tags displaying Exercise Name, Reference Anchor Status, and Current Scale/Rotation.
* Watermark banner: `EXERCISE OVERLAY ONLY • NO GPS/INS • SIMULATED POSITIONS`.
* Visual debug overlays (toggleable):
  * Detected feature keypoints (cyan dots).
  * Feature correspondence match vectors (amber lines).
  * Consensus inlier vectors (emerald lines).

#### 4.5.2 Master Layer Visibility Switch
* Dedicated master toggle (`showAllLayers`):
  * **`LAYERS: ON`:** All tactical annotations, callout labels, and boundaries rendered normally.
  * **`LAYERS: HIDDEN`:** Instantly suppresses all tactical AR graphics with a single click, providing an unobstructed view of raw video feed without altering scenario state.
* Available on the Top Toolbar, Floating Fullscreen Ribbon, and Settings.

#### 4.5.3 Fullscreen Preview Mode
* Native browser fullscreen activation (`requestFullscreen`) with CSS container-level fallback for sandboxed iframe environments.
* Fast keyboard shortcuts: Press **`F`** to toggle fullscreen; press **`Esc`** to exit.
* Uncluttered tactical viewport accompanied by a floating glass status ribbon.

#### 4.5.4 Floating Glass Fullscreen Ribbon
* Centered bottom HUD docked to viewport.
* Real-time registration quality beacon (Green, Amber, Red) + live FPS readout.
* Master Layers Toggle (`LAYERS: ON` / `LAYERS: HIDDEN`).
* Quick-action buttons with active item counters:
  * `+ Symbol (N)` — Opens feature placement modal.
  * `Boundaries (N)` — Opens boundary manager.
  * `Set Ref` — Immediate reference frame snapshot.
  * `PTZ Controls` — Quick-docked simulator slider panel.
  * `Fullscreen Toggle` — Seamless return to windowed mode.
* Expandable secondary strip for video source selection (Sim / Cam / Rear) and settings.

#### 4.5.5 Diagnostics Inspector Drawer
* Real-time CV pipeline telemetry:
  * Registration state & processing time per frame in milliseconds.
  * Candidate keypoints (Reference vs Current frame).
  * Lowe's ratio match count & RANSAC inlier count.
  * Inlier consensus percentage & Mean Reprojection Error in pixels.
  * Complete $3 \times 3$ Homography Matrix live numerical readout:
    $$\begin{bmatrix} h_{00} & h_{01} & h_{02} \\ h_{10} & h_{11} & h_{12} \\ h_{20} & h_{21} & h_{22} \end{bmatrix}$$
  * Inferred camera movement decomposition:
    * Translation $\Delta X, \Delta Y$ (pixels).
    * Estimated scale / optical zoom ($s$).
    * Inferred roll / tilt angle ($\theta^\circ$).

---

### 4.6 Scenario Management & Portable Data Interchange

1. **Pre-configured Military Scenarios:**
   * **Exercise Crimson Shield (Fort Stewart OP-4):** Combined arms defense scenario with main battle tanks, defensive bunkers, observation posts, communications nodes, and anti-tank perimeter lines.
   * **Exercise Desert Sentinel (Sector Baker):** Desert range defense exercise featuring artillery batteries, logistics convoys, tactical command headquarters, and defense perimeter wire.

2. **Scenario Data Persistence:**
   * Operator modifications and custom scenarios saved to browser `localStorage`.
   * Standard JSON format export for offline archiving and tactical handoff.
   * File-picker JSON import with schema validation.

3. **Data Interchange Schema (Version 1.0):**
```json
{
  "version": 1,
  "scenario_name": "Exercise Crimson Shield - OP-4",
  "description": "Tactical exercise defense scenario",
  "created_at": "2026-09-24T23:30:00Z",
  "camera": {
    "rtsp_url": "rtsp://exercise-control:sec88@192.168.1.100:554/live",
    "resolution": [1920, 1080]
  },
  "features": [
    {
      "id": "feat_1",
      "type": "tank",
      "x": 480,
      "y": 380,
      "label": "SIM TANK 01",
      "rotation": 45,
      "scale": 1.0,
      "color": "#ef4444",
      "customImage": null,
      "customImageType": null
    }
  ],
  "boundaries": [
    {
      "id": "bnd_1",
      "name": "SIMULATED / EXERCISE BOUNDARY",
      "points": [[240, 480], [420, 520], [710, 500]],
      "color": "#ef4444",
      "thickness": 3,
      "visible": true,
      "isClosed": false,
      "fillOpacity": 0.08
    }
  ],
  "registration": {
    "method": "ORB_RANSAC_HOMOGRAPHY",
    "match_threshold": 0.74,
    "min_inliers": 8
  }
}
```

---

### 4.8. ONVIF Profile S/T PTZ Camera Control System

VAAS provides native implementation of the standard ONVIF Profile S/T PTZ specification, supporting physical IP cameras and an integrated high-fidelity Virtual Motor emulator:

1. **Continuous Move Control:**
   * **8-Directional Vector Control:** Pan/Tilt directional velocity vector $(x \in [-1.0, 1.0], y \in [-1.0, 1.0])$ and Zoom velocity $z \in [-1.0, 1.0]$.
   * **Press-and-Hold Interface:** Mouse/Touch down triggers continuous slewing; release dispatches an ONVIF `<Stop>` request with `PanTilt=true` and `Zoom=true`.
   * **Variable Slew Speed:** Global velocity scaler (0.1x to 1.0x) governing maximum degrees/sec.

2. **Absolute & Relative Positioning:**
   * **Degree Inputs:** Operator can input absolute Pan ($-180^\circ$ to $+180^\circ$), Tilt ($-90^\circ$ to $+90^\circ$), and Zoom ($0.6\times$ to $30.0\times$) for direct slewing.
   * **Incremental Jog:** Step buttons for fast $1^\circ$, $5^\circ$, and $15^\circ$ calibration.

3. **Preset Management:**
   * **Preset Creation:** Stores active PTZ coordinates under custom tokens and tactical labels (e.g. `NORTH OBSERVATION`, `EAST CHECKPOINT`).
   * **Instant Preset Slew:** Dispatches `<GotoPreset>` to steer the physical/virtual PTZ motor to saved coordinates.
   * **Preset Deletion:** `<RemovePreset>` cleans up scenario records.

4. **Home Positioning:**
   * `<GotoHome>` slews the camera to calibrated baseline ($0^\circ$ Azimuth, $0^\circ$ Elevation, $1.0\times$ Zoom).

5. **SOAP Envelope Inspection & Virtual Emulation:**
   * Live protocol drawer reveals active XML envelopes (`<ContinuousMove>`, `<AbsoluteMove>`, `<SetPreset>`, `<GetStatus>`).
   * Virtual PTZ mode models mechanical inertia, motor acceleration, and deceleration curves, ensuring full fidelity even when running in air-gapped test labs without physical ONVIF IP hardware.

---

### 4.9. Server-Side FFmpeg Ingestion & Transcoding Gateway

To overcome web browser limitations regarding direct RTSP TCP/UDP ingestion, VAAS features an Express-backed FFmpeg gateway service:

1. **RTSP Stream Remuxing & Transcoding:**
   * Ingests H.264/H.265 RTSP streams (`rtsp://user:pass@camera:554/live`) using configurable TCP or UDP transport.
   * Transcodes streams into standard `multipart/x-mixed-replace; boundary=ffserver` (MJPEG), directly renderable by HTML5 `<canvas>` and `<img>` elements with sub-frame display latency.

2. **Synthetic Tactical Video Generator:**
   * In the absence of an external RTSP feed, FFmpeg generates a test video stream utilizing `testsrc2`, rendering a real-time SMPTE timecode burn-in and tactical military grid overlay (`drawgrid=width=128:height=72`).

3. **Pipeline Lifecycle & Telemetry:**
   * Subprocess supervision (`spawn('ffmpeg', ...)`), active PID tracking, uptime tracking, output FPS, frame counters, and real-time capture of stderr process logs.
   * Instantaneous JPEG frame snapshots via `/api/ffmpeg/snapshot`.

---

### 4.10. PTZ Spatial Memory & Coordinate-Referenced Object Tracking

To ensure simulated objects remain perfectly positioned regardless of camera movement, VAAS couples spherical trigonometry with planar computer vision:

1. **Screen to PTZ Spherical Projection:**
   * An object placed at screen coordinates $(x_s, y_s)$ on a canvas of dimensions $(W, H)$ is mapped to its angular offset from the optical boresight:
     $$u = \frac{x_s - W/2}{W/2}, \quad v = -\frac{y_s - H/2}{H/2}$$
     $$\Delta\theta = \arctan\left(u \cdot \tan\left(\frac{FOV_H(Z)}{2}\right)\right)$$
     $$\Delta\phi = \arctan\left(v \cdot \tan\left(\frac{FOV_V(Z)}{2}\right)\right)$$
   * Absolute world PTZ coordinates:
     $$\theta_{world} = \text{normalize}(\theta_{cam} + \Delta\theta)$$
     $$\phi_{world} = \text{clamp}(\phi_{cam} + \Delta\phi, -90^\circ, 90^\circ)$$
   * The object retains an immutable `ptzAnchor` containing Azimuth, Elevation, Zoom factor, and placement FOV.

2. **Dynamic Frustum Culling & Screen Reprojection:**
   * As the PTZ camera turns, relative angles are computed:
     $$\Delta\theta_{rel} = \theta_{world} - \theta_{cam}, \quad \Delta\phi_{rel} = \phi_{world} - \phi_{cam}$$
   * If $|\Delta\theta_{rel}| \le FOV_H / 2$ and $|\Delta\phi_{rel}| \le FOV_V / 2$, the object is inside the camera frustum and reprojected to screen pixels $(x_{cur}, y_{cur})$.

3. **Hybrid Kinematic + CV Homography Fusion:**
   * When visual feature registration is active (`GOOD` quality), planar homography coordinates and PTZ trigonometric predictions are fused:
     $$\mathbf{p}_{final} = w_{ptz} \cdot \mathbf{p}_{ptz} + (1 - w_{ptz}) \cdot \mathbf{p}_{homo}$$
   * During fast slew or motion blur ($w_{ptz} \to 0.85$), PTZ telemetry maintains rock-solid position without drifting. In steady state ($w_{ptz} \to 0.15$), CV homography locks the symbol to micro-terrain textures.

4. **Off-Screen Tactical Directional Indicators:**
   * When an object is outside the current frustum, an indicator chevron appears on the perimeter of the canvas pointing in the direction of the target, annotated with target name and delta bearing (e.g., `TANK 01 ⮞ +42°`).
   * Clicking an off-screen indicator immediately commands the ONVIF PTZ camera to slew to that target.

5. **360° Tactical Radar Dome & Object Catalog:**
   * Dedicated Spatial Memory Registry displays a circular radar dome showing camera heading, active FOV cone, and all remembered objects plotted as tactical blips.
   * Allows operator to review all off-screen targets and execute one-click **"Slew to Object"** commands.

---

## 5. Technical Limitations & Operational Safety Constraints

Operators and exercise planners must adhere to the following mandatory technical constraints:

1. **No Geodetic Positioning:** The system does not possess latitude, longitude, or altitude awareness. All tactical elements exist in pixel reference coordinates relative to visual terrain features.
2. **No Absolute Heading / Compass:** Simulated compass headers and reticle orientation reflect relative camera rotations against the reference frame, not true north or magnetic heading.
3. **Planar Homography & Parallax Assumption:** A single $3 \times 3$ homography assumes the scene is planar or the camera undergoes pure rotation (pan/tilt/roll) and optical zoom. Large translational motion relative to objects with significant depth disparity (near trees vs distant mountains) will introduce parallax error.
4. **Featureless & Low-Contrast Terrain:** Tracking requires distinct visual texture. In uniform fog, featureless snow, flat calm water, or sudden total occlusion, the system will enter `LOST` status and freeze overlays until visually distinctive terrain re-enters the field of view.
5. **Non-Kinetic Simulation Disclaimer:** Overlays, boundaries, and unit positions are simulated for exercise purposes only and must not be used for real-world kinetic targeting or real-time navigation.

---

## 6. Performance & Quality Benchmarks

| Metric | Target Specification | Achieved Base |
| :--- | :--- | :--- |
| **Pipeline Frame Rate** | $\ge 30\text{ FPS}$ | 30–60 FPS on standard modern GPUs / CPUs |
| **CV Execution Latency** | $\le 12\text{ ms}$ per frame | 3.5 ms – 6.5 ms (Offscreen $640\times 360$ canvas) |
| **Reprojection Accuracy** | Mean error $< 5.0\text{ px}$ | $1.2\text{ px} - 3.8\text{ px}$ under nominal PTZ |
| **Memory Footprint** | $< 150\text{ MB}$ client heap | $\sim 45\text{ MB} - 75\text{ MB}$ |
| **Recovery from Loss** | $< 100\text{ ms}$ upon re-entering reference field | Immediate upon matching $\ge 8$ inliers |

---

## 7. Future Roadmap & Extensibility

* **Monocular Depth Estimation / Multi-Plane Homography:** Piecewise homography planar meshes for complex 3D urban terrain.
* **Server-Authoritative Multi-User Tactical Sync:** WebSocket / WebRTC data-channel relay allowing an Exercise Controller (EXCON) to push simulated targets to multiple forward observers in real time.
* **Tactical Symbol Standard Expansion:** Native 2525D / APP-6 hierarchical vector symbol builder with SIDC code generation.
* **Offline PWA & Edge Deployment:** Progressive Web App manifest with offline service workers for field deployment on completely air-gapped tactical tablets.
