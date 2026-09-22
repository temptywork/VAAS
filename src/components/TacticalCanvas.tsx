import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ExerciseFeature,
  ExerciseBoundary,
  BoundaryPoint,
  BoundaryConfig,
  RegistrationMetrics,
  OverlaySettings,
} from '../types';
import { FEATURE_LIBRARY } from '../data/featureDefinitions';
import { projectPoint, invertHomography } from '../cv/homography';
import { VisualRegistrationEngine } from '../cv/registrationEngine';
import { ExerciseTerrainRenderer, SimulatorCameraState } from './ExerciseTerrainRenderer';
import {
  AlertTriangle,
  Compass,
  Crosshair,
  Maximize2,
  Trash2,
  RotateCw,
} from 'lucide-react';

interface TacticalCanvasProps {
  engine: VisualRegistrationEngine;
  sourceType: 'simulator' | 'webcam' | 'rtsp';
  simState: SimulatorCameraState;
  features: ExerciseFeature[];
  boundaries?: ExerciseBoundary[];
  boundary?: BoundaryPoint[];
  boundaryConfig?: BoundaryConfig;
  activeBoundaryConfig?: BoundaryConfig;
  activeBoundaryPoints: BoundaryPoint[];
  isDrawingBoundary: boolean;
  pendingFeatureType: string | null;
  pendingFeatureLabel: string;
  pendingFeatureCustomImage?: string;
  onAddFeaturePoint: (refPoint: [number, number]) => void;
  onAddBoundaryPoint: (refPoint: [number, number]) => void;
  onSelectFeature: (feature: ExerciseFeature | null) => void;
  selectedFeatureId: string | null;
  onUpdateFeature: (feature: ExerciseFeature) => void;
  onDeleteFeature: (id: string) => void;
  registrationMetrics: RegistrationMetrics;
  overlaySettings: OverlaySettings;
  videoElement: HTMLVideoElement | null;
}

