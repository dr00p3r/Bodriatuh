import { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useHuman } from '../../hooks/useHuman';
import {
  processHumanResult,
  formatFaceError,
  drawFaceInfo,
  FACE_CONFIG,
} from '../../utils/faceProcessing';
import type {
  FaceScannerProps,
  FaceScannerStatus,
  FaceDetectionResult,
  FaceScannerConfig,
  HumanResult,
} from '../../types';
import './FaceScanner.css';

// ─── Anti-spoofing phases ─────────────────────────────────────────────────────
/**
 * Passive liveness: no challenges required. The user just looks at the camera.
 *
 * detecting  → stabilise face, begin collecting signals
 * analyzing  → collect N frames of multi-signal data (micro-movement, scores, depth, blink)
 * capturing  → grab final embedding
 */
type ScannerPhase = 'detecting' | 'analyzing' | 'capturing';

// ─── Configuration ────────────────────────────────────────────────────────────
const ANALYSIS_CONFIG = {
  /** Stable frames before starting passive analysis */
  STABLE_FRAMES_REQUIRED: 3,
  /** Frames to collect during analysis (~3-4 s at 15-20 fps) */
  ANALYSIS_FRAMES: 55,
  /** Frames for final capture */
  CAPTURE_FRAMES_REQUIRED: 3,
  /** Screen detection threshold (0-1). > this → reject */
  SCREEN_DETECTION_THRESHOLD: 0.7,

  /* ── Micro-movement thresholds ───────────────────────────── */
  /** Minimum landmark variance to accept (photos/stills are ≈ 0) */
  MIN_LANDMARK_VARIANCE: 0.35,
  /** Maximum landmark variance (too much = shaking phone / video replay) */
  MAX_LANDMARK_VARIANCE: 8.0,

  /* ── Score aggregation ───────────────────────────────────── */
  /** Minimum median liveness score across collected frames */
  MIN_MEDIAN_LIVENESS: 0.55,
  /** Minimum median antispoof score across collected frames */
  MIN_MEDIAN_ANTISPOOF: 0.4,

  /* ── Score consistency (anti-photo) ──────────────────────── */
  /** Minimum variance of liveness scores across frames.
   *  Photos produce nearly identical scores every frame → variance ≈ 0.
   *  Real faces have micro-expressions & lighting shifts → variance > 0. */
  MIN_SCORE_VARIANCE: 0.002,

  /* ── 3D depth check ──────────────────────────────────────── */
  /** Minimum depth range in face mesh z-coordinates (flat = photo) */
  MIN_DEPTH_RANGE: 3.0,

  /* ── Iris micro-saccade ──────────────────────────────────── */
  /** Minimum iris movement variance between frames.
   *  Real eyes have involuntary micro-saccades; photo eyes are static. */
  MIN_IRIS_MOVEMENT: 0.15,

  /* ── Natural blink (★ MANDATORY GATE ★) ──────────────────── */
  /** A natural blink MUST be detected. Without it the scan ALWAYS fails
   *  regardless of how many other signals pass.
   *  This is the single strongest anti-photo signal — photos cannot blink. */
  REQUIRE_BLINK: true,

  /* ── Temporal embedding consistency ──────────────────────── */
  /** Min cosine similarity between first and last embeddings (same person throughout) */
  MIN_EMBEDDING_CONSISTENCY: 0.85,

  /* ── Minimum passing scored signals (out of 8) ─────────── */
  /** microMovement, liveness, antispoof, depth, embeddingConsistency,
   *  scoreVariance, irisMovement, blink (counted as signal too).
   *  PLUS mandatory blink gate (always required on top). */
  MIN_PASSING_SIGNALS: 5,
} as const;

