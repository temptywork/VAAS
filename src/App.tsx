import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ExerciseFeature,
  ExerciseBoundary,
  BoundaryPoint,
  BoundaryConfig,
  CameraConfig,
  FeatureType,
  OverlaySettings,
  RegistrationMetrics,
  RegistrationSettings,
  ScenarioData,
} from './types';
import { VisualRegistrationEngine } from './cv/registrationEngine';
import { TacticalCanvas } from './components/TacticalCanvas';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { AddFeatureModal, CustomPlacementOptions } from './components/AddFeatureModal';
import { BoundaryConfigModal } from './components/BoundaryConfigModal';
import { ScenarioModal } from './components/ScenarioModal';
import { SettingsModal } from './components/SettingsModal';
import { ExerciseSimulatorControls } from './components/ExerciseSimulatorControls';
import { DiagnosticsDrawer } from './components/DiagnosticsDrawer';
import { DEFAULT_SCENARIOS } from './data/defaultScenarios';
import { ExerciseTerrainRenderer, SimulatorCameraState } from './components/ExerciseTerrainRenderer';
import { FEATURE_LIBRARY } from './data/featureDefinitions';

export default function App() {
  // Visual Registration CV Engine Instance
  const engineRef = useRef<VisualRegistrationEngine>(new VisualRegistrationEngine());
  const cvCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cvTerrainRendererRef = useRef<ExerciseTerrainRenderer>(new ExerciseTerrainRenderer());
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Camera & Stream State
  const [sourceType, setSourceType] = useState<'simulator' | 'webcam' | 'rtsp'>('simulator');
  const [rtspUrl, setRtspUrl] = useState<string>('rtsp://exercise-control:sec88@192.168.1.100:554/live');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  // Simulator Camera PTZ State
  const [simState, setSimState] = useState<SimulatorCameraState>({
    panX: 0,
    tiltY: 0,
    zoom: 1.0,
    jitter: 0,
    time: 0,
    flirThermal: false,
    autoPatrol: false,
  });

  // Exercise Overlay Features & Boundaries (Loaded with Exercise Crimson Shield initial setup)
  const [scenarioName, setScenarioName] = useState<string>(DEFAULT_SCENARIOS[0].scenario_name);
  const [features, setFeatures] = useState<ExerciseFeature[]>(() =>
    DEFAULT_SCENARIOS[0].features.map((f) => ({
      ...f,
      visible: true,
      createdAt: Date.now(),
    }))
  );

  // Multi-boundary state management
  const [boundaries, setBoundaries] = useState<ExerciseBoundary[]>(() => {
    const sc = DEFAULT_SCENARIOS[0];
    if (sc.boundaries && sc.boundaries.length > 0) {
      return sc.boundaries.map((b) => ({ ...b, visible: b.visible !== false }));
    }
    return [
      {
        id: 'boundary-crimson-perimeter',
        name: sc.boundary_config?.name || 'CRIMSON EXERCISE PERIMETER',
        color: sc.boundary_config?.color || '#ef4444',
        thickness: sc.boundary_config?.thickness || 3,
        points: sc.boundary || [],
        isClosed: sc.boundary_config?.closed ?? false,
        fillOpacity: sc.boundary_config?.fillOpacity ?? 0.08,
        visible: true,
      },
    ];
  });
  const [selectedBoundaryId, setSelectedBoundaryId] = useState<string | null>(() => {
    const sc = DEFAULT_SCENARIOS[0];
    return sc.boundaries && sc.boundaries[0] ? sc.boundaries[0].id : 'boundary-crimson-perimeter';
  });
  const [activeDrawingBoundaryId, setActiveDrawingBoundaryId] = useState<string | null>(null);

  const [boundary, setBoundary] = useState<BoundaryPoint[]>(DEFAULT_SCENARIOS[0].boundary || []);
  const [boundaryConfig, setBoundaryConfig] = useState<BoundaryConfig>(() => {
    return (
      DEFAULT_SCENARIOS[0].boundary_config || {
        name: 'SIMULATED / EXERCISE BOUNDARY',
        color: '#ef4444',
        thickness: 3,
        closed: false,
        fillOpacity: 0.08,
      }
    );
  });
  const [activeBoundaryPoints, setActiveBoundaryPoints] = useState<BoundaryPoint[]>([]);
  const [isDrawingBoundary, setIsDrawingBoundary] = useState<boolean>(false);
  const [isBoundaryConfigOpen, setIsBoundaryConfigOpen] = useState<boolean>(false);

  // Pending Placement States
  const [pendingFeatureType, setPendingFeatureType] = useState<FeatureType | null>(null);
  const [pendingFeatureLabel, setPendingFeatureLabel] = useState<string>('');
  const [pendingFeatureRotation, setPendingFeatureRotation] = useState<number>(0);
  const [pendingFeatureOptions, setPendingFeatureOptions] = useState<CustomPlacementOptions>({});
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);

  // Registration Metrics & Configuration
  const [registrationMetrics, setRegistrationMetrics] = useState<RegistrationMetrics>({
    quality: 'UNINITIALIZED',
    inliers: 0,
    totalMatches: 0,
    candidateKeypointsRef: 0,
    candidateKeypointsCur: 0,
    reprojectionError: 0,
    homography: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    fps: 30,
    processingTimeMs: 4.2,
    scaleEstimate: 1,
    rotationEstimateDeg: 0,
    translationEstimate: [0, 0],
  });

  const [cameraConfig, setCameraConfig] = useState<CameraConfig>({
    sourceType: 'simulator',
    rtspUrl: 'rtsp://exercise-control:sec88@192.168.1.100:554/live',
    resolution: [1280, 720],
    fps: 30,
    bufferSize: 2,
    reconnectIntervalSec: 5,
  });

  const [regSettings, setRegSettings] = useState<RegistrationSettings>({
    enabled: true,
    maxFeatures: 220,
    matchRatioThreshold: 0.74,
    ransacThresholdPx: 4.5,
    minInliers: 8,
    adaptiveReference: false,
    updateIntervalMs: 33,
  });

  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    symbolScale: 1.0,
    textSize: 12,
    opacity: 0.9,
    boundaryThickness: 3,
    showLabels: true,
    showSymbols: true,
    showBoundary: true,
    showTrackingFeatures: false,
    showMatchVectors: false,
    showHUD: true,
    flirThermalMode: false,
  });

  // Modals & Drawers
  const [isAddFeatureOpen, setIsAddFeatureOpen] = useState<boolean>(false);
  const [scenarioModalMode, setScenarioModalMode] = useState<'save' | 'load' | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [showSimControls, setShowSimControls] = useState<boolean>(true);

  // Local Scenario Catalog
  const [savedScenarios, setSavedScenarios] = useState<ScenarioData[]>(() => {
    try {
      const stored = localStorage.getItem('rtsp_exercise_saved_scenarios');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync FLIR setting with simState
  useEffect(() => {
    setSimState((prev) => ({ ...prev, flirThermal: overlaySettings.flirThermalMode }));
  }, [overlaySettings.flirThermalMode]);

  // Sync Reg Settings with Engine
  useEffect(() => {
    engineRef.current.settings = { ...regSettings };
  }, [regSettings]);

  // Setup Offscreen Canvas for Computer Vision Frame Extraction (640x360 for high FPS)
  useEffect(() => {
    const cvCanvas = document.createElement('canvas');
    cvCanvas.width = 640;
    cvCanvas.height = 360;
    cvCanvasRef.current = cvCanvas;
  }, []);

  // Handle Webcam Source Switch
  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let videoEl: HTMLVideoElement | null = null;

    if (sourceType === 'webcam' && isConnected) {
      videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;

      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 1280, height: 720 } })
        .then((stream) => {
          currentStream = stream;
          if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.play();
            videoElementRef.current = videoEl;
            setVideoElement(videoEl);
          }
        })
        .catch((err) => {
          console.warn('Webcam stream error:', err);
          alert('Unable to access webcam. Switching back to Exercise Feed Simulator.');
          setSourceType('simulator');
        });
    } else {
      if (videoElementRef.current) {
        const stream = videoElementRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach((track) => track.stop());
        videoElementRef.current = null;
        setVideoElement(null);
      }
    }

    return () => {
      currentStream?.getTracks().forEach((track) => track.stop());
    };
  }, [sourceType, isConnected]);

  // Set initial Reference Frame once canvas is mounted
  const captureAndSetReference = useCallback(() => {
    const cvCanvas = cvCanvasRef.current;
    if (!cvCanvas) return;
    const ctx = cvCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (sourceType === 'simulator') {
      cvTerrainRendererRef.current.render(ctx, 640, 360, simState);
    } else if (sourceType === 'webcam' && videoElementRef.current && videoElementRef.current.readyState >= 2) {
      ctx.drawImage(videoElementRef.current, 0, 0, 640, 360);
    } else {
      // Fallback synthetic texture
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 640, 360);
    }

    const imgData = ctx.getImageData(0, 0, 640, 360);
    const dataUrl = cvCanvas.toDataURL('image/jpeg', 0.85);
    const { keypointCount } = engineRef.current.setReferenceFrame(imgData, dataUrl);
    console.log(`Reference frame established with ${keypointCount} features.`);
  }, [sourceType, simState]);

  // Establish initial reference frame on mount / connection
  useEffect(() => {
    if (isConnected) {
      // Brief delay to allow canvases/video elements to initialize
      const timer = setTimeout(() => {
        captureAndSetReference();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isConnected, captureAndSetReference]);

  // Main CV Processing Loop (at 30 FPS)
  useEffect(() => {
    if (!isConnected) return;

    let intervalId: number;
    let autoPatrolAngle = 0;

    const processCVFrame = () => {
      const cvCanvas = cvCanvasRef.current;
      if (!cvCanvas) return;
      const ctx = cvCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Update simulation time & auto-patrol
      setSimState((prev) => {
        const nextTime = prev.time + 33;
        if (prev.autoPatrol) {
          autoPatrolAngle += 0.02;
          const patrolPan = Math.sin(autoPatrolAngle) * 120;
          return { ...prev, time: nextTime, panX: patrolPan };
        }
        return { ...prev, time: nextTime };
      });

      // Render into CV canvas at 640x360
      if (sourceType === 'simulator') {
        cvTerrainRendererRef.current.render(ctx, 640, 360, simState);
      } else if (sourceType === 'webcam' && videoElementRef.current && videoElementRef.current.readyState >= 2) {
        ctx.drawImage(videoElementRef.current, 0, 0, 640, 360);
      }

      const imgData = ctx.getImageData(0, 0, 640, 360);
      const metrics = engineRef.current.processFrame(imgData);
      setRegistrationMetrics(metrics);
    };

    intervalId = window.setInterval(processCVFrame, regSettings.updateIntervalMs || 33);
    return () => clearInterval(intervalId);
  }, [isConnected, sourceType, simState, regSettings.updateIntervalMs]);

  // Feature Placement Handler
  const handleSelectFeatureForPlacement = (
    type: FeatureType,
    label: string,
    rotation: number,
    options?: CustomPlacementOptions
  ) => {
    setPendingFeatureType(type);
    setPendingFeatureLabel(label);
    setPendingFeatureRotation(rotation);
    setPendingFeatureOptions(options || {});
    setIsDrawingBoundary(false);
  };

  const handleAddFeaturePoint = (refPoint: [number, number]) => {
    if (!pendingFeatureType) return;
    const def = FEATURE_LIBRARY[pendingFeatureType];
    const newFeature: ExerciseFeature = {
      id: `feat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: pendingFeatureType,
      x: refPoint[0],
      y: refPoint[1],
      label: pendingFeatureLabel || def?.defaultLabel || 'SIM FEATURE',
      rotation: pendingFeatureRotation,
      scale: pendingFeatureOptions.scale || 1.0,
      color: pendingFeatureOptions.color || def?.color,
      customImage: pendingFeatureOptions.customImage,
      customImageType: pendingFeatureOptions.customImageType,
      visible: true,
      createdAt: Date.now(),
    };

    setFeatures((prev) => [...prev, newFeature]);
    setSelectedFeatureId(newFeature.id);
    setPendingFeatureType(null);
    setPendingFeatureLabel('');
    setPendingFeatureOptions({});
  };

  // Boundary Management Handlers (Multi-boundary support)
  const handleAddBoundary = () => {
    const palette = ['#ef4444', '#f59e0b', '#38bdf8', '#22c55e', '#a855f7', '#eab308', '#ec4899'];
    const newB: ExerciseBoundary = {
      id: `boundary_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `PHASE LINE ${String.fromCharCode(65 + (boundaries.length % 26))}`,
      color: palette[boundaries.length % palette.length],
      thickness: 3,
      points: [],
      isClosed: false,
      fillOpacity: 0.08,
      visible: true,
    };
    setBoundaries((prev) => [...prev, newB]);
    setSelectedBoundaryId(newB.id);
  };

  const handleUpdateBoundary = (updated: ExerciseBoundary) => {
    setBoundaries((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleDeleteBoundary = (id: string) => {
    setBoundaries((prev) => {
      const filtered = prev.filter((b) => b.id !== id);
      if (selectedBoundaryId === id) {
        setSelectedBoundaryId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const handleToggleBoundaryVisibility = (id: string) => {
    setBoundaries((prev) =>
      prev.map((b) => (b.id === id ? { ...b, visible: b.visible === false ? true : false } : b))
    );
  };

  const handleClearBoundaryPoints = (id: string) => {
    setBoundaries((prev) => prev.map((b) => (b.id === id ? { ...b, points: [] } : b)));
    if (activeDrawingBoundaryId === id) {
      setActiveBoundaryPoints([]);
    }
    setBoundary([]);
  };

  const handleStartDrawingBoundary = (boundaryId?: string) => {
    const targetId = boundaryId || selectedBoundaryId || (boundaries[0]?.id ?? null);
    if (!targetId) {
      // Create new boundary first
      const newB: ExerciseBoundary = {
        id: `boundary_${Date.now()}`,
        name: `BOUNDARY ${boundaries.length + 1}`,
        color: '#38bdf8',
        thickness: 3,
        points: [],
        isClosed: false,
        fillOpacity: 0.08,
        visible: true,
      };
      setBoundaries((prev) => [...prev, newB]);
      setSelectedBoundaryId(newB.id);
      setActiveDrawingBoundaryId(newB.id);
      setActiveBoundaryPoints([]);
    } else {
      setActiveDrawingBoundaryId(targetId);
      setSelectedBoundaryId(targetId);
      const target = boundaries.find((b) => b.id === targetId);
      setActiveBoundaryPoints(target?.points ? [...target.points] : []);
    }
    setIsDrawingBoundary(true);
    setPendingFeatureType(null);
  };

  const handleAddBoundaryPoint = (refPoint: [number, number]) => {
    setActiveBoundaryPoints((prev) => [...prev, refPoint]);
  };

  const handleFinishBoundary = () => {
    if (activeDrawingBoundaryId) {
      setBoundaries((prev) =>
        prev.map((b) =>
          b.id === activeDrawingBoundaryId ? { ...b, points: activeBoundaryPoints } : b
        )
      );
      setBoundary(activeBoundaryPoints);
    } else if (activeBoundaryPoints.length >= 2) {
      const newB: ExerciseBoundary = {
        id: `boundary_${Date.now()}`,
        name: `BOUNDARY ${boundaries.length + 1}`,
        color: '#ef4444',
        thickness: 3,
        points: activeBoundaryPoints,
        isClosed: false,
        fillOpacity: 0.08,
        visible: true,
      };
      setBoundaries((prev) => [...prev, newB]);
      setSelectedBoundaryId(newB.id);
      setBoundary(activeBoundaryPoints);
    }
    setActiveBoundaryPoints([]);
    setActiveDrawingBoundaryId(null);
    setIsDrawingBoundary(false);
  };

  const handleClearLastBoundaryPoint = () => {
    setActiveBoundaryPoints((prev) => prev.slice(0, -1));
  };

  const handleCancelBoundary = () => {
    setActiveBoundaryPoints([]);
    setActiveDrawingBoundaryId(null);
    setIsDrawingBoundary(false);
  };

  const handleClearAll = () => {
    setFeatures([]);
    setBoundaries([]);
    setBoundary([]);
    setActiveBoundaryPoints([]);
    setActiveDrawingBoundaryId(null);
    setIsDrawingBoundary(false);
    setSelectedFeatureId(null);
    setSelectedBoundaryId(null);
  };

  // Scenario Save & Load Handlers (PRD Section 23 & 26)
  const handleSaveScenario = (name: string, description: string) => {
    const refImg = engineRef.current.getReferenceImage();
    const scenario: ScenarioData = {
      version: 1,
      scenario_name: name,
      description,
      created_at: new Date().toISOString(),
      camera: {
        rtsp_url: rtspUrl,
        resolution: [1280, 720],
      },
      features: features.map((f) => ({
        id: f.id,
        type: f.type,
        x: Math.round(f.x),
        y: Math.round(f.y),
        label: f.label,
        rotation: f.rotation,
        scale: f.scale,
        color: f.color,
        customImage: f.customImage,
        customImageType: f.customImageType,
      })),
      boundaries: boundaries.map((b) => ({
        ...b,
        points: b.points.map(([x, y]) => [Math.round(x), Math.round(y)]),
      })),
      boundary: (boundaries[0]?.points || boundary || []).map(([x, y]) => [
        Math.round(x),
        Math.round(y),
      ]),
      boundary_config: boundaries[0]
        ? {
            name: boundaries[0].name,
            color: boundaries[0].color,
            thickness: boundaries[0].thickness,
            closed: boundaries[0].isClosed,
            fillOpacity: boundaries[0].fillOpacity,
          }
        : boundaryConfig,
      registration: {
        method: 'ORB_RANSAC_HOMOGRAPHY',
        match_threshold: regSettings.matchRatioThreshold,
        min_inliers: regSettings.minInliers,
      },
      reference_image: refImg || undefined,
    };

    // Save to local storage
    const updated = [scenario, ...savedScenarios.filter((s) => s.scenario_name !== name)];
    setSavedScenarios(updated);
    try {
      localStorage.setItem('rtsp_exercise_saved_scenarios', JSON.stringify(updated));
    } catch (e) {
      console.warn('Storage full', e);
    }

    // Trigger instant JSON file download with VAAS naming
    const blob = new Blob([JSON.stringify(scenario, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vaas_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_scenario.json`;
    a.click();
    URL.revokeObjectURL(url);
    setScenarioName(name);
  };

  const handleLoadScenario = (scenario: ScenarioData) => {
    setScenarioName(scenario.scenario_name);
    setFeatures(
      scenario.features.map((f) => ({
        id: f.id,
        type: f.type,
        x: f.x,
        y: f.y,
        label: f.label,
        rotation: f.rotation || 0,
        scale: f.scale || 1.0,
        color: f.color,
        customImage: f.customImage,
        customImageType: f.customImageType,
        visible: true,
        createdAt: Date.now(),
      }))
    );

    if (scenario.boundaries && scenario.boundaries.length > 0) {
      setBoundaries(scenario.boundaries.map((b) => ({ ...b, visible: b.visible !== false })));
      setSelectedBoundaryId(scenario.boundaries[0].id);
    } else if (scenario.boundary && scenario.boundary.length > 0) {
      const legacyB: ExerciseBoundary = {
        id: `boundary_${Date.now()}`,
        name: scenario.boundary_config?.name || 'SIMULATED / EXERCISE BOUNDARY',
        color: scenario.boundary_config?.color || '#ef4444',
        thickness: scenario.boundary_config?.thickness || 3,
        points: scenario.boundary,
        isClosed: scenario.boundary_config?.closed ?? false,
        fillOpacity: scenario.boundary_config?.fillOpacity ?? 0.08,
        visible: true,
      };
      setBoundaries([legacyB]);
      setSelectedBoundaryId(legacyB.id);
    } else {
      setBoundaries([]);
      setSelectedBoundaryId(null);
    }

    setBoundary(scenario.boundary || []);
    if (scenario.boundary_config) {
      setBoundaryConfig(scenario.boundary_config);
    }
    setActiveBoundaryPoints([]);
    setActiveDrawingBoundaryId(null);
    setIsDrawingBoundary(false);

    if (scenario.camera?.rtsp_url) {
      setRtspUrl(scenario.camera.rtsp_url);
    }

    // Re-reference to current frame
    setTimeout(() => {
      captureAndSetReference();
    }, 150);
  };

  const handleDeleteSavedScenario = (idx: number) => {
    const updated = savedScenarios.filter((_, i) => i !== idx);
    setSavedScenarios(updated);
    localStorage.setItem('rtsp_exercise_saved_scenarios', JSON.stringify(updated));
  };

  // Feature counts by type for sequential labeling (e.g. SIM TANK 02)
  const existingCountByType = features.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      id="rtsp-exercise-system-root"
      className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none"
    >
      {/* Top Application Header & Toolbar */}
      <Toolbar
        sourceType={sourceType}
        onChangeSourceType={(type) => {
          setSourceType(type);
          setTimeout(() => captureAndSetReference(), 200);
        }}
        rtspUrl={rtspUrl}
        onChangeRtspUrl={setRtspUrl}
        isConnected={isConnected}
        onConnect={() => {
          setIsConnected(true);
          setTimeout(() => captureAndSetReference(), 200);
        }}
        onDisconnect={() => setIsConnected(false)}
        isDrawingBoundary={isDrawingBoundary}
        activeBoundaryPointsCount={activeBoundaryPoints.length}
        onStartBoundary={() => handleStartDrawingBoundary()}
        onFinishBoundary={handleFinishBoundary}
        onClearLastBoundaryPoint={handleClearLastBoundaryPoint}
        onCancelBoundary={handleCancelBoundary}
        onClearAll={handleClearAll}
        boundaryConfig={boundaries.find((b) => b.id === selectedBoundaryId) || boundaries[0]}
        boundariesCount={boundaries.length}
        onOpenBoundaryConfig={() => setIsBoundaryConfigOpen(true)}
        onOpenAddFeature={() => setIsAddFeatureOpen(true)}
        onOpenSaveScenario={() => setScenarioModalMode('save')}
        onOpenLoadScenario={() => setScenarioModalMode('load')}
        onSetCurrentAsReference={captureAndSetReference}
        visualRegEnabled={regSettings.enabled}
        onToggleVisualReg={() =>
          setRegSettings((prev) => ({ ...prev, enabled: !prev.enabled }))
        }
        showDiagnostics={showDiagnostics}
        onToggleDiagnostics={() => setShowDiagnostics((prev) => !prev)}
        showSimControls={showSimControls}
        onToggleSimControls={() => setShowSimControls((prev) => !prev)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        registrationQuality={registrationMetrics.quality}
        hasReference={registrationMetrics.quality !== 'UNINITIALIZED'}
      />

      {/* Main Single Live-Video Canvas (PRD Section 1, 6, 27) */}
      <div id="tactical-canvas-viewport" className="relative flex-1 w-full h-full min-h-0 bg-black">
        <TacticalCanvas
          engine={engineRef.current}
          sourceType={sourceType}
          simState={simState}
          features={features}
          boundaries={boundaries}
          boundary={boundary}
          boundaryConfig={boundaries.find((b) => b.id === selectedBoundaryId) || boundaries[0]}
          activeBoundaryConfig={
            boundaries.find((b) => b.id === activeDrawingBoundaryId) || undefined
          }
          activeBoundaryPoints={activeBoundaryPoints}
          isDrawingBoundary={isDrawingBoundary}
          pendingFeatureType={pendingFeatureType}
          pendingFeatureLabel={pendingFeatureLabel}
          pendingFeatureCustomImage={pendingFeatureOptions.customImage}
          onAddFeaturePoint={handleAddFeaturePoint}
          onAddBoundaryPoint={handleAddBoundaryPoint}
          onSelectFeature={(feat) => setSelectedFeatureId(feat ? feat.id : null)}
          selectedFeatureId={selectedFeatureId}
          onUpdateFeature={(updated) =>
            setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
          }
          onDeleteFeature={(id) => {
            setFeatures((prev) => prev.filter((f) => f.id !== id));
            setSelectedFeatureId(null);
          }}
          registrationMetrics={registrationMetrics}
          overlaySettings={overlaySettings}
          videoElement={videoElement}
        />

        {/* Floating Simulator PTZ Controls (when in Simulator mode) */}
        {sourceType === 'simulator' && (
          <ExerciseSimulatorControls
            isOpen={showSimControls}
            onClose={() => setShowSimControls(false)}
            state={simState}
            onChangeState={setSimState}
          />
        )}

        {/* Floating Diagnostics Inspector Drawer */}
        <DiagnosticsDrawer
          isOpen={showDiagnostics}
          onClose={() => setShowDiagnostics(false)}
          metrics={registrationMetrics}
          settings={regSettings}
          engine={engineRef.current}
        />
      </div>

      {/* Bottom Status Bar (PRD Section 6 & 29) */}
      <StatusBar
        isConnected={isConnected}
        registrationMetrics={registrationMetrics}
        featureCount={features.length}
        boundariesCount={boundaries.length}
        boundaryPointCount={
          boundaries.reduce((sum, b) => sum + (b.visible !== false ? b.points.length : 0), 0) +
          (isDrawingBoundary ? activeBoundaryPoints.length : 0)
        }
        isDrawingBoundary={isDrawingBoundary}
        minInliersThreshold={regSettings.minInliers}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Modals */}
      <AddFeatureModal
        isOpen={isAddFeatureOpen}
        onClose={() => setIsAddFeatureOpen(false)}
        onSelectFeatureForPlacement={handleSelectFeatureForPlacement}
        existingCountByType={existingCountByType}
        plottedFeatures={features}
        onDeleteFeature={(id) => {
          setFeatures((prev) => prev.filter((f) => f.id !== id));
          if (selectedFeatureId === id) setSelectedFeatureId(null);
        }}
        onDeleteAllFeatures={() => {
          setFeatures([]);
          setSelectedFeatureId(null);
        }}
      />

      <BoundaryConfigModal
        isOpen={isBoundaryConfigOpen}
        onClose={() => setIsBoundaryConfigOpen(false)}
        boundaries={boundaries}
        selectedBoundaryId={selectedBoundaryId}
        onSelectBoundary={setSelectedBoundaryId}
        onAddBoundary={handleAddBoundary}
        onUpdateBoundary={handleUpdateBoundary}
        onDeleteBoundary={handleDeleteBoundary}
        onToggleBoundaryVisibility={handleToggleBoundaryVisibility}
        onStartDrawingBoundary={handleStartDrawingBoundary}
        onClearBoundaryPoints={handleClearBoundaryPoints}
        isDrawing={isDrawingBoundary}
      />

      <ScenarioModal
        isOpen={scenarioModalMode !== null}
        mode={scenarioModalMode || 'save'}
        onClose={() => setScenarioModalMode(null)}
        currentScenarioName={scenarioName}
        onSaveScenario={handleSaveScenario}
        onLoadScenario={handleLoadScenario}
        savedScenarios={savedScenarios}
        onDeleteSavedScenario={handleDeleteSavedScenario}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        cameraConfig={cameraConfig}
        onUpdateCameraConfig={setCameraConfig}
        regSettings={regSettings}
        onUpdateRegSettings={setRegSettings}
        overlaySettings={overlaySettings}
        onUpdateOverlaySettings={setOverlaySettings}
        onSetCurrentAsReference={captureAndSetReference}
      />
    </div>
  );
}
