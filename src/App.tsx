import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  CameraPtzPose,
  OnvifCameraConfig,
  OnvifMediaProfile,
  ReferenceView,
  PtzCalibration,
} from './types';
import { registrationSettings } from './cv/registrationDefaults';
import { processingSize } from './cv/frameGeometry';
import { PoseTimeline } from './video/poseTimeline';
import { connectWebRtc } from './video/webrtc';
import { cameraIdentity } from './video/cameraIdentity';
import { PtzCalibrationPanel } from './components/PtzCalibrationPanel';
import { createPtzModel } from './cv/ptzProjection';
import { RegistrationRuntime } from './cv/registrationRuntime';
import { frameTimestamp } from './video/frameTiming';
import { TacticalCanvas } from './components/TacticalCanvas';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { FullscreenRibbon } from './components/FullscreenRibbon';
import { AddFeatureModal, CustomPlacementOptions } from './components/AddFeatureModal';
import { BoundaryConfigModal } from './components/BoundaryConfigModal';
import { ScenarioModal } from './components/ScenarioModal';
import { SettingsModal } from './components/SettingsModal';
import { ExerciseSimulatorControls } from './components/ExerciseSimulatorControls';
import { OnvifSetupModal } from './components/OnvifSetupModal';
import { DiagnosticsDrawer } from './components/DiagnosticsDrawer';
import { DEFAULT_SCENARIOS } from './data/defaultScenarios';
import {
  ExerciseTerrainRenderer,
  getSimulatorHomography,
  renderInputFrame,
  SimulatorCameraState,
} from './components/ExerciseTerrainRenderer';
import { FEATURE_LIBRARY } from './data/featureDefinitions';

