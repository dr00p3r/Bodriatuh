import type { FaceVector } from './api.types';

/**
 * Tipos para el componente FaceScanner y detección facial
 */

// Estado del escáner facial
export type FaceScannerStatus = 
  | 'idle'           // No iniciado
  | 'initializing'   // Cargando modelos
  | 'ready'          // Listo para escanear
  | 'scanning'       // Escaneando rostro
  | 'processing'     // Procesando datos
  | 'success'        // Escaneo exitoso
  | 'error';         // Error en el escaneo

// Resultado de detección facial
export interface FaceDetectionResult {
  detected: boolean;
  confidence: number;
  vector?: FaceVector;
  embedding?: Float32Array;
  message?: string;
}

// Configuración del escáner
export interface FaceScannerConfig {
  minConfidence?: number;      // Confianza mínima (0-1), default: 0.6
  vectorLength?: number;        // Longitud del vector (default: 128)
  timeout?: number;             // Timeout en ms (default: 15000)
  autoStart?: boolean;          // Iniciar automáticamente (default: false)
  showOverlay?: boolean;        // Mostrar overlay visual (default: true)
  debugMode?: boolean;          // Modo debug (default: false)
}

// Props del componente FaceScanner
export interface FaceScannerProps {
  config?: FaceScannerConfig;
  onScanComplete?: (result: FaceDetectionResult) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: FaceScannerStatus) => void;
  className?: string;
}

// Configuración de Human
export interface HumanConfig {
  backend: 'webgl' | 'wasm' | 'cpu';
  modelBasePath: string;
  face: {
    enabled: boolean;
    detector: {
      enabled: boolean;
      rotation: boolean;
      maxDetected?: number;
      minConfidence?: number;
    };
    mesh: {
      enabled: boolean;
    };
    description: {
      enabled: boolean;
      minConfidence?: number;
    };
    iris: {
      enabled: boolean;
    };
    emotion: {
      enabled: boolean;
    };
    antispoof: {
      enabled: boolean;
    };
    liveness: {
      enabled: boolean;
    };
  };
  body: {
    enabled: boolean;
  };
  hand: {
    enabled: boolean;
  };
  object: {
    enabled: boolean;
  };
  gesture: {
    enabled: boolean;
  };
}

// Resultado de Human
export interface HumanResult {
  face: Array<{
    score: number;
    box: number[];
    boxRaw: number[];
    embedding: Float32Array;
    distance: number;
    real: number;
    live: number;
    age: number;
    gender: string;
    genderScore: number;
    emotion: Array<{ score: number; emotion: string }>;
    rotation?: {
      angle: { roll: number; yaw: number; pitch: number };
      matrix: number[];
      gaze: { bearing: number; strength: number };
    } | null;
    annotations?: Record<string, Array<[number, number, number?]>>;
    mesh?: Array<[number, number, number?]>;
  }>;
  gesture: Array<{
    face?: number;
    iris?: number;
    body?: number;
    hand?: number;
    gesture: string;
  }>;
  performance: {
    total: number;
  };
}