// ─── Helper: median of a number array ─────────────────────────────────────────
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function FaceScanner({
  config,
  onScanComplete,
  onError,
  onStatusChange,
  className = '',
}: FaceScannerProps) {
  // Refs
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const statusRef = useRef<FaceScannerStatus>('idle');

  // Liveness analysis state
  const phaseRef = useRef<ScannerPhase>('detecting');
  const stableFramesRef = useRef<number>(0);
  const captureFramesRef = useRef<number>(0);
  const lastValidResultRef = useRef<FaceDetectionResult | null>(null);

  // Passive analysis data collectors
  const analysisFrameCountRef = useRef<number>(0);
  const livenessScoresRef = useRef<number[]>([]);
  const antispoofScoresRef = useRef<number[]>([]);
  const landmarkHistoryRef = useRef<Array<[number, number]>>([]);  // nose tip positions
  const depthSamplesRef = useRef<number[]>([]);  // z-range from mesh
  const blinkDetectedRef = useRef<boolean>(false);
  const firstEmbeddingRef = useRef<number[] | null>(null);  // embedding from start of analysis
  const lastEmbeddingRef = useRef<number[] | null>(null);   // embedding from end of analysis
  const irisPositionHistoryRef = useRef<Array<[number, number]>>([]);  // iris center positions

  // Screen detection: store recent frame brightness samples
  const frameSamplesRef = useRef<number[]>([]);

  // State
  const [status, setStatus] = useState<FaceScannerStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  // Human hook
  const { isLoading, isReady, error: humanError, detect, warmup } = useHuman();

  // Config con defaults
  const scannerConfig: Required<FaceScannerConfig> = {
    minConfidence: config?.minConfidence ?? FACE_CONFIG.MIN_CONFIDENCE,
    vectorLength: config?.vectorLength ?? FACE_CONFIG.MIN_VECTOR_LENGTH,
    timeout: config?.timeout ?? 45000,
    autoStart: config?.autoStart ?? false,
    showOverlay: config?.showOverlay ?? true,
    debugMode: config?.debugMode ?? false,
  };

  /**
   * Actualiza el estado y notifica al padre
   */
  const updateStatus = useCallback(
    (newStatus: FaceScannerStatus, msg: string = '') => {
      statusRef.current = newStatus;
      setStatus(newStatus);
      setMessage(msg);
      onStatusChange?.(newStatus);

      if (scannerConfig.debugMode) {
        console.log(`[FaceScanner] Status: ${newStatus}`, msg);
      }
    },
    [onStatusChange, scannerConfig.debugMode]
  );

  /**
   * Maneja errores
   */
  const handleError = useCallback(
    (error: Error | unknown) => {
      const formattedError =
        error instanceof Error ? error : new Error(formatFaceError(error));

      updateStatus('error', formattedError.message);
      onError?.(formattedError);

      if (scannerConfig.debugMode) {
        console.error('[FaceScanner] Error:', formattedError);
      }
    },
    [onError, updateStatus, scannerConfig.debugMode]
  );

  /**
   * Inicialización
   */
  useEffect(() => {
    if (isLoading) {
      updateStatus('initializing', 'Cargando modelos de IA...');
    } else if (humanError) {
      handleError(humanError);
    } else if (isReady) {
      updateStatus('ready', 'Listo para escanear');
      
      // Warmup del modelo
      warmup().catch(console.warn);

      // Auto-start con delay para que el usuario se acomode
      if (scannerConfig.autoStart) {
        updateStatus('ready', 'Prepárate... el escaneo iniciará en unos segundos');
        const countdownTimeout = setTimeout(() => {
          if (statusRef.current === 'ready') {
            startScanning();
          }
        }, 3000);
        return () => clearTimeout(countdownTimeout);
      }
    }
  }, [isLoading, isReady, humanError, scannerConfig.autoStart]);

  /**
   * Dibuja guía ovalada con indicador visual de la fase actual
   */
  const drawFaceGuide = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentStatus: FaceScannerStatus,
    phase: ScannerPhase,
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const ovalW = width * 0.28;
    const ovalH = height * 0.42;

    // Oscurecer fuera del óvalo
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, ovalW, ovalH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Color del borde según fase
    ctx.save();
    let color: string;
    if (currentStatus === 'success') {
      color = '#22c55e';
    } else if (currentStatus === 'error') {
      color = '#ef4444';
    } else if (phase === 'analyzing') {
      // Pulsing indigo during analysis
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 400);
      color = `rgba(99, 102, 241, ${pulse})`;
    } else if (phase === 'capturing') {
      color = '#22c55e';
    } else {
      color = '#3b82f6';
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = currentStatus === 'scanning' ? 12 : 0;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, ovalW, ovalH, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Marcas de esquina
    ctx.lineWidth = 4;
    ctx.shadowBlur = 0;
    const arcLen = 0.15;
    for (const angle of [-Math.PI / 2, Math.PI / 2, Math.PI, 0]) {
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, ovalW, ovalH, 0, angle - arcLen, angle + arcLen);
      ctx.stroke();
    }

    ctx.restore();
  }, []);

  // ─── Passive analysis helpers ─────────────────────────────────────────────

  /** Detect natural blink via Human.js gesture array */
  const checkNaturalBlink = useCallback((result: HumanResult): boolean => {
    if (!result.gesture || result.gesture.length === 0) return false;
    return result.gesture.some(
      g => typeof g.gesture === 'string' && g.gesture.toLowerCase().includes('blink')
    );
  }, []);

  /** Extract nose-tip 2D position for micro-movement tracking */
  const extractNoseTip = useCallback((result: HumanResult): [number, number] | null => {
    const face = result.face?.[0];
    // annotations.noseTip is [x, y, z] or mesh[1] is commonly nose tip in 468-landmark model
    if (face?.annotations?.noseTip?.[0]) {
      const [x, y] = face.annotations.noseTip[0];
      return [x, y];
    }
    // Fallback: center of bounding box
    if (face?.box) {
      return [face.box[0] + face.box[2] / 2, face.box[1] + face.box[3] / 2];
    }
    return null;
  }, []);

  /** Calculate z-depth range from face mesh — flat images have very low range */
  const extractDepthRange = useCallback((result: HumanResult): number => {
    const face = result.face?.[0];
    if (!face?.mesh || face.mesh.length < 10) return 0;

    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const point of face.mesh) {
      const z = point[2] ?? 0;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    return maxZ - minZ;
  }, []);

  /** Extract iris center position for micro-saccade detection */
  const extractIrisCenter = useCallback((result: HumanResult): [number, number] | null => {
    const face = result.face?.[0];
    const leftIris = face?.annotations?.leftEyeIris;
    const rightIris = face?.annotations?.rightEyeIris;

    if (leftIris?.[0] && rightIris?.[0]) {
      const cx = (leftIris[0][0] + rightIris[0][0]) / 2;
      const cy = (leftIris[0][1] + rightIris[0][1]) / 2;
      return [cx, cy];
    }
    if (leftIris?.[0]) return [leftIris[0][0], leftIris[0][1]];
    if (rightIris?.[0]) return [rightIris[0][0], rightIris[0][1]];
    return null;
  }, []);

  /** Calculate iris movement variance — real eyes have micro-saccades, photos don't */
  const calculateIrisMovement = useCallback((): number => {
    const history = irisPositionHistoryRef.current;
    if (history.length < 5) return 0;

    const dxs: number[] = [];
    const dys: number[] = [];
    for (let i = 1; i < history.length; i++) {
      dxs.push(history[i][0] - history[i - 1][0]);
      dys.push(history[i][1] - history[i - 1][1]);
    }

    const meanDx = dxs.reduce((s, v) => s + v, 0) / dxs.length;
    const meanDy = dys.reduce((s, v) => s + v, 0) / dys.length;

    const varX = dxs.reduce((s, v) => s + (v - meanDx) ** 2, 0) / dxs.length;
    const varY = dys.reduce((s, v) => s + (v - meanDy) ** 2, 0) / dys.length;

    return varX + varY;
  }, []);

  /** Calculate variance of a number array */
  const calculateVariance = useCallback((arr: number[]): number => {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  }, []);

  /** Calculate variance of landmark positions → detect static images */
  const calculateLandmarkVariance = useCallback((): number => {
    const history = landmarkHistoryRef.current;
    if (history.length < 5) return 0;

    // Calculate variance of x and y deltas between consecutive frames
    const dxs: number[] = [];
    const dys: number[] = [];
    for (let i = 1; i < history.length; i++) {
      dxs.push(history[i][0] - history[i - 1][0]);
      dys.push(history[i][1] - history[i - 1][1]);
    }

    const meanDx = dxs.reduce((s, v) => s + v, 0) / dxs.length;
    const meanDy = dys.reduce((s, v) => s + v, 0) / dys.length;

    const varX = dxs.reduce((s, v) => s + (v - meanDx) ** 2, 0) / dxs.length;
    const varY = dys.reduce((s, v) => s + (v - meanDy) ** 2, 0) / dys.length;

    return varX + varY;
  }, []);

  /**
   * Evaluate all collected signals and decide pass/fail
   * Returns { passed: boolean, failedReasons: string[] }
   */
  const evaluatePassiveSignals = useCallback((): { passed: boolean; failedReasons: string[] } => {
    const failedReasons: string[] = [];
    let passedCount = 0;

    // ★ MANDATORY GATE: Natural blink
    // Photos CANNOT blink — this is the most reliable anti-photo signal.
    // If blink is required and not detected, fail IMMEDIATELY.
    if (ANALYSIS_CONFIG.REQUIRE_BLINK && !blinkDetectedRef.current) {
      failedReasons.push('★ MANDATORY: no natural blink detected — possible photo/static image');
      return { passed: false, failedReasons };
    }

    // ─── Scored signals (8 total) ──────────────────────────────────

    // Signal 1: Micro-movement (natural involuntary head motion)
    const landmarkVar = calculateLandmarkVariance();
    if (landmarkVar >= ANALYSIS_CONFIG.MIN_LANDMARK_VARIANCE &&
        landmarkVar <= ANALYSIS_CONFIG.MAX_LANDMARK_VARIANCE) {
      passedCount++;
    } else {
      if (landmarkVar < ANALYSIS_CONFIG.MIN_LANDMARK_VARIANCE) {
        failedReasons.push(`micro-movement too low (${landmarkVar.toFixed(3)}) — possible photo`);
      } else {
        failedReasons.push(`micro-movement too high (${landmarkVar.toFixed(3)}) — possible video replay`);
      }
    }

    // Signal 2: Median liveness score
    const medLiveness = median(livenessScoresRef.current);
    if (medLiveness >= ANALYSIS_CONFIG.MIN_MEDIAN_LIVENESS) {
      passedCount++;
    } else {
      failedReasons.push(`median liveness ${medLiveness.toFixed(2)} < ${ANALYSIS_CONFIG.MIN_MEDIAN_LIVENESS}`);
    }

    // Signal 3: Median antispoof score
    const medAntispoof = median(antispoofScoresRef.current);
    if (medAntispoof >= ANALYSIS_CONFIG.MIN_MEDIAN_ANTISPOOF) {
      passedCount++;
    } else {
      failedReasons.push(`median antispoof ${medAntispoof.toFixed(2)} < ${ANALYSIS_CONFIG.MIN_MEDIAN_ANTISPOOF}`);
    }

    // Signal 4: 3D depth from face mesh
    const medDepth = median(depthSamplesRef.current);
    if (medDepth >= ANALYSIS_CONFIG.MIN_DEPTH_RANGE) {
      passedCount++;
    } else {
      failedReasons.push(`depth range ${medDepth.toFixed(2)} < ${ANALYSIS_CONFIG.MIN_DEPTH_RANGE} — possible flat image`);
    }

    // Signal 5: Temporal embedding consistency (same face start→end)
    const emb1 = firstEmbeddingRef.current;
    const emb2 = lastEmbeddingRef.current;
    if (emb1 && emb2 && emb1.length === emb2.length) {
      let dot = 0, m1 = 0, m2 = 0;
      for (let i = 0; i < emb1.length; i++) {
        dot += emb1[i] * emb2[i];
        m1 += emb1[i] * emb1[i];
        m2 += emb2[i] * emb2[i];
      }
      const cosSim = (Math.sqrt(m1) * Math.sqrt(m2)) > 0
        ? dot / (Math.sqrt(m1) * Math.sqrt(m2))
        : 0;
      if (cosSim >= ANALYSIS_CONFIG.MIN_EMBEDDING_CONSISTENCY) {
        passedCount++;
      } else {
        failedReasons.push(`embedding consistency ${cosSim.toFixed(3)} < ${ANALYSIS_CONFIG.MIN_EMBEDDING_CONSISTENCY}`);
      }
    } else {
      failedReasons.push('could not compare start/end embeddings');
    }

    // Signal 6: Score variance (anti-photo)
    // Photos produce nearly identical liveness scores across all frames
    // because the visual input doesn't change. Real faces have micro-expressions,
    // breathing, and lighting micro-shifts that cause natural score variance.
    const livenessVariance = calculateVariance(livenessScoresRef.current);
    const antispoofVariance = calculateVariance(antispoofScoresRef.current);
    const combinedScoreVar = livenessVariance + antispoofVariance;
    if (combinedScoreVar >= ANALYSIS_CONFIG.MIN_SCORE_VARIANCE) {
      passedCount++;
    } else {
      failedReasons.push(`score variance ${combinedScoreVar.toFixed(5)} < ${ANALYSIS_CONFIG.MIN_SCORE_VARIANCE} — scores too uniform (photo?)`);
    }

    // Signal 7: Iris micro-saccade
    // Real eyes have involuntary micro-movements (saccades) even when
    // looking at a fixed point. Photo/screen eyes are perfectly static.
    const irisMovement = calculateIrisMovement();
    if (irisMovement >= ANALYSIS_CONFIG.MIN_IRIS_MOVEMENT) {
      passedCount++;
    } else {
      failedReasons.push(`iris movement ${irisMovement.toFixed(4)} < ${ANALYSIS_CONFIG.MIN_IRIS_MOVEMENT} — eyes too static (photo?)`);
    }

    // Signal 8: Blink (already passed mandatory gate, count as signal too)
    if (blinkDetectedRef.current) {
      passedCount++;
    }

    return {
      passed: passedCount >= ANALYSIS_CONFIG.MIN_PASSING_SIGNALS,
      failedReasons,
    };
  }, [calculateLandmarkVariance, calculateIrisMovement, calculateVariance]);

  // ─── Screen / video replay detection ──────────────────────────────────────

  /**
   * Analiza el frame del video para detectar patrones de pantalla.
   * Las pantallas tienen:
   * - Alta frecuencia espacial por el grid de píxeles (moire)
   * - Uniformidad de luminancia en regiones grandes (backlight)
   * - Brillo estable entre frames (vs cara real con micro-variaciones)
   * 
   * Retorna un score de 0 (probably real) a 1 (probably screen).
   */
  const analyzeScreenArtifacts = useCallback((
    video: HTMLVideoElement,
    faceBox: number[]
  ): number => {
    // Crear canvas temporal para análisis
    const tempCanvas = document.createElement('canvas');
    const size = 64; // análisis a baja resolución para performance
    tempCanvas.width = size;
    tempCanvas.height = size;
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0;

    // Extraer la región del rostro
    const [fx, fy, fw, fh] = faceBox;
    ctx.drawImage(video, fx, fy, fw, fh, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;

    // 1. Análisis de alta frecuencia (edge density)
    //    Las pantallas tienen bordes de pixel muy definidos que crean un patrón regular
    let edgeCount = 0;
    let totalPixels = 0;
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = (y * size + x) * 4;
        const idxRight = (y * size + x + 1) * 4;
        const idxDown = ((y + 1) * size + x) * 4;

        // Gradiente horizontal y vertical en luminancia
        const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        const lumR = data[idxRight] * 0.299 + data[idxRight + 1] * 0.587 + data[idxRight + 2] * 0.114;
        const lumD = data[idxDown] * 0.299 + data[idxDown + 1] * 0.587 + data[idxDown + 2] * 0.114;

        const gradH = Math.abs(lum - lumR);
        const gradV = Math.abs(lum - lumD);

        if (gradH > 8 || gradV > 8) edgeCount++;
        totalPixels++;
      }
    }
    const edgeDensity = edgeCount / totalPixels;

    // 2. Análisis de estabilidad de brillo entre frames
    //    Una pantalla tiene iluminación más uniforme/estable que la luz ambiente
    let totalLum = 0;
    let pixCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      totalLum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      pixCount++;
    }
    const avgBrightness = totalLum / pixCount;

    // Acumular samples de brillo para detectar varianza temporal
    frameSamplesRef.current.push(avgBrightness);
    if (frameSamplesRef.current.length > 30) {
      frameSamplesRef.current.shift();
    }

    let brightnessVariance = 0;
    if (frameSamplesRef.current.length >= 10) {
      const samples = frameSamplesRef.current;
      const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
      brightnessVariance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
    }

    // 3. Análisis de uniformidad de color
    //    Pantallas tienen regiones de color más uniformes
    let colorVariance = 0;
    const regionSize = Math.floor(size / 4);
    const regionMeans: number[] = [];
    for (let ry = 0; ry < 4; ry++) {
      for (let rx = 0; rx < 4; rx++) {
        let regionSum = 0;
        let regionCount = 0;
        for (let dy = 0; dy < regionSize; dy++) {
          for (let dx = 0; dx < regionSize; dx++) {
            const px = rx * regionSize + dx;
            const py = ry * regionSize + dy;
            const idx = (py * size + px) * 4;
            regionSum += data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            regionCount++;
          }
        }
        regionMeans.push(regionSum / regionCount);
      }
    }
    const regionMean = regionMeans.reduce((s, v) => s + v, 0) / regionMeans.length;
    colorVariance = regionMeans.reduce((s, v) => s + (v - regionMean) ** 2, 0) / regionMeans.length;

    // Combinar señales en un score
    // Alta edge density → posible moire → screen
    // Baja brightness variance → iluminación estable → screen
    // Baja color variance local → backlight uniforme → screen
    const edgeScore = Math.min(edgeDensity / 0.5, 1); // normalizar
    const stabilityScore = brightnessVariance < 2 ? 0.8 : brightnessVariance < 5 ? 0.4 : 0;
    const uniformityScore = colorVariance < 100 ? 0.6 : colorVariance < 300 ? 0.3 : 0;

    const screenScore = (edgeScore * 0.3 + stabilityScore * 0.4 + uniformityScore * 0.3);

    if (scannerConfig.debugMode) {
      console.log(`[FaceScanner] Screen detection: edge=${edgeDensity.toFixed(3)}, brightnessVar=${brightnessVariance.toFixed(2)}, colorVar=${colorVariance.toFixed(1)}, score=${screenScore.toFixed(2)}`);
    }

    return screenScore;
  }, [scannerConfig.debugMode]);

  /**
   * Loop de detección con análisis pasivo anti-spoofing.
   *
   * Fases:
   * 1. detecting  — estabiliza rostro + screen check
   * 2. analyzing  — recopila N frames de señales pasivas (micro-movimiento,
   *                 liveness, antispoof, profundidad 3D mesh, parpadeo natural)
   * 3. capturing  — captura embedding final
   */
  const detectionLoop = useCallback(async () => {
    if (statusRef.current !== 'scanning') return;

    const video = webcamRef.current?.video;
    const canvas = canvasRef.current;

    if (!video || !canvas || !isReady) {
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    try {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const result = await detect(video);
      if (!result) {
        animationFrameRef.current = requestAnimationFrame(detectionLoop);
        return;
      }

      const phase = phaseRef.current;

      // Dibujar overlay
      if (scannerConfig.showOverlay) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawFaceGuide(ctx, canvas.width, canvas.height, status, phase);
          drawFaceInfo(canvas, result, scannerConfig.debugMode);
        }
      }

      const faceResult = processHumanResult(result, scannerConfig.minConfidence);

      if (scannerConfig.debugMode) {
        const frameCount = analysisFrameCountRef.current;
        console.log(`[FaceScanner] Phase: ${phase} | Frame: ${frameCount}/${ANALYSIS_CONFIG.ANALYSIS_FRAMES} | Detected: ${faceResult.detected}`);
      }

      // Si no se detecta un rostro válido
      if (!faceResult.detected || !faceResult.vector) {
        if (phase === 'detecting') {
          stableFramesRef.current = 0;
        }
        setMessage(faceResult.message || 'Coloca tu rostro dentro del óvalo');
        setProgress(Math.min(faceResult.confidence * 100, 10));
        animationFrameRef.current = requestAnimationFrame(detectionLoop);
        return;
      }

      // ═══════════════════════════════════════════
      // FASE 1: DETECTING — estabilizar + screen check
      // ═══════════════════════════════════════════
      if (phase === 'detecting') {
        stableFramesRef.current += 1;

        // Screen artifact detection
        const faceBox = result.face?.[0]?.box;
        if (faceBox && stableFramesRef.current >= 2) {
          const screenScore = analyzeScreenArtifacts(video, faceBox);
          if (screenScore > ANALYSIS_CONFIG.SCREEN_DETECTION_THRESHOLD) {
            if (scannerConfig.debugMode) {
              console.warn(`[FaceScanner] ⚠ Screen detected! Score: ${screenScore.toFixed(2)}`);
            }
            setMessage('Se detectó una posible pantalla. Usa la cámara directamente.');
            setProgress(5);
            stableFramesRef.current = 0;
            frameSamplesRef.current = [];
            animationFrameRef.current = requestAnimationFrame(detectionLoop);
            return;
          }
        }

        if (stableFramesRef.current >= ANALYSIS_CONFIG.STABLE_FRAMES_REQUIRED) {
          // Rostro estable → iniciar análisis pasivo
          phaseRef.current = 'analyzing';
          analysisFrameCountRef.current = 0;
          livenessScoresRef.current = [];
          antispoofScoresRef.current = [];
          landmarkHistoryRef.current = [];
          depthSamplesRef.current = [];
          blinkDetectedRef.current = false;
          firstEmbeddingRef.current = null;
          lastEmbeddingRef.current = null;
          irisPositionHistoryRef.current = [];

          setMessage('Verificando... parpadea naturalmente y mira a la cámara');
          setProgress(15);

          if (scannerConfig.debugMode) {
            console.log('[FaceScanner] → Starting passive analysis');
          }
        } else {
          setMessage('Rostro detectado, mantente quieto...');
          setProgress(Math.min((stableFramesRef.current / ANALYSIS_CONFIG.STABLE_FRAMES_REQUIRED) * 15, 15));
        }
      }

      // ═══════════════════════════════════════════
      // FASE 2: ANALYZING — recopilar señales pasivas
      // ═══════════════════════════════════════════
      else if (phase === 'analyzing') {
        analysisFrameCountRef.current += 1;
        const frame = analysisFrameCountRef.current;
        const face = result.face?.[0];

        // Collect liveness & antispoof scores
        if (face?.live !== undefined) livenessScoresRef.current.push(face.live);
        if (face?.real !== undefined) antispoofScoresRef.current.push(face.real);

        // Capture first and last embeddings for temporal consistency check
        if (faceResult.vector) {
          if (frame <= 2 && !firstEmbeddingRef.current) {
            firstEmbeddingRef.current = [...faceResult.vector];
          }
          lastEmbeddingRef.current = faceResult.vector;
        }

        // Collect nose-tip position for micro-movement
        const noseTip = extractNoseTip(result);
        if (noseTip) landmarkHistoryRef.current.push(noseTip);

        // Collect iris center for micro-saccade detection
        const irisCenter = extractIrisCenter(result);
        if (irisCenter) irisPositionHistoryRef.current.push(irisCenter);

        // Collect mesh depth range
        const depthRange = extractDepthRange(result);
        if (depthRange > 0) depthSamplesRef.current.push(depthRange);

        // Detect natural blink (any frame)
        if (!blinkDetectedRef.current && checkNaturalBlink(result)) {
          blinkDetectedRef.current = true;
          if (scannerConfig.debugMode) {
            console.log('[FaceScanner] ✓ Natural blink detected');
          }
        }

        // Progress: 15% → 85% during analysis
        const analysisProgress = 15 + (frame / ANALYSIS_CONFIG.ANALYSIS_FRAMES) * 70;
        setProgress(Math.min(analysisProgress, 85));
        setMessage(blinkDetectedRef.current
          ? 'Verificando... mantente mirando a la cámara'
          : 'Verificando... parpadea naturalmente y mira a la cámara');

        // All frames collected → evaluate
        if (frame >= ANALYSIS_CONFIG.ANALYSIS_FRAMES) {
          const evaluation = evaluatePassiveSignals();

          if (scannerConfig.debugMode) {
            console.log('[FaceScanner] Analysis complete:', {
              passed: evaluation.passed,
              failedReasons: evaluation.failedReasons,
              livenessMedian: median(livenessScoresRef.current).toFixed(3),
              antispoofMedian: median(antispoofScoresRef.current).toFixed(3),
              landmarkVar: calculateLandmarkVariance().toFixed(4),
              depthMedian: median(depthSamplesRef.current).toFixed(2),
              blinkDetected: blinkDetectedRef.current,
              hasFirstEmb: !!firstEmbeddingRef.current,
              hasLastEmb: !!lastEmbeddingRef.current,
              livenessVariance: calculateVariance(livenessScoresRef.current).toFixed(5),
              irisMovement: calculateIrisMovement().toFixed(4),
              irisPoints: irisPositionHistoryRef.current.length,
            });
          }

          if (evaluation.passed) {
            // Passed → capture final embedding
            phaseRef.current = 'capturing';
            captureFramesRef.current = 0;
            setMessage('¡Verificación exitosa! Capturando rostro...');
            setProgress(85);
          } else {
            // Failed → retry
            if (scannerConfig.debugMode) {
              console.warn('[FaceScanner] ✗ Analysis failed:', evaluation.failedReasons);
            }
            phaseRef.current = 'detecting';
            stableFramesRef.current = 0;
            frameSamplesRef.current = [];
            setMessage('No se pudo verificar. Intenta mejorar la iluminación y mira directamente.');
            setProgress(0);
          }
        }
      }

      // ═══════════════════════════════════════════
      // FASE 3: CAPTURING — captura final
      // ═══════════════════════════════════════════
      else if (phase === 'capturing') {
        captureFramesRef.current += 1;
        lastValidResultRef.current = faceResult;

        if (captureFramesRef.current >= ANALYSIS_CONFIG.CAPTURE_FRAMES_REQUIRED) {
          updateStatus('success', '¡Rostro verificado exitosamente!');
          setProgress(100);
          stopScanning();
          onScanComplete?.(faceResult);

          if (scannerConfig.debugMode) {
            console.log('[FaceScanner] ✓ Face captured — verification complete');
          }
          return;
        } else {
          setMessage('Capturando tu rostro, mantente quieto...');
          const p = 85 + (captureFramesRef.current / ANALYSIS_CONFIG.CAPTURE_FRAMES_REQUIRED) * 15;
          setProgress(Math.min(p, 99));
        }
      }
    } catch (err) {
      console.error('[FaceScanner] Detection loop error:', err);
    }

    animationFrameRef.current = requestAnimationFrame(detectionLoop);
  }, [
    isReady,
    detect,
    scannerConfig,
    updateStatus,
    onScanComplete,
    analyzeScreenArtifacts,
    drawFaceGuide,
    checkNaturalBlink,
    extractNoseTip,
    extractIrisCenter,
    extractDepthRange,
    evaluatePassiveSignals,
    calculateLandmarkVariance,
    calculateIrisMovement,
    calculateVariance,
    status,
  ]);

  /**
   * Iniciar escaneo — genera nueva secuencia aleatoria de challenges
   */
  const startScanning = useCallback(() => {
    if (statusRef.current === 'scanning') return;

    updateStatus('scanning', 'Coloca tu rostro dentro del óvalo');
    setProgress(0);

    // Resetear estado
    phaseRef.current = 'detecting';
    stableFramesRef.current = 0;
    captureFramesRef.current = 0;
    lastValidResultRef.current = null;
    frameSamplesRef.current = [];

    // Resetear colectores de análisis pasivo
    analysisFrameCountRef.current = 0;
    livenessScoresRef.current = [];
    antispoofScoresRef.current = [];
    landmarkHistoryRef.current = [];
    depthSamplesRef.current = [];
    blinkDetectedRef.current = false;
    firstEmbeddingRef.current = null;
    lastEmbeddingRef.current = null;
    irisPositionHistoryRef.current = [];

    if (scannerConfig.debugMode) {
      console.log('[FaceScanner] Session started — passive analysis mode');
    }

    // Iniciar loop
    animationFrameRef.current = requestAnimationFrame(detectionLoop);

    // Timeout global
    if (scannerConfig.timeout > 0) {
      detectionTimeoutRef.current = setTimeout(() => {
        if (statusRef.current === 'scanning') {
          stopScanning();
          handleError(new Error('Se agotó el tiempo. Por favor, intenta de nuevo.'));
        }
      }, scannerConfig.timeout);
    }
  }, [updateStatus, detectionLoop, scannerConfig.timeout, scannerConfig.debugMode, handleError]);

  /**
   * Detener escaneo
   */
  const stopScanning = useCallback(() => {
    // Cancelar animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    // Cancelar timeout
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
      detectionTimeoutRef.current = undefined;
    }

    // Limpiar canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  /**
   * Reiniciar escaneo
   */
  const resetScanner = useCallback(() => {
    stopScanning();
    updateStatus('ready', 'Listo para escanear');
    setProgress(0);
  }, [stopScanning, updateStatus]);

  /**
   * Cleanup
   */
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  /**
   * Render
   */
  return (
    <div className={`face-scanner ${className}`} data-status={status}>
      {/* Mensaje de estado — encima del video */}
      {message && (
        <div className="face-scanner__message" data-status={status}>
          {message}
        </div>
      )}

      {/* Barra de progreso — encima del video */}
      {status === 'scanning' && (
        <div className="face-scanner__progress">
          <div
            className="face-scanner__progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="face-scanner__video-container">
        {/* Webcam */}
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            width: 1280,
            height: 720,
            facingMode: 'user',
          }}
          className="face-scanner__video"
          onUserMediaError={handleError}
        />

        {/* Overlay Canvas */}
        {scannerConfig.showOverlay && (
          <canvas ref={canvasRef} className="face-scanner__canvas" />
        )}

        {/* Loading Spinner (centrado en el video) */}
        {(status === 'initializing' || isLoading) && (
          <div className="face-scanner__overlay">
            <div className="face-scanner__spinner" />
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="face-scanner__controls">
        {status === 'ready' && (
          <button
            onClick={startScanning}
            className="face-scanner__button face-scanner__button--primary"
            disabled={!isReady}
          >
            Iniciar Escaneo
          </button>
        )}

        {status === 'scanning' && (
          <button
            onClick={stopScanning}
            className="face-scanner__button face-scanner__button--secondary"
          >
            Cancelar
          </button>
        )}

        {(status === 'success' || status === 'error') && (
          <button
            onClick={resetScanner}
            className="face-scanner__button face-scanner__button--primary"
          >
            Escanear de Nuevo
          </button>
        )}
      </div>
    </div>
  );
}

export default FaceScanner;