async function requestOnvif<T = any>(path: string, body?: unknown, signal?:AbortSignal): Promise<T> {
  const timeout=AbortSignal.timeout(20000);
  const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  const response = await fetch(path, body === undefined ? { cache: 'no-store',signal:requestSignal } : {
    signal:requestSignal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `ONVIF request failed (${response.status}).`);
  return result as T;
}

export default function App() {
  // Visual Registration CV Engine Instance
  const engineRef = useRef<RegistrationRuntime>(null!);
  if(!engineRef.current)engineRef.current=new RegistrationRuntime();
  const restoreEpochRef=useRef(0);
  const retryCountRef=useRef(0);
  const [anchorsNeedingPlacement,setAnchorsNeedingPlacement]=useState<string[]>([]);
  const [replacementAnchorId,setReplacementAnchorId]=useState('');
  const [decodedSize,setDecodedSize]=useState<[number,number]|null>(null);
  const decodedAspectRef=useRef<number|null>(null);
  const [calibrations,setCalibrations]=useState<Record<string,PtzCalibration>>(()=>{
    try{const bank=JSON.parse(localStorage.getItem('vaas_ptz_calibrations')||'{}');return bank&&typeof bank==='object'&&!Array.isArray(bank)?bank:{};}catch{return {};}
  });
  useEffect(()=>()=>{restoreEpochRef.current++;engineRef.current.dispose();},[]);
  const cvCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cvTerrainRendererRef = useRef<ExerciseTerrainRenderer>(new ExerciseTerrainRenderer());
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const onvifPoseRef = useRef<CameraPtzPose | null>(null);

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
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [registrationSetup, setRegistrationSetup] = useState(true);
  const [setupViews, setSetupViews] = useState<ReferenceView[]>([]);
  const [setupActiveViewId, setSetupActiveViewId] = useState<string | null>(null);
  const [setupSnapshot, setSetupSnapshot] = useState<string | null>(null);
  const [onvifConfig, setOnvifConfig] = useState<OnvifCameraConfig>(() => {
    const defaults: OnvifCameraConfig = {
      host: '', port: 80, rtspPort: 554, transport: 'webrtc', endpointPath: '/onvif/device_service', username: '', password: '',
    };
    try {
      const saved = localStorage.getItem('vaas_onvif_camera_config');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });
  const [onvifDraft, setOnvifDraft] = useState<OnvifCameraConfig>(() => {
    const defaults: OnvifCameraConfig = {
      host: '', port: 80, rtspPort: 554, transport: 'webrtc', endpointPath: '/onvif/device_service', username: '', password: '',
    };
    try {
      const saved = localStorage.getItem('vaas_onvif_camera_config');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });
  const [onvifProfiles, setOnvifProfiles] = useState<OnvifMediaProfile[]>([]);
  const [onvifDeviceName, setOnvifDeviceName] = useState('');
  const [isOnvifSetupOpen, setIsOnvifSetupOpen] = useState(false);
  const [onvifBusy, setOnvifBusy] = useState(false);
  const [onvifError, setOnvifError] = useState<string | null>(null);
  const [onvifStatus, setOnvifStatus] = useState('');
  const [onvifSessionId, setOnvifSessionId] = useState('');
  const [activeOnvifProfile, setActiveOnvifProfile] = useState<OnvifMediaProfile | null>(null);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [setupNotice, setSetupNotice] = useState('');
  const [connectionRevision, setConnectionRevision] = useState(0);
  const poseTimelineRef = useRef(new PoseTimeline());
  const movingUntilRef = useRef(0);
  const framePoseRef = useRef<CameraPtzPose | null>(null);
  const lastFrameAtRef = useRef(0);
  const frameCaptureTimeRef = useRef(0);
  const cameraKey = activeOnvifProfile ? cameraIdentity(onvifConfig, activeOnvifProfile) : '';
  const savedCalibration=calibrations[cameraKey]||(onvifConfig.calibration?.cameraKey===cameraKey?onvifConfig.calibration:null);
  const decodedAspect=decodedSize?decodedSize[0]/decodedSize[1]:undefined;
  const calibration=useMemo(()=>{
    if(sourceType!=='onvif')return null;
    if(savedCalibration&&(!decodedAspect||Math.abs(decodedAspect-savedCalibration.aspect)<.02))return savedCalibration;
    return activeOnvifProfile&&cameraKey?createPtzModel(cameraKey,activeOnvifProfile,decodedAspect):null;
  },[sourceType,savedCalibration,decodedAspect,activeOnvifProfile,cameraKey]);
  const frameConfigRef = useRef({ calibration, cameraKey });
  frameConfigRef.current = { calibration, cameraKey };
  useEffect(() => { engineRef.current.configurePtz(sourceType === 'onvif' ? calibration : null, cameraKey); }, [sourceType, calibration, cameraKey]);


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
      x: f.x / 1280, y: f.y / 720,
      visible: true,
      createdAt: Date.now(),
    }))
  );

  const featuresRef=useRef(features);featuresRef.current=features;

  // Multi-boundary state management
  const [boundaries, setBoundaries] = useState<ExerciseBoundary[]>(() => {
    const sc = DEFAULT_SCENARIOS[0];
    if (sc.boundaries && sc.boundaries.length > 0) {
      return sc.boundaries.map((b) => ({ ...b, points: b.points.map(([x,y]) => [x/1280,y/720] as BoundaryPoint), visible: b.visible !== false }));
    }
    return [
      {
        id: 'boundary-crimson-perimeter',
        name: sc.boundary_config?.name || 'CRIMSON EXERCISE PERIMETER',
        color: sc.boundary_config?.color || '#ef4444',
        thickness: sc.boundary_config?.thickness || 3,
        points: (sc.boundary || []).map(([x,y]) => [x/1280,y/720]),
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

  const [boundary, setBoundary] = useState<BoundaryPoint[]>((DEFAULT_SCENARIOS[0].boundary || []).map(([x,y])=>[x/1280,y/720]));
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
    fps: 0,
    processingTimeMs: 0,
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

  const [regSettings,setRegSettings]=useState<RegistrationSettings>(()=>{
    try{return registrationSettings(JSON.parse(localStorage.getItem('vaas_registration_settings')||'{}'));}catch{return registrationSettings();}
  });
  const updateRegSettings=(value:RegistrationSettings)=>setRegSettings(registrationSettings(value));

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
    engineRef.current.settings = registrationSettings(regSettings);
  }, [regSettings]);

  // Create the aspect-preserving source frame canvas for registration
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
    setIsVideoReady(false);

    if ((sourceType === 'webcam' || sourceType === 'rear_camera') && isConnected) {
      videoEl = document.createElement('video');
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;
      const markVideoReady = () => setIsVideoReady(true);
      videoEl.addEventListener('loadeddata', markVideoReady);
      videoEl.addEventListener('playing', markVideoReady);

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
              setRegistrationSetup(true);
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
      setIsVideoReady(false);
      setIsTorchOn(false);
    };
  }, [sourceType, isConnected, cameraFacingMode, selectedCameraDeviceId, cameraConfig.resolution]);

  const handleOnvifDiscover = useCallback(async () => {
    setOnvifBusy(true);
    setOnvifError(null);
    setOnvifStatus('Discovering camera…');
    try {
      const result = await requestOnvif<{
        device: { manufacturer: string; model: string };
        profiles: OnvifMediaProfile[];
      }>('/api/onvif/discover', onvifDraft);
      setOnvifProfiles(result.profiles);
      const best = [...result.profiles].sort((a, b) => {
        const h264 = Number(b.encoding === 'H264') - Number(a.encoding === 'H264');
        return h264 || (b.width * b.height) - (a.width * a.height);
      })[0];
      const profileToken = result.profiles.some((profile) => profile.token === onvifDraft.profileToken)
        ? onvifDraft.profileToken
        : best?.token;
      setOnvifDraft((current) => ({ ...current, profileToken }));
      setOnvifDeviceName([result.device.manufacturer, result.device.model].filter(Boolean).join(' ') || 'ONVIF PTZ camera');
      setOnvifStatus('Camera discovered');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not discover the ONVIF camera.';
      setOnvifError(message);
      setOnvifStatus('Camera setup failed');
    } finally {
      setOnvifBusy(false);
    }
  }, [onvifDraft]);

  const handleOnvifSaveAndConnect = useCallback(() => {
    try {
      localStorage.setItem('vaas_onvif_camera_config', JSON.stringify(onvifDraft));
      if(JSON.stringify([onvifDraft.host,onvifDraft.port,onvifDraft.profileToken])!==JSON.stringify([onvifConfig.host,onvifConfig.port,onvifConfig.profileToken])){
        restoreEpochRef.current++;engineRef.current.reset();setSetupViews([]);setRegistrationSetup(true);setSetupActiveViewId(null);setSetupSnapshot(null);
        requireAnchorPlacement();setCalibrationOpen(false);setActiveOnvifProfile(null);decodedAspectRef.current=null;setDecodedSize(null);
      }
      setOnvifConfig(onvifDraft);
      setConnectionRevision(v=>v+1);
      setOnvifError(null);
      setIsOnvifSetupOpen(false);
      setOnvifStatus('Connecting…');
      setIsConnected(true);
    } catch {
      setOnvifError('The browser could not save this camera configuration locally.');
    }
  }, [onvifDraft,onvifConfig,features]);

  const handleOpenOnvifSetup = () => {
    setOnvifDraft({ ...onvifConfig });
    setOnvifError(null);
    setIsConnected(false);
    setIsOnvifSetupOpen(true);
  };

  const handleCloseOnvifSetup = () => {
    setOnvifDraft({ ...onvifConfig });
    setIsOnvifSetupOpen(false);
    if (sourceType === 'onvif' && onvifConfig.host.trim()) setIsConnected(true);
  };

  const requireAnchorPlacement=()=>{
    const ids=featuresRef.current.filter(f=>f.anchorViewId).map(f=>f.id);
    setAnchorsNeedingPlacement(ids);
    setFeatures(current=>current.map(f=>f.anchorViewId?{...f,anchorViewId:'needs-recapture'}:f));
    setBoundaries(current=>current.map(b=>b.points.length?{...b,anchorViewId:'needs-recapture'}:b));
  };
  const resetCameraReferences=()=>{
    requireAnchorPlacement();
    restoreEpochRef.current++;poseTimelineRef.current.clear();framePoseRef.current=null;lastFrameAtRef.current=0;
    decodedAspectRef.current=null;setDecodedSize(null);setSetupViews([]);setSetupActiveViewId(null);setSetupSnapshot(null);setRegistrationSetup(true);
    setPendingFeatureType(null);setReplacementAnchorId('');
    engineRef.current.reset();
  };
  useEffect(()=>{
    if(!videoElement)return;
    const geometry=()=>{
      const w=videoElement.videoWidth,h=videoElement.videoHeight;if(!w||!h)return;
      const aspect=w/h,previous=decodedAspectRef.current;
      if(previous!==null&&Math.abs(previous-aspect)>.02){
        restoreEpochRef.current++;engineRef.current.reset();setSetupViews([]);setSetupActiveViewId(null);setSetupSnapshot(null);setRegistrationSetup(true);
        requireAnchorPlacement();setSetupNotice('The stream aspect ratio changed. Capture new anchor views for this image geometry; PTZ calibration remains optional.');
      }
      decodedAspectRef.current=aspect;setDecodedSize([w,h]);
    };
    videoElement.addEventListener('loadedmetadata',geometry);videoElement.addEventListener('resize',geometry);geometry();
    return()=>{videoElement.removeEventListener('loadedmetadata',geometry);videoElement.removeEventListener('resize',geometry);};
  },[videoElement]);
  useEffect(()=>{
    if(sourceType==='onvif'&&cameraKey&&setupViews.some(v=>v.cameraKey&&v.cameraKey!==cameraKey)){
      resetCameraReferences();setSetupNotice('The selected camera profile differs from the saved anchor views. Capture new views and re-place their anchors.');
    }
  },[sourceType,cameraKey,setupViews]);
  const handleChangeSourceType = (type: VideoSourceType) => {
    resetCameraReferences();retryCountRef.current=0;
    setActiveOnvifProfile(null);
    setSourceType(type);
    setCalibrationOpen(false);
    setSetupNotice('');
    poseTimelineRef.current.clear();
    setIsVideoReady(false);
    setRegistrationSetup(true);
    setSetupViews([]);
    setSetupActiveViewId(null);
    setSetupSnapshot(null);
    simulatorReferenceStateRef.current = null;
    onvifPoseRef.current = null;
    engineRef.current.setCameraPoseHint(null);
    engineRef.current.reset();

    if (type === 'onvif') {
      setOnvifError(null);
      if (onvifConfig.host.trim()) {
        setIsConnected(true);
        setOnvifStatus('Connecting…');
      } else {
        setIsConnected(false);
        setIsOnvifSetupOpen(true);
      }
    } else {
      setIsConnected(true);
      setOnvifStatus('');
      if (type === 'rear_camera') {
        setCameraFacingMode('environment');
        setSelectedCameraDeviceId(null);
      } else if (type === 'webcam') {
        setCameraFacingMode('user');
        setSelectedCameraDeviceId(null);
      }
    }
  };

  const changeRtspUrl=(url:string)=>{
    if(url!==rtspUrl&&sourceType==='rtsp')resetCameraReferences();
    setRtspUrl(url);setCameraConfig(current=>({...current,rtspUrl:url}));
  };
  const updateCameraConfig=(config:CameraConfig)=>{
    if(config.rtspUrl!==rtspUrl)changeRtspUrl(config.rtspUrl);
    setCameraConfig(config);
  };
  const sendOnvifPtz = (command: { action?: 'stop' | 'home'; pan?: number; tilt?: number; zoom?: number }) => {
    movingUntilRef.current = performance.now() + 2000;
    void requestOnvif('/api/onvif/ptz', { ...command, sessionId: onvifSessionId }).catch((error) => {
      setOnvifError(error instanceof Error ? error.message : 'ONVIF PTZ command failed.');
    });
  };

  const handleOnvifPan = (dx: number, dy: number) => {
    sendOnvifPtz({ pan: (dx / 35) * 0.05, tilt: (-dy / 25) * 0.05, zoom: 0 });
  };

  const handleOnvifZoom = (delta: number) => {
    if (Math.abs(delta) < 0.001) return;
    sendOnvifPtz({ pan: 0, tilt: 0, zoom: Math.sign(delta) * Math.min(0.04, Math.abs(delta) * 0.25) });
  };

  const connectionKey = JSON.stringify([onvifConfig.host,onvifConfig.port,onvifConfig.rtspPort,onvifConfig.endpointPath,
    onvifConfig.username,onvifConfig.password,onvifConfig.profileToken,onvifConfig.transport]);
  useEffect(() => {
    if (!['onvif','rtsp'].includes(sourceType) || !isConnected) return;
    const controller = new AbortController();
    let cancelled = false, sessionId = '',failed=false;
    let video: HTMLVideoElement | null = null;
    let hls: import('hls.js').default | null = null;
    let pc: RTCPeerConnection | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setIsVideoReady(false);setDecodedSize(null); setOnvifError(null); setOnvifStatus('Connecting to camera…');
    poseTimelineRef.current.clear(); framePoseRef.current=null; lastFrameAtRef.current=0;
    const fail = (message:string) => {
      if(cancelled||failed)return;failed=true;
      setIsVideoReady(false);setOnvifError(message);setOnvifStatus('Video unavailable');
      poseTimelineRef.current.clear();framePoseRef.current=null;
      clearTimeout(retryTimer);
      const delay=Math.min(30000,Math.max(1000,cameraConfig.reconnectIntervalSec*1000)*2**Math.min(4,retryCountRef.current++));
      retryTimer=setTimeout(()=>setConnectionRevision(v=>v+1),delay);
    };
    const connect = async () => {
      try {
        const result = await requestOnvif<{
          device?: { manufacturer:string;model:string }; profile?:OnvifMediaProfile;profiles?:OnvifMediaProfile[];
          transport:'webrtc'|'hls';sessionId:string;streamPath:string;
        }>(sourceType==='onvif'?'/api/onvif/connect':'/api/onvif/rtsp',sourceType==='onvif'?onvifConfig:{url:rtspUrl},controller.signal);
        sessionId=result.sessionId;
        if(cancelled){void requestOnvif('/api/onvif/disconnect',{sessionId}).catch(()=>{});return;}
        setOnvifSessionId(sessionId);
        if(result.profiles)setOnvifProfiles(result.profiles);
        if(result.profile)setActiveOnvifProfile(result.profile);
        if(result.device)setOnvifDeviceName([result.device.manufacturer,result.device.model].filter(Boolean).join(' '));
        video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=true;
        const ready=()=>{if(!cancelled&&video!.videoWidth>0&&video!.videoHeight>0){
          const w=video!.videoWidth,h=video!.videoHeight;
          setDecodedSize([w,h]);retryCountRef.current=0;failed=false;clearTimeout(retryTimer);
          setIsVideoReady(true);setOnvifError(null);setOnvifStatus(`Connected · ${w}×${h} · ${result.transport.toUpperCase()}`);
        }};
        video.addEventListener('loadeddata',ready);video.addEventListener('playing',ready);video.addEventListener('resize',ready);
        videoElementRef.current=video;setVideoElement(video);
        if(result.transport==='webrtc')pc=await connectWebRtc(video,sessionId,controller.signal,fail);
        else {
          const HlsPlayer=(await import('hls.js/light')).default;
          if(cancelled)return;
          if(HlsPlayer.isSupported()){
            hls=new HlsPlayer({enableWorker:true,liveSyncDurationCount:2});hls.loadSource(result.streamPath);hls.attachMedia(video);
            hls.on(HlsPlayer.Events.MANIFEST_PARSED,()=>{void video?.play().catch(()=>{});});
            hls.on(HlsPlayer.Events.ERROR,(_event,data)=>{if(data.fatal)fail(`Video relay error: ${data.details}`);});
          }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=result.streamPath;await video.play();}
          else throw new Error('This browser cannot play HLS. Select WebRTC in camera setup.');
        }
      }catch(error){if(!cancelled)fail(error instanceof Error?error.message:'Camera connection failed.');}
    };
    void connect();
    return () => {
      cancelled=true;controller.abort();clearTimeout(retryTimer);pc?.close();hls?.destroy();
      setOnvifSessionId('');poseTimelineRef.current.clear();framePoseRef.current=null;
      if(video){video.pause();video.srcObject=null;video.removeAttribute('src');video.load();}
      if(videoElementRef.current===video)videoElementRef.current=null;
      setVideoElement(current=>current===video?null:current);
      if(sessionId)void requestOnvif('/api/onvif/disconnect',{sessionId}).catch(()=>{});
    };
  }, [sourceType,isConnected,connectionKey,connectionRevision,rtspUrl]);

  useEffect(() => {
    if(sourceType!=='onvif'||!isConnected||!onvifSessionId)return;
    let cancelled=false;const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      const start=performance.now();let moving=true;
      try{
        const result=await requestOnvif<{ptzPose:CameraPtzPose|null;connected:boolean;requestedAt:number;receivedAt:number}>(`/api/onvif/status?sessionId=${encodeURIComponent(onvifSessionId)}`,undefined,controller.signal);
        const end=performance.now();
        if(cancelled)return;
        onvifPoseRef.current=result.ptzPose;
        if(result.connected&&result.ptzPose){
          const cameraDuration=result.receivedAt-result.requestedAt;
          poseTimelineRef.current.pushStatus(result.ptzPose,start,end,cameraDuration);
          const previous=poseTimelineRef.current.sample(start,frameConfigRef.current.calibration?.panPeriod??2,2000)?.pose;
          const changed=previous&&Math.hypot(result.ptzPose.pan-previous.pan,result.ptzPose.tilt-previous.tilt,result.ptzPose.zoom-previous.zoom)>.0001;
          moving=result.ptzPose.moving===true||!!changed||performance.now()<movingUntilRef.current;
        }else{poseTimelineRef.current.clear();framePoseRef.current=null;engineRef.current.setFramePose(null);}
      }catch{if(!cancelled){onvifPoseRef.current=null;poseTimelineRef.current.clear();framePoseRef.current=null;engineRef.current.setFramePose(null);}}
      if(!cancelled)timer=setTimeout(poll,Math.max(20,(moving?100:250)-(performance.now()-start)));
    };
    void poll();
    return()=>{cancelled=true;controller.abort();clearTimeout(timer);poseTimelineRef.current.clear();onvifPoseRef.current=null;engineRef.current.setFramePose(null);};
  },[sourceType,isConnected,onvifSessionId]);

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
  const handleToggleCameraFacing=()=>handleChangeSourceType(sourceType==='rear_camera'?'webcam':'rear_camera');
  const changeFacingMode=(mode:'user'|'environment')=>{resetCameraReferences();setCameraFacingMode(mode);};
  const selectCameraDevice=(id:string|null)=>{resetCameraReferences();setSelectedCameraDeviceId(id);};

  // Set initial Reference Frame once canvas is mounted
  const captureAndSetReference = useCallback(() => {
    if (registrationSetup) return;
    const cvCanvas = cvCanvasRef.current;
    if (!cvCanvas) return;
    const ctx = cvCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if(performance.now()-lastFrameAtRef.current>500)return;
    const id=engineRef.current.getCurrentMatchedView().id || engineRef.current.getAnchorViewId();
    const affected=features.filter(f=>(f.anchorViewId||engineRef.current.getAnchorViewId())===id);
    const projected=affected.map(f=>engineRef.current.projectAnchor(id,f.x,f.y));
    if(affected.length&&setupViews.length&&projected.some(p=>!p)){setSetupNotice('Return to a tracked saved view before re-referencing its anchors.');return;}
    const boundaryProjections=boundaries.filter(b=>(b.anchorViewId||engineRef.current.getAnchorViewId())===id).map(b=>({id:b.id,points:b.points.map(([x,y])=>engineRef.current.projectAnchor(id,x,y))}));
    if(setupViews.length&&boundaryProjections.some(b=>b.points.some(p=>!p))){setSetupNotice('Return to a tracked saved view before re-referencing its boundaries.');return;}
    if(setupViews.length)setBoundaries(current=>current.map(b=>{const projected=boundaryProjections.find(p=>p.id===b.id);return projected?{...b,points:projected.points as BoundaryPoint[]}:b;}));
    if(setupViews.length){setFeatures(current=>current.map(f=>{const i=affected.findIndex(a=>a.id===f.id);return i>=0&&projected[i]?{...f,x:projected[i]![0],y:projected[i]![1]}:f;}));}
    const imgData=ctx.getImageData(0,0,cvCanvas.width,cvCanvas.height),image=cvCanvas.toDataURL('image/jpeg',0.9);
    const pose=framePoseRef.current||undefined;
    if(!setupViews.length)engineRef.current.setReferenceFrame(imgData,image,id,pose,cameraKey);
    else engineRef.current.addSetupKeyframe(imgData,id,image,pose,cameraKey);
    const view:ReferenceView={id,image,width:cvCanvas.width,height:cvCanvas.height,ptzPose:pose,cameraKey,capturedAt:frameCaptureTimeRef.current,
      simulatorPose:sourceType==='simulator'?{...simStateRef.current}:undefined};
    setSetupViews(current=>current.length?current.map(v=>v.id===id?view:v):[view]);
  }, [sourceType, registrationSetup, features, boundaries, setupViews, cameraKey]);

  const captureSetupView = useCallback(() => {
    if (setupSnapshot) return;
    if (setupActiveViewId && !features.some((feature) => feature.anchorViewId === setupActiveViewId)) return;
    const canvas = cvCanvasRef.current;
    const video = videoElementRef.current;
    if (!canvas || (sourceType !== 'simulator' && (!video || !isVideoReady || video.readyState < 2))) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    if(performance.now()-lastFrameAtRef.current>500){setSetupNotice('Wait for a fresh camera frame before capturing.');return;}
    const state = { ...simStateRef.current };
    const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
    const image=canvas.toDataURL('image/jpeg',0.9),id=`setup-view-${Date.now()}`;
    const ptzPose=sourceType==='onvif'?framePoseRef.current||undefined:undefined;
    if(sourceType==='onvif'&&!ptzPose){setSetupNotice('Wait for fresh camera position data before capturing this view.');return;}
    setSetupNotice('');
    engineRef.current.addSetupKeyframe(imageData,id,image,ptzPose,cameraKey);
    setSetupViews(views=>[...views,{id,image,ptzPose,cameraKey,width:canvas.width,height:canvas.height,capturedAt:frameCaptureTimeRef.current,
      simulatorPose:sourceType==='simulator'?state:undefined}]);
    setSetupActiveViewId(id);
    setSetupSnapshot(image);
  }, [sourceType, setupViews.length, setupSnapshot, setupActiveViewId, features, isVideoReady, cameraKey]);

  const finishSetupView = useCallback(() => {
    if (!setupActiveViewId || !features.some((feature) => feature.anchorViewId === setupActiveViewId)) return;
    setSetupSnapshot(null);
  }, [features, setupActiveViewId]);

  const finishRegistrationSetup = useCallback(() => {
    if(anchorsNeedingPlacement.length)return;
    const everyViewAnchored = setupViews.length >= 1 && setupViews.every((view) =>
      features.some((feature) => feature.anchorViewId === view.id)
    );
    if (!everyViewAnchored || setupSnapshot) return;
    setRegistrationSetup(false);
    setSetupSnapshot(null);
  }, [features, setupViews, setupSnapshot,anchorsNeedingPlacement.length]);

  useEffect(()=>{try{localStorage.setItem('vaas_registration_settings',JSON.stringify(regSettings));}catch{}},[regSettings]);

  // Decode-driven sampling: the pose, CV image and setup capture refer to the same frame.
  useEffect(() => {
    if(!isConnected)return;
    let cancelled=false,timer:ReturnType<typeof setTimeout>,callbackId=0,lastProcessed=0,lastMediaTime=-1;
    const video=videoElement;
    const processFrame=(now:number,metadata?:VideoFrameCallbackMetadata)=>{
      if(cancelled)return;
      const canvas=cvCanvasRef.current;if(!canvas)return;
      if(sourceType!=='simulator'&&(!video||video.readyState<2))return;
      if(now-lastProcessed<(regSettings.updateIntervalMs||33)-2)return;
      if(metadata&&metadata.mediaTime===lastMediaTime)return;
      lastMediaTime=metadata?.mediaTime??-1;lastProcessed=now;
      let state=simStateRef.current;
      if(sourceType==='simulator'){
        state={...state,time:state.time+(regSettings.updateIntervalMs||33)};
        if(state.autoPatrol)state.panX=Math.sin(state.time*0.0005)*120;
        simStateRef.current=state;setSimState(state);
      }
      const [w,h]=sourceType==='simulator'?[640,360]:processingSize(video!.videoWidth,video!.videoHeight,regSettings.processingLongEdge);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;
      if(!renderInputFrame(ctx,w,h,sourceType,state,video,cvTerrainRendererRef.current))return;
      const {calibration:cal}=frameConfigRef.current;
      const frameTime=frameTimestamp(now,metadata,cal,onvifConfig.transport||'webrtc');
      const sample=sourceType==='onvif'?poseTimelineRef.current.sample(frameTime,cal?.panPeriod??2,regSettings.poseMaxAgeMs??400):null;
      framePoseRef.current=sample?.pose||null;frameCaptureTimeRef.current=performance.timeOrigin+frameTime;lastFrameAtRef.current=now;
      engineRef.current.setFramePose(sample?.pose||null,sample?.ageMs);
      if(registrationSetup)return;
      if(!setupViews.length){
        const image=canvas.toDataURL('image/jpeg',0.9),id='anchor-view-1';
        engineRef.current.setReferenceFrame(ctx.getImageData(0,0,w,h),image,id,sample?.pose,frameConfigRef.current.cameraKey);
        setSetupViews([{id,image,width:w,height:h,ptzPose:sample?.pose,cameraKey:frameConfigRef.current.cameraKey,
          simulatorPose:sourceType==='simulator'?state:undefined}]);
      }
      if(sourceType==='simulator')engineRef.current.setExternalViews(new Map(setupViews.filter(v=>v.simulatorPose).map(v=>[v.id,getSimulatorHomography(v.simulatorPose!,state)])));
      else engineRef.current.setExternalHomography(null);
      const pixels=ctx.getImageData(0,0,w,h);
      void engineRef.current.processFrameAsync(pixels,now).then(metrics=>{
        if(!cancelled&&metrics)setRegistrationMetrics(metrics);
      }).catch(error=>{if(!cancelled)setSetupNotice(error instanceof Error?error.message:'Visual registration could not process this frame.');});
    };
    const callback=(now:number,metadata:VideoFrameCallbackMetadata)=>{processFrame(now,metadata);if(!cancelled)callbackId=video!.requestVideoFrameCallback(callback);};
    const tick=()=>{processFrame(performance.now());timer=setTimeout(tick,regSettings.updateIntervalMs||33);};
    if(sourceType!=='simulator'&&video?.requestVideoFrameCallback)callbackId=video.requestVideoFrameCallback(callback);
    else if(sourceType==='simulator')tick();
    else if(video){const fallback=()=>{if(video.currentTime!==lastMediaTime){lastMediaTime=video.currentTime;processFrame(performance.now());}timer=setTimeout(fallback,33);};fallback();}
    return()=>{cancelled=true;clearTimeout(timer);if(callbackId)video?.cancelVideoFrameCallback(callbackId);};
  },[isConnected,registrationSetup,sourceType,videoElement,setupViews,regSettings.updateIntervalMs,regSettings.processingLongEdge,regSettings.poseMaxAgeMs,onvifConfig.transport]);

  useEffect(()=>{
    if(!isConnected||sourceType==='simulator')return;
    const timer=setInterval(()=>{if(lastFrameAtRef.current&&performance.now()-lastFrameAtRef.current>1000){
      framePoseRef.current=null;engineRef.current.setFramePose(null);
      setRegistrationMetrics(m=>({...m,quality:'LOST',mode:'uncertain',fps:0}));
      if(['onvif','rtsp'].includes(sourceType)&&!document.hidden&&performance.now()-lastFrameAtRef.current>5000){
        lastFrameAtRef.current=0;setConnectionRevision(v=>v+1);
      }
    }},500);
    return()=>clearInterval(timer);
  },[isConnected,sourceType]);

  // Feature Placement Handler
  const handleSelectFeatureForPlacement = (
    type: FeatureType,
    label: string,
    rotation: number,
    options?: CustomPlacementOptions
  ) => {
    setReplacementAnchorId('');
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
      : currentMatch.id || engineRef.current.getAnchorViewId();
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

    if(replacementAnchorId){
      const id=replacementAnchorId;
      setFeatures(current=>current.map(f=>f.id===id?{...newFeature,id}:f));
      setAnchorsNeedingPlacement(current=>current.filter(value=>value!==id));setReplacementAnchorId('');setSelectedFeatureId(id);
    }else{setFeatures((prev)=>[...prev,newFeature]);setSelectedFeatureId(newFeature.id);}
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
        anchorViewId: engineRef.current.getCurrentMatchedView().id || engineRef.current.getAnchorViewId(),
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
      setActiveBoundaryPoints(target?.anchorViewId!=='needs-recapture'&&target?.points?[...target.points]:[]);
    }
    const viewId=engineRef.current.getCurrentMatchedView().id||engineRef.current.getAnchorViewId();
    if(targetId)setBoundaries(current=>current.map(b=>b.id===targetId&&(!b.points.length||b.anchorViewId==='needs-recapture')?{...b,points:[],anchorViewId:viewId}:b));
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
    setFeatures([]);setAnchorsNeedingPlacement([]);setReplacementAnchorId('');
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
      version: 2,
      coordinate_space: 'normalized-source',
      scenario_name: name,
      description,
      created_at: new Date().toISOString(),
      camera: {
        source_type:sourceType,device_id:selectedCameraDeviceId||undefined,
        camera_key:cameraKey||undefined,profile_token:activeOnvifProfile?.token,
        rtsp_url: rtspUrl,
        resolution: [videoElement?.videoWidth || 640, videoElement?.videoHeight || 360],
      },
      features: features.map((f) => ({
        id: f.id,
        type: f.type,
        x: f.x,
        y: f.y,
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
        points: b.points.map(([x, y]) => [x, y]),
      })),
      boundary: (boundaries[0]?.points || boundary || []).map(([x, y]) => [
        x,
        y,
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
        method: 'PTZ_PREDICTION_VISUAL_RESIDUAL_OR_MULTISCALE_LK_RANSAC',
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

  const handleLoadScenario = (loaded: ScenarioData) => {
    const epoch=++restoreEpochRef.current;
    const needsRecapture=loaded.coordinate_space!=='normalized-source'&&!loaded.anchor_dimensions;
    let scenario=loaded;
    setAnchorsNeedingPlacement(needsRecapture?loaded.features.map(f=>f.id):[]);setReplacementAnchorId('');
    setSetupActiveViewId(null);setSetupSnapshot(null);setRegistrationSetup(true);
    if(loaded.coordinate_space!=='normalized-source') {
      const [w,h]=loaded.anchor_dimensions||[1,1];
      const normalize=(points:BoundaryPoint[])=>points.map(([x,y])=>[x/w,y/h] as BoundaryPoint);
      scenario={...loaded,coordinate_space:'normalized-source',
        features:loaded.features.map(f=>({...f,x:needsRecapture ? .5 : f.x/w,y:needsRecapture ? .5 : f.y/h,
          anchorViewId:needsRecapture?'needs-recapture':f.anchorViewId})),
        boundary:needsRecapture?[]:loaded.boundary?normalize(loaded.boundary):undefined,
        boundaries:loaded.boundaries?.map(b=>({...b,points:needsRecapture?[]:normalize(b.points),anchorViewId:needsRecapture?'needs-recapture':b.anchorViewId}))};
    }
    setSetupNotice(needsRecapture?'This older scenario has no placement dimensions. Capture new views and re-place its saved anchors. Redraw its boundaries before using them.':'');

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
    const views=scenario.reference_views?.length?scenario.reference_views:scenario.reference_image?
      [{id:scenario.features.find(f=>f.anchorViewId)?.anchorViewId||'anchor-view-1',image:scenario.reference_image} as ReferenceView]:[];
    if(needsRecapture||!views.length){
      setSetupViews([]);
      if(!needsRecapture){setAnchorsNeedingPlacement(scenario.features.map(f=>f.id));setFeatures(current=>current.map(f=>({...f,anchorViewId:'needs-recapture'})));setSetupNotice('This scenario has no saved camera views. Capture views and re-place its anchors.');}
      return;
    }
    setSetupViews(views);
    void (async()=>{
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx)throw new Error('Could not create the reference image canvas.');
      const restored:ReferenceView[]=[];
      for(const view of views){
        const image=new Image();
        await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('A saved camera view could not be loaded.'));image.src=view.image;});
        if(restoreEpochRef.current!==epoch)return;
        const [w,h]=processingSize(image.naturalWidth,image.naturalHeight,regSettings.processingLongEdge);
        canvas.width=w;canvas.height=h;ctx.drawImage(image,0,0,w,h);
        engineRef.current.addSetupKeyframe(ctx.getImageData(0,0,w,h),view.id,view.image,view.ptzPose,view.cameraKey);
        restored.push({...view,width:w,height:h});
      }
      if(restoreEpochRef.current!==epoch)return;
      setSetupViews(restored);setRegistrationSetup(false);
    })().catch(error=>{
      if(restoreEpochRef.current!==epoch)return;
      engineRef.current.reset();setSetupViews([]);setRegistrationSetup(true);
      setSetupNotice(`${error instanceof Error?error.message:'Could not restore saved views.'} Capture new anchor views.`);
      setAnchorsNeedingPlacement(scenario.features.map(f=>f.id));
      setFeatures(current=>current.map(f=>({...f,anchorViewId:'needs-recapture'})));
    });
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
          onChangeSourceType={handleChangeSourceType}
          onOpenOnvifSetup={handleOpenOnvifSetup}
          onvifConfigured={Boolean(onvifConfig.host.trim())}
          onvifStatus={onvifError || onvifStatus}
          cameraFacingMode={cameraFacingMode}
          onToggleCameraFacing={handleToggleCameraFacing}
          availableCameras={availableCameras}
          selectedCameraDeviceId={selectedCameraDeviceId}
          onSelectCameraDevice={selectCameraDevice}
          isTorchOn={isTorchOn}
          hasTorchSupport={hasTorchSupport}
          onToggleTorch={handleToggleTorch}
          rtspUrl={rtspUrl}
          onChangeRtspUrl={changeRtspUrl}
          isConnected={isConnected}
          onConnect={() => {
            if (sourceType === 'onvif' && !onvifConfig.host.trim()) {
              setIsOnvifSetupOpen(true);
              return;
            }
            if (sourceType === 'onvif') {
              setOnvifError(null);
              setOnvifStatus('Connecting…');
            }
            setIsConnected(true);
            if (sourceType !== 'onvif') setTimeout(() => captureAndSetReference(), 200);
          }}
          onDisconnect={() => {
            setIsConnected(false);
            if (sourceType === 'onvif') setOnvifStatus('Disconnected');
          }}
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
            setAnchorsNeedingPlacement(current=>current.filter(value=>value!==id));
            if(replacementAnchorId===id){setReplacementAnchorId('');setPendingFeatureType(null);}
            setFeatures((prev) => prev.filter((f) => f.id !== id));
            setSelectedFeatureId(null);
          }}
          registrationMetrics={registrationMetrics}
          overlaySettings={overlaySettings}
          videoElement={videoElement}
          registrationSetup={registrationSetup}
          setupActiveViewId={setupActiveViewId}
          setupSnapshot={setupSnapshot}
          activeBoundaryViewId={boundaries.find(b=>b.id===activeDrawingBoundaryId)?.anchorViewId}
        />

        {registrationSetup && (
          <div className="absolute z-30 top-4 left-1/2 -translate-x-1/2 w-[min(560px,calc(100%-2rem))] rounded-lg border border-sky-500/50 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-sky-300">Visual Anchor Setup</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {sourceType === 'rtsp'
                    ? 'Connect the RTSP feed to capture setup views. The local WebRTC gateway provides browser video.'
                    : 'Capture a view and add its anchors. Press Finish This View to restore live video, move the camera, then capture another view. Registration starts after setup.'}
                </p>
              </div>
              <span className="shrink-0 rounded bg-slate-800 px-2 py-1 font-mono text-xs text-slate-300">{setupViews.length} VIEWS</span>
            </div>
            {anchorsNeedingPlacement.length>0&&<div className="mt-3 flex gap-2 text-xs">
              <select value={replacementAnchorId} onChange={event=>{setReplacementAnchorId(event.target.value);setPendingFeatureType(null);}} className="min-w-0 flex-1 rounded bg-slate-800 p-2">
                <option value="">Re-place a saved anchor ({anchorsNeedingPlacement.length} remaining)</option>
                {features.filter(f=>anchorsNeedingPlacement.includes(f.id)).map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <button disabled={!replacementAnchorId||!setupSnapshot} onClick={()=>{
                const f=features.find(f=>f.id===replacementAnchorId);if(!f)return;
                setPendingFeatureType(f.type);setPendingFeatureLabel(f.label);setPendingFeatureRotation(f.rotation||0);
                setPendingFeatureOptions({color:f.color,scale:f.scale,customImage:f.customImage,customImageType:f.customImageType});
              }} className="rounded bg-amber-800 px-3 disabled:opacity-40">Place anchor</button>
            </div>}
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
                  disabled={setupViews.length >= 12 || Boolean(setupActiveViewId && !features.some((feature) => feature.anchorViewId === setupActiveViewId)) || (sourceType !== 'simulator' && (!videoElement || !isVideoReady || videoElement.readyState < 2))}
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
                disabled={anchorsNeedingPlacement.length>0 || Boolean(setupSnapshot) || setupViews.length < 1 || setupViews.some((view) => !features.some((feature) => feature.anchorViewId === view.id))}
                className="ml-auto rounded border border-indigo-400/60 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Finish Setup &amp; Register
              </button>
              <button
                disabled={anchorsNeedingPlacement.length>0}
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
              {setupViews.length === 1 ? ' Additional views are optional; capture them to cover more of the scene.' : ''}
            </div>
          </div>
        )}

        {/* Shared PTZ controls for the exercise simulator and a real ONVIF camera */}
        {setupNotice && <div className="absolute top-2 left-2 right-2 z-40 rounded bg-amber-950/95 p-3 text-xs text-amber-100" role="status">{setupNotice}<button onClick={()=>setSetupNotice('')} className="ml-4 underline">Dismiss</button></div>}
        {sourceType==='onvif' && isVideoReady && <button onClick={()=>setCalibrationOpen(v=>!v)} className="absolute right-3 bottom-3 z-40 rounded border border-sky-500 bg-slate-900 px-3 py-2 text-xs text-sky-200">Improve PTZ accuracy (optional)</button>}
        {sourceType==='onvif' && calibrationOpen && activeOnvifProfile && <PtzCalibrationPanel key={`${cameraKey}:${onvifConfig.transport||'webrtc'}`}
          cameraKey={cameraKey} profile={activeOnvifProfile} calibration={calibration}
          capture={()=>{const c=cvCanvasRef.current;
            const time=frameCaptureTimeRef.current-performance.timeOrigin;
            if(!c||!framePoseRef.current||performance.now()-lastFrameAtRef.current>400||!poseTimelineRef.current.isSettled(time,calibration?.panPeriod??2,300))return null;
            return {image:c.toDataURL('image/jpeg',0.9),width:c.width,height:c.height,pose:framePoseRef.current};}}
          transport={onvifConfig.transport||'webrtc'}
          onSave={value=>{
            const config={...onvifConfig,calibration:value},bank={...calibrations,[cameraKey]:value};
            try{localStorage.setItem('vaas_ptz_calibrations',JSON.stringify(bank));localStorage.setItem('vaas_onvif_camera_config',JSON.stringify(config));}
            catch{setSetupNotice('The browser could not persist calibration. It will apply for this session.');}
            setCalibrations(bank);setOnvifConfig(config);setOnvifDraft(config);setCalibrationOpen(false);
          }}
          onClose={()=>setCalibrationOpen(false)} />}

        {(sourceType === 'simulator' || sourceType === 'onvif') && (
          <ExerciseSimulatorControls
            isOpen={showSimControls}
            onClose={() => setShowSimControls(false)}
            state={simState}
            onChangeState={setSimState}
            onvifMode={sourceType === 'onvif'}
            onHardwarePan={handleOnvifPan}
            onHardwareZoom={handleOnvifZoom}
            onHardwareStop={() => sendOnvifPtz({ action: 'stop' })}
            onHardwareHome={() => sendOnvifPtz({ action: 'home' })}
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
            onChangeSourceType={handleChangeSourceType}
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
        onUpdateCameraConfig={updateCameraConfig}
        regSettings={regSettings}
        onUpdateRegSettings={updateRegSettings}
        overlaySettings={overlaySettings}
        onUpdateOverlaySettings={setOverlaySettings}
        onSetCurrentAsReference={captureAndSetReference}
        sourceType={sourceType}
        onChangeSourceType={handleChangeSourceType}
        cameraFacingMode={cameraFacingMode}
        onChangeFacingMode={changeFacingMode}
        availableCameras={availableCameras}
        selectedCameraDeviceId={selectedCameraDeviceId}
        onSelectCameraDevice={selectCameraDevice}
        isTorchOn={isTorchOn}
        hasTorchSupport={hasTorchSupport}
        onToggleTorch={handleToggleTorch}
      />

      <OnvifSetupModal
        isOpen={isOnvifSetupOpen}
        config={onvifDraft}
        profiles={onvifProfiles}
        deviceName={onvifDeviceName}
        isBusy={onvifBusy}
        error={onvifError}
        onChange={config=>{
          if(JSON.stringify([config.host,config.port,config.endpointPath,config.username,config.password])!==JSON.stringify([onvifDraft.host,onvifDraft.port,onvifDraft.endpointPath,onvifDraft.username,onvifDraft.password])){
            setOnvifProfiles([]);setOnvifDeviceName('');config={...config,profileToken:undefined};
          }
          setOnvifDraft(config);
        }}
        onDiscover={handleOnvifDiscover}
        onSaveAndConnect={handleOnvifSaveAndConnect}
        onClose={handleCloseOnvifSetup}
        onForget={() => {
          localStorage.removeItem('vaas_onvif_camera_config');
          const bank={...calibrations};if(cameraKey)delete bank[cameraKey];
          setCalibrations(bank);try{localStorage.setItem('vaas_ptz_calibrations',JSON.stringify(bank));}catch{}
          resetCameraReferences();
          const emptyConfig = { host: '', port: 80, rtspPort: 554, endpointPath: '/onvif/device_service', username: '', password: '' };
          setOnvifConfig(emptyConfig);
          setOnvifDraft(emptyConfig);
          setOnvifProfiles([]);
          setOnvifDeviceName('');
          setOnvifError(null);
          setIsConnected(false);
          setIsOnvifSetupOpen(false);
        }}
      />
    </div>
  );
}
