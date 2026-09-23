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
  VideoSourceType,
} from './types';
import { VisualRegistrationEngine } from './cv/registrationEngine';
import { TacticalCanvas } from './components/TacticalCanvas';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { FullscreenRibbon } from './components/FullscreenRibbon';
import { AddFeatureModal, CustomPlacementOptions } from './components/AddFeatureModal';
import { BoundaryConfigModal } from './components/BoundaryConfigModal';
import { ScenarioModal } from './components/ScenarioModal';
import { SettingsModal } from './components/SettingsModal';
import { ExerciseSimulatorControls } from './components/ExerciseSimulatorControls';
import { DiagnosticsDrawer } from './components/DiagnosticsDrawer';
import { DEFAULT_SCENARIOS } from './data/defaultScenarios';
import {
  ExerciseTerrainRenderer,
  getSimulatorHomography,
  renderInputFrame,
  SimulatorCameraState,
} from './components/ExerciseTerrainRenderer';
import { FEATURE_LIBRARY } from './data/featureDefinitions';

export default function App() {
  // Visual Registration CV Engine Instance
  const engineRef = useRef<VisualRegistrationEngine>(new VisualRegistrationEngine());
  const cvCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cvTerrainRendererRef = useRef<ExerciseTerrainRenderer>(new ExerciseTerrainRenderer());
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Camera & Stream State
  const [sourceType, setSourceType] = useState<VideoSourceType>('webcam');
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('user');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);
  const [rtspUrl, setRtspUrl] = useState<string>('rtsp://exercise-control:sec88@192.168.1.100:554/live');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [registrationSetup, setRegistrationSetup] = useState(true);
  const [setupViews, setSetupViews] = useState<Array<{ id: string; image: string }>>([]);
  const [setupActiveViewId, setSetupActiveViewId] = useState<string | null>(null);
  const [setupSnapshot, setSetupSnapshot] = useState<string | null>(null);

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
  // Keep async frame callbacks on the newest PTZ state without rebuilding
  // their timers on every simulator tick.
  const simStateRef = useRef(simState);
  simStateRef.current = simState;
  const simulatorReferenceStateRef = useRef<SimulatorCameraState | null>(null);

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
    sourceType: 'webcam',
    rtspUrl: 'rtsp://exercise-control:sec88@192.168.1.100:554/live',
    resolution: [1280, 720],
    fps: 30,
    bufferSize: 2,
    reconnectIntervalSec: 5,
  });

  const [regSettings, setRegSettings] = useState<RegistrationSettings>({
    enabled: true,
    maxFeatures: 360,
    fastThreshold: 16,
    matchRatioThreshold: 0.78,
    ransacThresholdPx: 4.5,
    minInliers: 8,
    ransacIterations: 300,
    lostFrameToleranceFrames: 12,
    smoothingFactor: 0.5,
    leastSquaresRefine: true,
    adaptiveReference: false,
    updateIntervalMs: 33,
  });

  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    symbolScale: 1.0,
    textSize: 12,
    opacity: 0.9,
    boundaryThickness: 3,
    showAllLayers: true,
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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const appContainerRef = useRef<HTMLDivElement | null>(null);

  // Toggle Fullscreen / Maximize Screen
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      // Also request browser fullscreen if permitted, otherwise state provides container-level maximize
      if (next) {
        try {
          if (appContainerRef.current && !document.fullscreenElement) {
            appContainerRef.current.requestFullscreen?.().catch(() => {});
          }
        } catch {
          // In sandboxed iframes, container maximize operates cleanly via state
        }
      } else {
        try {
          if (document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => {});
          }
        } catch {}
      }
      return next;
    });
  }, []);

  // Listen for browser fullscreen changes & Escape key
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      // F key shortcut for fast full-screen toggle when not in an input
      if (
        (e.key === 'f' || e.key === 'F') &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        handleToggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, handleToggleFullscreen]);

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

  // Handle Webcam and Mobile Rear Camera Source Switch
  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let videoEl: HTMLVideoElement | null = null;

    if ((sourceType === 'webcam' || sourceType === 'rear_camera') && isConnected) {
      videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;

      // Determine facingMode: 'environment' for rear camera, otherwise cameraFacingMode
      const targetFacingMode = sourceType === 'rear_camera' ? 'environment' : cameraFacingMode;

      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: cameraConfig.resolution[0] || 1920, min: 640 },
        height: { ideal: cameraConfig.resolution[1] || 1080, min: 360 },
      };

      if (selectedCameraDeviceId) {
        videoConstraints.deviceId = { exact: selectedCameraDeviceId };
      } else {
        videoConstraints.facingMode = { ideal: targetFacingMode };
      }

      navigator.mediaDevices
        ?.getUserMedia({ video: videoConstraints })
        .then((stream) => {
          currentStream = stream;
          activeStreamRef.current = stream;

          // Check for torch capability (available on many mobile back cameras)
          const track = stream.getVideoTracks()[0];
          if (track && typeof (track as any).getCapabilities === 'function') {
            const caps = (track as any).getCapabilities();
            setHasTorchSupport(Boolean(caps && caps.torch));
          } else {
            setHasTorchSupport(false);
          }

          if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.play().catch((e) => console.warn('Video play error:', e));
            videoElementRef.current = videoEl;
            setVideoElement(videoEl);
          }

          // Enumerate connected cameras
          if (navigator.mediaDevices?.enumerateDevices) {
            navigator.mediaDevices
              .enumerateDevices()
              .then((devices) => {
                const videoInputs = devices.filter((d) => d.kind === 'videoinput');
                setAvailableCameras(videoInputs);
              })
              .catch(console.warn);
          }
        })
        .catch((err) => {
          console.warn('Camera stream error with target constraints:', err);
          // Graceful fallback to any available video input if facingMode constraint fails
          navigator.mediaDevices
            ?.getUserMedia({ video: true })
            .then((stream) => {
              currentStream = stream;
              activeStreamRef.current = stream;
              if (videoEl) {
                videoEl.srcObject = stream;
                videoEl.play().catch(console.warn);
                videoElementRef.current = videoEl;
                setVideoElement(videoEl);
              }
            })
            .catch((fallbackErr) => {
              console.warn('Camera fallback stream error:', fallbackErr);
              alert('Unable to access camera device. Switching back to Exercise Feed Simulator.');
              setSourceType('simulator');
              setRegistrationSetup(false);
            });
        });
    } else {
      if (videoElementRef.current) {
        const stream = videoElementRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach((track) => track.stop());
        videoElementRef.current = null;
        setVideoElement(null);
      }
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
        activeStreamRef.current = null;
      }
      setIsTorchOn(false);
      setHasTorchSupport(false);
    }

    return () => {
      currentStream?.getTracks().forEach((track) => track.stop());
      setIsTorchOn(false);
    };
  }, [sourceType, isConnected, cameraFacingMode, selectedCameraDeviceId, cameraConfig.resolution]);

  // Mobile Torch / Flashlight Toggle Handler
  const handleToggleTorch = async () => {
    const stream = activeStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !isTorchOn;
      // @ts-ignore
      await track.applyConstraints({ advanced: [{ torch: nextState }] });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Torch constraint error:', err);
    }
  };

  // Quick Camera Facing Flip (Rear <-> Front)
  const handleToggleCameraFacing = () => {
    if (sourceType === 'rear_camera') {
      setSourceType('webcam');
      setCameraFacingMode('user');
      setSelectedCameraDeviceId(null);
    } else if (sourceType === 'webcam') {
      setSourceType('rear_camera');
      setCameraFacingMode('environment');
      setSelectedCameraDeviceId(null);
    } else {
      setSourceType('rear_camera');
      setCameraFacingMode('environment');
      setSelectedCameraDeviceId(null);
    }
  };

  // Set initial Reference Frame once canvas is mounted
  const captureAndSetReference = useCallback(() => {
    if (registrationSetup) return;
    const cvCanvas = cvCanvasRef.current;
    if (!cvCanvas) return;
    const ctx = cvCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const referenceState = { ...simStateRef.current };
    if (sourceType === 'simulator') {
      simulatorReferenceStateRef.current = referenceState;
    } else {
      simulatorReferenceStateRef.current = null;
    }
    engineRef.current.setExternalHomography(null);
    if (!renderInputFrame(ctx, 640, 360, sourceType, referenceState, videoElementRef.current, cvTerrainRendererRef.current)) return;

    const imgData = ctx.getImageData(0, 0, 640, 360);
    const dataUrl = cvCanvas.toDataURL('image/jpeg', 0.85);
    const { keypointCount } = engineRef.current.setReferenceFrame(imgData, dataUrl);
    if (sourceType === 'simulator') {
      engineRef.current.setExternalHomography([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
    console.log(`Reference frame established with ${keypointCount} features.`);
  }, [sourceType, registrationSetup]);

  // Establish initial reference frame on mount / connection
  useEffect(() => {
    if (isConnected && !registrationSetup && setupViews.length === 0) {
      // Brief delay to allow canvases/video elements to initialize
      const timer = setTimeout(() => {
        captureAndSetReference();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isConnected, registrationSetup, setupViews.length, captureAndSetReference]);

  // The camera permission prompt and stream startup can take longer than the
  // initial reference delay. Capture once the first decoded webcam frame exists.
  useEffect(() => {
    if (!registrationSetup && setupViews.length === 0 && isConnected && (sourceType === 'webcam' || sourceType === 'rear_camera') && videoElement?.readyState && videoElement.readyState >= 2) {
      captureAndSetReference();
    }
  }, [registrationSetup, setupViews.length, isConnected, sourceType, videoElement, captureAndSetReference]);

  const captureSetupView = useCallback(() => {
    if (setupSnapshot) return;
    if (setupActiveViewId && !features.some((feature) => feature.anchorViewId === setupActiveViewId)) return;
    const canvas = cvCanvasRef.current;
    const video = videoElementRef.current;
    if (!canvas || (sourceType !== 'simulator' && (!video || video.readyState < 2))) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const state = { ...simStateRef.current };
    if (!renderInputFrame(ctx, 640, 360, sourceType, state, video, cvTerrainRendererRef.current)) return;
    const imageData = ctx.getImageData(0, 0, 640, 360);
    const image = canvas.toDataURL('image/jpeg', 0.9);
    const id = `setup-view-${Date.now()}`;
    if (sourceType === 'simulator' && setupViews.length === 0) {
      simulatorReferenceStateRef.current = state;
    }
    engineRef.current.addSetupKeyframe(imageData, id, image);
    setSetupViews((views) => [...views, { id, image }]);
    setSetupActiveViewId(id);
    setSetupSnapshot(image);
  }, [sourceType, setupViews.length, setupSnapshot, setupActiveViewId, features]);

  const finishSetupView = useCallback(() => {
    if (!setupActiveViewId || !features.some((feature) => feature.anchorViewId === setupActiveViewId)) return;
    setSetupSnapshot(null);
  }, [features, setupActiveViewId]);

  const finishRegistrationSetup = useCallback(() => {
    const everyViewAnchored = setupViews.length >= 2 && setupViews.every((view) =>
      features.some((feature) => feature.anchorViewId === view.id)
    );
    if (!everyViewAnchored || setupSnapshot) return;
    setRegistrationSetup(false);
    setSetupSnapshot(null);
  }, [features, setupViews, setupSnapshot]);

  // Synchronize Registration Settings into the CV Engine
  useEffect(() => {
    engineRef.current.settings = { ...regSettings };
  }, [regSettings]);

  // Main CV Processing Loop (at 30 FPS)
  useEffect(() => {
    if (!isConnected || registrationSetup) return;

    let intervalId: number;
    let autoPatrolAngle = 0;

    const processCVFrame = () => {
      const cvCanvas = cvCanvasRef.current;
      if (!cvCanvas) return;
      const ctx = cvCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Advance synthetic PTZ only for the simulator. Live sources may provide
      // decoded video frames, but their camera pose is not guessed here.
      let frameSimState = simStateRef.current;
      if (sourceType === 'simulator') {
        const currentSimState = simStateRef.current;
        const nextSimState: SimulatorCameraState = {
          ...currentSimState,
          time: currentSimState.time + (regSettings.updateIntervalMs || 33),
        };
        if (currentSimState.autoPatrol) {
          autoPatrolAngle += 0.02;
          nextSimState.panX = Math.sin(autoPatrolAngle) * 120;
        }
        simStateRef.current = nextSimState;
        frameSimState = nextSimState;
        setSimState(nextSimState);
      }

      if (!renderInputFrame(ctx, 640, 360, sourceType, frameSimState, videoElementRef.current, cvTerrainRendererRef.current)) {
        // No fresh decoded frame: never feed stale canvas pixels to registration.
        engineRef.current.setExternalHomography(null);
        return;
      }

      const imgData = ctx.getImageData(0, 0, 640, 360);
      const metrics = engineRef.current.processFrame(imgData);
      const simulatorReference = simulatorReferenceStateRef.current;
      if (sourceType === 'simulator' && simulatorReference && setupViews.length <= 1) {
        // The simulator exposes exact PTZ state. Use its known camera transform
        // for stable overlays while retaining CV metrics as diagnostics.
        const knownTransform = getSimulatorHomography(simulatorReference, frameSimState);
        engineRef.current.setExternalHomography(knownTransform);
        metrics.homography = knownTransform;
      } else {
        engineRef.current.setExternalHomography(null);
      }
      setRegistrationMetrics(metrics);
    };

    intervalId = window.setInterval(processCVFrame, regSettings.updateIntervalMs || 33);
    return () => clearInterval(intervalId);
  }, [isConnected, registrationSetup, sourceType, setupViews.length, regSettings.updateIntervalMs]);

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
    const currentMatch = engineRef.current.getCurrentMatchedView();
    const anchorViewId = registrationSetup
      ? setupActiveViewId
      : currentMatch.independent ? currentMatch.id : undefined;
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
      ...(anchorViewId ? { anchorViewId } : {}),
    };

    setFeatures((prev) => [...prev, newFeature]);
    setSelectedFeatureId(newFeature.id);
    setPendingFeatureType(null);
    setPendingFeatureLabel('');
    setPendingFeatureOptions({});
  };

  const handleToggleFeatureVisibility = (id: string) => {
    setFeatures((prev) =>
      prev.map((f) => (f.id === id ? { ...f, visible: f.visible === false ? true : false } : f))
    );
  };

  const handleToggleAllFeatures = (visible: boolean) => {
    setFeatures((prev) => prev.map((f) => ({ ...f, visible })));
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

  const handleToggleAllBoundaries = (visible: boolean) => {
    setBoundaries((prev) => prev.map((b) => ({ ...b, visible })));
  };

  // Master switch to hide/unhide all tactical layers at once (features, boundaries, overlays)
  const handleToggleAllLayers = () => {
    setOverlaySettings((prev) => {
      const nextShowAll = prev.showAllLayers === false ? true : false;
      return {
        ...prev,
        showAllLayers: nextShowAll,
      };
    });
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
        anchorViewId: f.anchorViewId,
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
      reference_views: setupViews.length > 0 ? setupViews : undefined,
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
        anchorViewId: f.anchorViewId,
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

    engineRef.current.reset();
    if (scenario.reference_views?.length) {
      const referenceViews = scenario.reference_views;
      setRegistrationSetup(true);
      setSetupViews(referenceViews);
      setSetupActiveViewId(null);
      setSetupSnapshot(null);
      void (async () => {
        const restoreCanvas = document.createElement('canvas');
        restoreCanvas.width = 640;
        restoreCanvas.height = 360;
        const ctx = restoreCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setRegistrationSetup(false);
          return;
        }
        for (const view of referenceViews) {
          const image = new Image();
          const imageLoaded = new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error(`Could not restore camera view ${view.id}`));
          });
          image.src = view.image;
          await imageLoaded;
          ctx.clearRect(0, 0, 640, 360);
          ctx.drawImage(image, 0, 0, 640, 360);
          engineRef.current.addSetupKeyframe(ctx.getImageData(0, 0, 640, 360), view.id, view.image);
        }
        setRegistrationSetup(false);
      })().catch((error) => {
        console.warn('Could not restore saved camera anchor views:', error);
        setRegistrationSetup(false);
        setSetupViews([]);
      });
    } else {
      setSetupViews([]);
      setSetupActiveViewId(null);
      setSetupSnapshot(null);
      setRegistrationSetup(false);
    }
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
      ref={appContainerRef}
      id="rtsp-exercise-system-root"
      className="relative flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none"
    >
      {/* Top Application Header & Toolbar (Hidden when in Fullscreen/Maximized Mode) */}
      {!isFullscreen && (
        <Toolbar
          sourceType={sourceType}
          onChangeSourceType={(type) => {
            setSourceType(type);
            setRegistrationSetup(true);
            setSetupViews([]);
            setSetupActiveViewId(null);
            setSetupSnapshot(null);
            simulatorReferenceStateRef.current = null;
            engineRef.current.reset();
            if (type === 'rear_camera') {
              setCameraFacingMode('environment');
              setSelectedCameraDeviceId(null);
            } else if (type === 'webcam') {
              setCameraFacingMode('user');
              setSelectedCameraDeviceId(null);
            }
          }}
          cameraFacingMode={cameraFacingMode}
          onToggleCameraFacing={handleToggleCameraFacing}
          availableCameras={availableCameras}
          selectedCameraDeviceId={selectedCameraDeviceId}
          onSelectCameraDevice={setSelectedCameraDeviceId}
          isTorchOn={isTorchOn}
          hasTorchSupport={hasTorchSupport}
          onToggleTorch={handleToggleTorch}
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
          allLayersVisible={overlaySettings.showAllLayers !== false}
          onToggleAllLayers={handleToggleAllLayers}
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
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenSettings={() => setIsSettingsOpen(true)}
          registrationQuality={registrationMetrics.quality}
          hasReference={registrationMetrics.quality !== 'UNINITIALIZED'}
        />
      )}

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
          registrationSetup={registrationSetup}
          setupActiveViewId={setupActiveViewId}
          setupSnapshot={setupSnapshot}
        />

        {registrationSetup && (
          <div className="absolute z-30 top-4 left-1/2 -translate-x-1/2 w-[min(560px,calc(100%-2rem))] rounded-lg border border-sky-500/50 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-sky-300">Visual Anchor Setup</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {sourceType === 'rtsp'
                    ? 'RTSP has no browser-decoded frames connected yet. Add a WebRTC or other browser video relay before capturing setup views.'
                    : 'Capture a view and add its anchors. Press Finish This View to restore live video, move the camera, then capture another view. Registration starts after setup.'}
                </p>
              </div>
              <span className="shrink-0 rounded bg-slate-800 px-2 py-1 font-mono text-xs text-slate-300">{setupViews.length} VIEWS</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {setupSnapshot ? (
                <button
                  onClick={finishSetupView}
                  disabled={!features.some((feature) => feature.anchorViewId === setupActiveViewId)}
                  className="rounded border border-amber-500/60 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Finish This View
                </button>
              ) : (
                <button
                  onClick={captureSetupView}
                  disabled={setupViews.length >= 12 || Boolean(setupActiveViewId && !features.some((feature) => feature.anchorViewId === setupActiveViewId)) || (sourceType !== 'simulator' && (!videoElement || videoElement.readyState < 2))}
                  className="rounded border border-sky-500/60 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {setupActiveViewId ? 'Capture Another View' : 'Capture This View'}
                </button>
              )}
              <button
                onClick={() => setIsAddFeatureOpen(true)}
                disabled={!setupActiveViewId || !setupSnapshot}
                className="rounded border border-emerald-500/60 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add Anchor Object
              </button>
              <button
                onClick={finishRegistrationSetup}
                disabled={Boolean(setupSnapshot) || setupViews.length < 2 || setupViews.some((view) => !features.some((feature) => feature.anchorViewId === view.id))}
                className="ml-auto rounded border border-indigo-400/60 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Finish Setup &amp; Register
              </button>
              <button
                onClick={() => { setRegistrationSetup(false); setSetupSnapshot(null); }}
                className="rounded px-2 py-2 text-xs text-slate-400 hover:text-white"
              >
                Skip
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {setupActiveViewId && setupSnapshot
                ? `${features.filter((feature) => feature.anchorViewId === setupActiveViewId).length} anchors in current view. Click the frozen image after choosing an object, then finish this view.`
                : setupActiveViewId
                  ? 'Live feed restored. Move the camera to another view, then capture it.'
                : 'Capture the current camera view to begin placing anchors.'}
              {setupActiveViewId && !features.some((feature) => feature.anchorViewId === setupActiveViewId) ? ' Add at least one anchor before capturing the next view.' : ''}
              {setupViews.length > 0 && setupViews.length < 2 ? ' Capture at least one more distinct view.' : ''}
            </div>
          </div>
        )}

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

        {/* Fullscreen Bottom Ribbon (Floating Glass Ribbon with basic tactical options) */}
        {isFullscreen && (
          <FullscreenRibbon
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            allLayersVisible={overlaySettings.showAllLayers !== false}
            onToggleAllLayers={handleToggleAllLayers}
            sourceType={sourceType}
            onChangeSourceType={(type) => {
              setSourceType(type);
              setRegistrationSetup(true);
              setSetupViews([]);
              setSetupActiveViewId(null);
              setSetupSnapshot(null);
              simulatorReferenceStateRef.current = null;
              engineRef.current.reset();
              if (type === 'rear_camera') {
                setCameraFacingMode('environment');
                setSelectedCameraDeviceId(null);
              } else if (type === 'webcam') {
                setCameraFacingMode('user');
                setSelectedCameraDeviceId(null);
              }
            }}
            onSetCurrentAsReference={captureAndSetReference}
            onOpenAddFeature={() => setIsAddFeatureOpen(true)}
            onOpenBoundaryConfig={() => setIsBoundaryConfigOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            registrationMetrics={registrationMetrics}
            featureCount={features.length}
            boundariesCount={boundaries.length}
            showSimControls={showSimControls}
            onToggleSimControls={() => setShowSimControls((prev) => !prev)}
          />
        )}
      </div>

      {/* Bottom Status Bar (PRD Section 6 & 29) - Hidden when in Fullscreen Mode */}
      {!isFullscreen && (
        <StatusBar
          sourceType={sourceType}
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
          allLayersVisible={overlaySettings.showAllLayers !== false}
          onToggleAllLayers={handleToggleAllLayers}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Modals */}
      <AddFeatureModal
        isOpen={isAddFeatureOpen}
        onClose={() => setIsAddFeatureOpen(false)}
        onSelectFeatureForPlacement={handleSelectFeatureForPlacement}
        existingCountByType={existingCountByType}
        plottedFeatures={features}
        onToggleFeatureVisibility={handleToggleFeatureVisibility}
        onToggleAllFeatures={handleToggleAllFeatures}
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
        onToggleAllBoundaries={handleToggleAllBoundaries}
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
        sourceType={sourceType}
        onChangeSourceType={(type) => {
          setSourceType(type);
          setRegistrationSetup(true);
          setSetupViews([]);
          setSetupActiveViewId(null);
          setSetupSnapshot(null);
          simulatorReferenceStateRef.current = null;
          engineRef.current.reset();
          if (type === 'rear_camera') {
            setCameraFacingMode('environment');
            setSelectedCameraDeviceId(null);
          } else if (type === 'webcam') {
            setCameraFacingMode('user');
            setSelectedCameraDeviceId(null);
          }
        }}
        cameraFacingMode={cameraFacingMode}
        onChangeFacingMode={setCameraFacingMode}
        availableCameras={availableCameras}
        selectedCameraDeviceId={selectedCameraDeviceId}
        onSelectCameraDevice={setSelectedCameraDeviceId}
        isTorchOn={isTorchOn}
        hasTorchSupport={hasTorchSupport}
        onToggleTorch={handleToggleTorch}
      />
    </div>
  );
}