export const TacticalCanvas: React.FC<TacticalCanvasProps> = ({
  engine,
  sourceType,
  simState,
  features,
  boundaries = [],
  boundary = [],
  boundaryConfig,
  activeBoundaryConfig,
  activeBoundaryPoints,
  isDrawingBoundary,
  pendingFeatureType,
  pendingFeatureLabel,
  pendingFeatureCustomImage,
  onAddFeaturePoint,
  onAddBoundaryPoint,
  onSelectFeature,
  selectedFeatureId,
  onUpdateFeature,
  onDeleteFeature,
  registrationMetrics,
  overlaySettings,
  videoElement,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const terrainRendererRef = useRef<ExerciseTerrainRenderer>(new ExerciseTerrainRenderer());
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isHoveringFeature, setIsHoveringFeature] = useState(false);

  // Setup offscreen canvas for CV frame extraction (standardized e.g. 640x360 for fast 30+ fps CV)
  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = 640;
    offscreen.height = 360;
    offscreenCanvasRef.current = offscreen;
  }, []);

  // Main Render Loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // 1. Render Video Source
      if (sourceType === 'simulator') {
        terrainRendererRef.current.render(ctx, width, height, simState);
      } else if (sourceType === 'webcam' && videoElement && videoElement.readyState >= 2) {
        ctx.drawImage(videoElement, 0, 0, width, height);
      } else {
        // Fallback or connecting state
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CONNECTING TO RTSP STREAM SOURCE...', width / 2, height / 2);
      }

      // 2. Draw Subtle Military Reticle / Crosshairs
      if (overlaySettings.showHUD) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Center cross
        ctx.moveTo(width / 2 - 24, height / 2);
        ctx.lineTo(width / 2 + 24, height / 2);
        ctx.moveTo(width / 2, height / 2 - 24);
        ctx.lineTo(width / 2, height / 2 + 24);
        // Corner brackets
        const bSize = 20;
        const bPad = 24;
        // Top-left
        ctx.moveTo(bPad, bPad + bSize); ctx.lineTo(bPad, bPad); ctx.lineTo(bPad + bSize, bPad);
        // Top-right
        ctx.moveTo(width - bPad - bSize, bPad); ctx.lineTo(width - bPad, bPad); ctx.lineTo(width - bPad, bPad + bSize);
        // Bottom-left
        ctx.moveTo(bPad, height - bPad - bSize); ctx.lineTo(bPad, height - bPad); ctx.lineTo(bPad + bSize, height - bPad);
        // Bottom-right
        ctx.moveTo(width - bPad - bSize, height - bPad); ctx.lineTo(width - bPad, height - bPad); ctx.lineTo(width - bPad, height - bPad - bSize);
        ctx.stroke();

        // Corner Watermark Warning (PRD Section 38 & 46)
        ctx.fillStyle = 'rgba(248, 113, 113, 0.75)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('EXERCISE OVERLAY ONLY • NO GPS/INS • SIMULATED POSITIONS', bPad + 8, height - bPad - 8);
        ctx.restore();
      }

      // Current Homography transformation matrix
      const H = engine.getHomography();

      // 3. Draw CV Tracking Keypoints and Inliers (if enabled)
      if (overlaySettings.showTrackingFeatures && H) {
        ctx.save();
        // Inlier match vectors
        const inliers = engine.getInliers();
        if (overlaySettings.showMatchVectors && inliers.length > 0) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i < inliers.length; i++) {
            const m = inliers[i];
            // Scale normalized match coords to current canvas
            const rx = (m.refX / 640) * width;
            const ry = (m.refY / 360) * height;
            const cx = (m.curX / 640) * width;
            const cy = (m.curY / 360) * height;
            ctx.moveTo(rx, ry);
            ctx.lineTo(cx, cy);
          }
          ctx.stroke();
        }

        // Keypoints
        const curKeypoints = engine.getCurrentKeypoints();
        for (let i = 0; i < curKeypoints.length; i++) {
          const kp = curKeypoints[i];
          const kx = (kp.x / 640) * width;
          const ky = (kp.y / 360) * height;
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(kx - 1.5, ky - 1.5, 3, 3);
        }
        ctx.restore();
      }

      // Helper function to project a point from Reference Canvas (1280x720 baseline) to Current Screen
      const transformCoord = (refX: number, refY: number): [number, number] => {
        if (!H) return [refX, refY];
        // Normalize ref coordinates to 640x360 CV space
        const normRefX = (refX / width) * 640;
        const normRefY = (refY / height) * 360;
        const [projX, projY] = projectPoint(H, normRefX, normRefY);
        // Rescale back to current canvas resolution
        return [(projX / 640) * width, (projY / 360) * height];
      };

function hexToRgba(hex: string, alpha: number) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(239, 68, 68, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

      // 4. Draw Exercise Boundaries (Supports multiple layers, custom colors, thickness, closed areas, and labels)
      if (overlaySettings.showBoundary) {
        const renderBoundaryLayer = (
          pts: BoundaryPoint[],
          color: string,
          thickness: number,
          name: string,
          isClosed: boolean,
          fillOpacity: number,
          isBeingDrawn: boolean = false
        ) => {
          if (pts.length === 0) return;

          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = thickness;
          ctx.setLineDash([10, 5]);

          ctx.beginPath();
          const p0 = transformCoord(pts[0][0], pts[0][1]);
          ctx.moveTo(p0[0], p0[1]);

          for (let i = 1; i < pts.length; i++) {
            const pt = transformCoord(pts[i][0], pts[i][1]);
            ctx.lineTo(pt[0], pt[1]);
          }

          if (isClosed && !isBeingDrawn) {
            ctx.closePath();
          }

          // If currently being drawn and mouse is on canvas, connect to cursor
          if (isBeingDrawn && mousePos) {
            ctx.lineTo(mousePos.x, mousePos.y);
          }

          // Optional semi-transparent area fill if closed
          if (isClosed && !isBeingDrawn && fillOpacity > 0 && pts.length >= 3) {
            ctx.fillStyle = hexToRgba(color, fillOpacity);
            ctx.fill();
          }

          ctx.stroke();

          // Draw vertex points handles
          ctx.setLineDash([]);
          ctx.fillStyle = color;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < pts.length; i++) {
            const pt = transformCoord(pts[i][0], pts[i][1]);
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], Math.max(3.5, thickness * 1.0), 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          // Boundary Tactical Label Badge
          if (pts.length >= 2 && name && name.trim()) {
            const midIdx = Math.floor(pts.length / 2);
            const pA = transformCoord(pts[midIdx - 1][0], pts[midIdx - 1][1]);
            const pB = transformCoord(pts[midIdx][0], pts[midIdx][1]);
            const labelX = (pA[0] + pB[0]) / 2;
            const labelY = (pA[1] + pB[1]) / 2 - 14;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.2;
            const labelText = isBeingDrawn ? `[PLOTTING] ${name.trim()}` : name.trim();
            ctx.font = 'bold 11px monospace';
            const textWidth = ctx.measureText(labelText).width;

            ctx.beginPath();
            ctx.roundRect(labelX - textWidth / 2 - 8, labelY - 10, textWidth + 16, 20, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, labelX, labelY);
          }
          ctx.restore();
        };

        // Draw all persistent exercise boundaries in scenario
        if (boundaries && boundaries.length > 0) {
          boundaries.forEach((b) => {
            if (b.visible === false || b.points.length === 0) return;
            renderBoundaryLayer(
              b.points,
              b.color || '#ef4444',
              b.thickness || 3,
              b.name || 'BOUNDARY',
              Boolean(b.isClosed),
              b.fillOpacity || 0,
              false
            );
          });
        } else if (boundary && boundary.length > 0 && !isDrawingBoundary) {
          // Fallback to legacy single boundary
          renderBoundaryLayer(
            boundary,
            boundaryConfig?.color || '#ef4444',
            boundaryConfig?.thickness || overlaySettings.boundaryThickness || 3,
            boundaryConfig?.name || 'EXERCISE BOUNDARY',
            Boolean(boundaryConfig?.closed),
            boundaryConfig?.fillOpacity || 0,
            false
          );
        }

        // Draw active in-progress boundary points if operator is drawing
        if (isDrawingBoundary && activeBoundaryPoints.length > 0) {
          renderBoundaryLayer(
            activeBoundaryPoints,
            activeBoundaryConfig?.color || '#38bdf8',
            activeBoundaryConfig?.thickness || 3,
            activeBoundaryConfig?.name || 'NEW BOUNDARY',
            false,
            0,
            true
          );
        }
      }

      // 5. Draw Exercise Features (Symbols and Labels)
      if (overlaySettings.showSymbols) {
        features.forEach((feat) => {
          if (!feat.visible) return;
          const [cx, cy] = transformCoord(feat.x, feat.y);
          const isSelected = feat.id === selectedFeatureId;
          const def = FEATURE_LIBRARY[feat.type] || FEATURE_LIBRARY.tank;

          ctx.save();
          ctx.translate(cx, cy);

          // Apply rotation if present
          if (feat.rotation) {
            ctx.rotate((feat.rotation * Math.PI) / 180);
          }

          const baseScale = (feat.scale || 1.0) * overlaySettings.symbolScale;
          const symbolSize = 24 * baseScale;

          // Highlight ring if selected
          if (isSelected) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(0, 0, symbolSize * 0.9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Draw Custom SVG/JPG Symbol or Standard Military Shape
          if (feat.customImage) {
            let img = imageCacheRef.current.get(feat.customImage);
            if (!img) {
              img = new Image();
              img.src = feat.customImage;
              imageCacheRef.current.set(feat.customImage, img);
            }

            // Tactical badge background and border
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = feat.color || def.color || '#38bdf8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-symbolSize / 2, -symbolSize / 2, symbolSize, symbolSize, 4);
            ctx.fill();
            ctx.stroke();

            if (img.complete && img.naturalWidth > 0) {
              const pad = symbolSize * 0.12;
              ctx.drawImage(
                img,
                -symbolSize / 2 + pad,
                -symbolSize / 2 + pad,
                symbolSize - pad * 2,
                symbolSize - pad * 2
              );
            } else {
              ctx.fillStyle = feat.color || '#38bdf8';
              ctx.font = 'bold 9px monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('MARK', 0, 0);
            }
          } else {
            // Draw the Standard Military Symbol shape
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.strokeStyle = feat.color || def.color;
            ctx.lineWidth = 2.5;

            switch (def.shape) {
              case 'diamond': // Tank
                ctx.beginPath();
                ctx.moveTo(0, -symbolSize / 2);
                ctx.lineTo(symbolSize / 2, 0);
                ctx.lineTo(0, symbolSize / 2);
                ctx.lineTo(-symbolSize / 2, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Inner chevron for tank
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-symbolSize * 0.25, symbolSize * 0.1);
                ctx.lineTo(0, -symbolSize * 0.15);
                ctx.lineTo(symbolSize * 0.25, symbolSize * 0.1);
                ctx.stroke();
                break;

              case 'square': // Bunker
                ctx.beginPath();
                ctx.rect(-symbolSize / 2, -symbolSize / 2, symbolSize, symbolSize);
                ctx.fill();
                ctx.stroke();
                // Inner cross for fortification
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-symbolSize * 0.3, -symbolSize * 0.3);
                ctx.lineTo(symbolSize * 0.3, symbolSize * 0.3);
                ctx.moveTo(symbolSize * 0.3, -symbolSize * 0.3);
                ctx.lineTo(-symbolSize * 0.3, symbolSize * 0.3);
                ctx.stroke();
                break;

              case 'cross': // Gun / Arty
                ctx.beginPath();
                const arm = symbolSize * 0.25;
                const len = symbolSize * 0.5;
                ctx.moveTo(-arm, -len); ctx.lineTo(arm, -len);
                ctx.lineTo(arm, -arm); ctx.lineTo(len, -arm);
                ctx.lineTo(len, arm); ctx.lineTo(arm, arm);
                ctx.lineTo(arm, len); ctx.lineTo(-arm, len);
                ctx.lineTo(-arm, arm); ctx.lineTo(-len, arm);
                ctx.lineTo(-len, -arm); ctx.lineTo(-arm, -arm);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;

              case 'comm': // Communications Equipment
                ctx.beginPath();
                ctx.arc(0, 0, symbolSize * 0.45, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                // Antenna waves
                ctx.beginPath();
                ctx.arc(0, 0, symbolSize * 0.2, -Math.PI * 0.8, -Math.PI * 0.2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, symbolSize * 0.35, -Math.PI * 0.8, -Math.PI * 0.2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, symbolSize * 0.3);
                ctx.lineTo(0, -symbolSize * 0.1);
                ctx.stroke();
                break;

              case 'circle': // Personnel
                ctx.beginPath();
                ctx.arc(0, 0, symbolSize * 0.45, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, symbolSize * 0.18, 0, Math.PI * 2);
                ctx.fill();
                break;

              case 'rectangle': // Vehicle
                ctx.beginPath();
                ctx.rect(-symbolSize * 0.6, -symbolSize * 0.35, symbolSize * 1.2, symbolSize * 0.7);
                ctx.fill();
                ctx.stroke();
                break;

              case 'triangle': // Observation Post
                ctx.beginPath();
                ctx.moveTo(0, -symbolSize * 0.55);
                ctx.lineTo(symbolSize * 0.5, symbolSize * 0.45);
                ctx.lineTo(-symbolSize * 0.5, symbolSize * 0.45);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;

              case 'star': // Headquarters
                ctx.beginPath();
                for (let s = 0; s < 5; s++) {
                  const rOut = symbolSize * 0.5;
                  const rIn = symbolSize * 0.25;
                  const aOut = (s * 4 * Math.PI) / 5 - Math.PI / 2;
                  const aIn = aOut + (2 * Math.PI) / 10;
                  if (s === 0) ctx.moveTo(Math.cos(aOut) * rOut, Math.sin(aOut) * rOut);
                  else ctx.lineTo(Math.cos(aOut) * rOut, Math.sin(aOut) * rOut);
                  ctx.lineTo(Math.cos(aIn) * rIn, Math.sin(aIn) * rIn);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
            }
          }

          // Un-rotate for text label so labels remain upright and legible
          ctx.rotate(-(feat.rotation || 0) * (Math.PI / 180));

          // Tactical Text Label
          if (overlaySettings.showLabels && feat.label) {
            ctx.font = `bold ${overlaySettings.textSize}px monospace`;
            const labelMetrics = ctx.measureText(feat.label);
            const badgeW = labelMetrics.width + 12;
            const badgeH = overlaySettings.textSize + 8;
            const badgeY = symbolSize * 0.6 + 6;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = def.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(-badgeW / 2, badgeY, badgeW, badgeH, 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(feat.label, 0, badgeY + badgeH / 2);
          }

          ctx.restore();
        });
      }

      // 6. Registration Lost Warning Banner (Frozen Overlays per PRD Section 16 & 29)
      if (registrationMetrics.quality === 'LOST') {
        ctx.save();
        const bannerW = 340;
        const bannerH = 42;
        ctx.fillStyle = 'rgba(185, 28, 28, 0.92)';
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(width / 2 - bannerW / 2, 24, bannerW, bannerH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠ REGISTRATION LOST • OVERLAYS FROZEN', width / 2, 40);
        ctx.font = '11px monospace';
        ctx.fillText('Set Current View as Reference to Re-anchor', width / 2, 54);
        ctx.restore();
      }

      // 7. Preview Cursor for pending Add Feature placement
      if (pendingFeatureType && mousePos) {
        ctx.save();
        ctx.translate(mousePos.x, mousePos.y);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pendingFeatureLabel || 'CLICK TO PLACE', 0, 32);
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    engine,
    sourceType,
    simState,
    features,
    boundary,
    activeBoundaryPoints,
    isDrawingBoundary,
    pendingFeatureType,
    pendingFeatureLabel,
    selectedFeatureId,
    registrationMetrics,
    overlaySettings,
    videoElement,
    mousePos,
  ]);

  // Handle Resize of Tactical Canvas
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.floor(rect.height);
      }
    };

    handleResize();
    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    return () => ro.disconnect();
  }, []);

  // Canvas Click Handler: Inverts current screen click back to Reference Coordinates
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.x;
    const screenY = e.clientY - rect.y;

    const H = engine.getHomography();
    const invH = H ? invertHomography(H) : null;

    // Convert Screen (width x height) to CV 640x360 normalized coordinates
    const normCurX = (screenX / canvas.width) * 640;
    const normCurY = (screenY / canvas.height) * 360;

    let refCoordX = screenX;
    let refCoordY = screenY;

    if (invH) {
      const [invX, invY] = projectPoint(invH, normCurX, normCurY);
      refCoordX = (invX / 640) * canvas.width;
      refCoordY = (invY / 360) * canvas.height;
    }

    // If placing a new feature:
    if (pendingFeatureType) {
      onAddFeaturePoint([refCoordX, refCoordY]);
      return;
    }

    // If drawing boundary:
    if (isDrawingBoundary) {
      onAddBoundaryPoint([refCoordX, refCoordY]);
      return;
    }

    // Otherwise, check if user clicked an existing feature to select it
    let clickedFeature: ExerciseFeature | null = null;
    for (let i = features.length - 1; i >= 0; i--) {
      const feat = features[i];
      // Project ref coordinates to current screen
      let featScreenX = feat.x;
      let featScreenY = feat.y;
      if (H) {
        const [px, py] = projectPoint(
          H,
          (feat.x / canvas.width) * 640,
          (feat.y / canvas.height) * 360
        );
        featScreenX = (px / 640) * canvas.width;
        featScreenY = (py / 360) * canvas.height;
      }
      const dist = Math.hypot(screenX - featScreenX, screenY - featScreenY);
      if (dist <= 24) {
        clickedFeature = feat;
        break;
      }
    }

    onSelectFeature(clickedFeature);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.x;
    const y = e.clientY - rect.y;
    setMousePos({ x, y });

    // Check hover
    let isNear = false;
    const H = engine.getHomography();
    for (const feat of features) {
      let fx = feat.x;
      let fy = feat.y;
      if (H) {
        const [px, py] = projectPoint(
          H,
          (feat.x / canvas.width) * 640,
          (feat.y / canvas.height) * 360
        );
        fx = (px / 640) * canvas.width;
        fy = (py / 360) * canvas.height;
      }
      if (Math.hypot(x - fx, y - fy) <= 24) {
        isNear = true;
        break;
      }
    }
    setIsHoveringFeature(isNear);
  };

  const selectedFeature = features.find((f) => f.id === selectedFeatureId);

  return (
    <div
      ref={containerRef}
      id="tactical-canvas-container"
      className="relative w-full h-full bg-slate-950 overflow-hidden select-none flex items-center justify-center cursor-crosshair"
    >
      <canvas
        ref={canvasRef}
        id="tactical-live-canvas"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMousePos(null)}
        className="w-full h-full block"
        style={{
          cursor: pendingFeatureType
            ? 'crosshair'
            : isDrawingBoundary
            ? 'crosshair'
            : isHoveringFeature
            ? 'pointer'
            : 'default',
        }}
      />

      {/* Floating Tactical Selected Feature Quick Editor */}
      {selectedFeature && (
        <div
          id="feature-inspector-popup"
          className="absolute top-4 right-4 z-20 bg-slate-900/95 border border-sky-500/40 rounded-lg p-3 shadow-2xl backdrop-blur-md w-72 text-xs text-slate-200"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
            <span className="font-mono font-semibold tracking-wider text-sky-400 uppercase flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5" />
              {selectedFeature.label}
            </span>
            <button
              onClick={() => onSelectFeature(null)}
              className="text-slate-400 hover:text-white text-sm px-1"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                Label
              </label>
              <input
                type="text"
                value={selectedFeature.label}
                onChange={(e) =>
                  onUpdateFeature({ ...selectedFeature, label: e.target.value })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  Rotation ({selectedFeature.rotation || 0}°)
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="15"
                  value={selectedFeature.rotation || 0}
                  onChange={(e) =>
                    onUpdateFeature({
                      ...selectedFeature,
                      rotation: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-sky-400 h-1 bg-slate-700 rounded"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  Scale ({(selectedFeature.scale || 1).toFixed(1)}x)
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={selectedFeature.scale || 1.0}
                  onChange={(e) =>
                    onUpdateFeature({
                      ...selectedFeature,
                      scale: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-sky-400 h-1 bg-slate-700 rounded"
                />
              </div>
            </div>

            {selectedFeature.customImage && (
              <div className="flex items-center gap-2 p-1.5 bg-slate-950/70 rounded border border-slate-800">
                <div className="w-8 h-8 bg-slate-900 border border-sky-500/40 rounded p-1 flex items-center justify-center shrink-0">
                  <img
                    src={selectedFeature.customImage}
                    alt="Custom Symbol"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  <span className="text-sky-300 font-bold block">Custom Symbol</span>
                  <span className="uppercase text-[9px] text-slate-500">
                    {selectedFeature.customImageType || 'SVG/JPG'} format
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">
                Ref: X:{Math.round(selectedFeature.x)} Y:{Math.round(selectedFeature.y)}
              </span>
              <button
                onClick={() => onDeleteFeature(selectedFeature.id)}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2 py-1 rounded transition"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
