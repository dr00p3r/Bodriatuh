import type { FaceVector, HumanResult, FaceDetectionResult } from '../types';

/**
 * Utilidades para procesamiento de vectores faciales
 */

/**
 * Configuración mínima para validación de vectores
 */
export const FACE_CONFIG = {
  MIN_VECTOR_LENGTH: 128,
  MIN_CONFIDENCE: 0.7,
  /**
   * Per-frame liveness floor — low enough to not block natural variation,
   * but high enough to reject obviously fake frames before they enter
   * the median aggregation pipeline.
   */
  MIN_LIVENESS: 0.08,
  /**
   * Per-frame antispoof floor — same rationale as MIN_LIVENESS.
   * Median-based evaluation in FaceScanner handles the real check.
   */
  MIN_ANTISPOOF: 0.05,
  /** Número de frames consecutivos con detección exitosa requeridos */
  MIN_CONSISTENT_FRAMES: 5,
  /** Varianza mínima de movimiento entre frames (para detectar fotos estáticas) */
  MIN_MOVEMENT_VARIANCE: 0.5,
} as const;

/**
 * Valida si un vector facial es válido
 */
export function validateFaceVector(vector: FaceVector | Float32Array): boolean {
  // Verificar que sea un array
  if (!Array.isArray(vector) && !(vector instanceof Float32Array)) {
    console.error('Face vector must be an array or Float32Array');
    return false;
  }

  // Verificar longitud mínima
  if (vector.length < FACE_CONFIG.MIN_VECTOR_LENGTH) {
    console.error(
      `Face vector must have at least ${FACE_CONFIG.MIN_VECTOR_LENGTH} dimensions, got ${vector.length}`
    );
    return false;
  }

  // Verificar que todos los valores sean números finitos
  const allFinite = Array.from(vector).every((v) => Number.isFinite(v));
  if (!allFinite) {
    console.error('Face vector contains invalid values (NaN or Infinity)');
    return false;
  }

  return true;
}

/**
 * Convierte Float32Array a número array estándar
 */
export function float32ArrayToArray(float32: Float32Array): number[] {
  return Array.from(float32);
}

/**
 * Normaliza un vector facial
 */
export function normalizeFaceVector(vector: FaceVector | Float32Array): number[] {
  const arr = Array.from(vector);
  
  // Calcular magnitud (norma L2)
  const magnitude = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude === 0) {
    return arr;
  }
  
  // Normalizar
  return arr.map((val) => val / magnitude);
}

/**
 * Calcula la similitud coseno entre dos vectores faciales
 */
export function calculateCosineSimilarity(
  vector1: FaceVector,
  vector2: FaceVector
): number {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    mag1 += vector1[i] * vector1[i];
    mag2 += vector2[i] * vector2[i];
  }

  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);

  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  return dotProduct / (mag1 * mag2);
}

/**
 * Procesa el resultado de Human y extrae información relevante
 */
export function processHumanResult(
  result: HumanResult,
  minConfidence: number = FACE_CONFIG.MIN_CONFIDENCE
): FaceDetectionResult {
  // Verificar si se detectaron rostros
  if (!result.face || result.face.length === 0) {
    return {
      detected: false,
      confidence: 0,
      message: 'No se detectó ningún rostro. Colócate frente a la cámara.',
    };
  }

  // Obtener el primer rostro (el más prominente)
  const face = result.face[0];

  // Debug log
  console.log('[FaceProcessing] Face data:', {
    score: face.score,
    live: face.live,
    real: face.real,
    hasEmbedding: !!face.embedding,
    embeddingLength: face.embedding?.length,
    boxSize: face.box,
  });

  // Verificar confianza
  if (face.score < minConfidence) {
    return {
      detected: false,
      confidence: face.score,
      message: 'Acércate un poco más y asegúrate de tener buena iluminación',
    };
  }

  // Verificar liveness (rostro real) - SOLO si está habilitado
  if (face.live !== undefined && face.live < FACE_CONFIG.MIN_LIVENESS) {
    console.warn('[FaceProcessing] Liveness check failed:', face.live);
    return {
      detected: false,
      confidence: face.score,
      message: 'Asegúrate de estar frente a la cámara en persona',
    };
  }

  // Verificar antispoof - SOLO si está habilitado
  if (face.real !== undefined && face.real < FACE_CONFIG.MIN_ANTISPOOF) {
    console.warn('[FaceProcessing] Anti-spoof check failed:', face.real);
    return {
      detected: false,
      confidence: face.score,
      message: 'No se pudo verificar que seas una persona real. Mejora la iluminación.',
    };
  }

  // Verificar que el embedding existe
  if (!face.embedding || face.embedding.length === 0) {
    console.error('[FaceProcessing] No embedding generated');
    return {
      detected: false,
      confidence: face.score,
      message: 'No se pudo procesar el rostro. Intenta de nuevo.',
    };
  }

  // Validar el embedding
  if (!validateFaceVector(face.embedding)) {
    console.error('[FaceProcessing] Invalid embedding');
    return {
      detected: false,
      confidence: face.score,
      message: 'Error al procesar el rostro. Intenta de nuevo.',
    };
  }

  // Convertir embedding a array estándar
  const vector = float32ArrayToArray(face.embedding);

  console.log('[FaceProcessing] ✅ Face detected successfully!');

  return {
    detected: true,
    confidence: face.score,
    vector,
    embedding: face.embedding,
    message: '¡Rostro detectado correctamente!',
  };
}

/**
 * Calcula la distancia euclidiana entre dos vectores
 */
export function calculateEuclideanDistance(
  vector1: FaceVector,
  vector2: FaceVector
): number {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < vector1.length; i++) {
    const diff = vector1[i] - vector2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Formatea un mensaje de error para el usuario
 */
export function formatFaceError(error: Error | unknown): string {
  if (error instanceof Error) {
    // Errores conocidos
    if (error.message.includes('permission')) {
      return 'Permiso de cámara denegado. Por favor, permite el acceso a la cámara.';
    }
    if (error.message.includes('NotFoundError')) {
      return 'No se encontró una cámara. Conecta una cámara e intenta de nuevo.';
    }
    if (error.message.includes('timeout')) {
      return 'Se agotó el tiempo de detección. Por favor, intenta de nuevo.';
    }
    
    return error.message;
  }

  return 'Ocurrió un error inesperado';
}

/**
 * Dibuja un rectángulo de detección en un canvas
 */
export function drawFaceBox(
  canvas: HTMLCanvasElement,
  box: number[],
  color: string = '#00ff00',
  lineWidth: number = 2
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || box.length < 4) return;

  const [x, y, width, height] = box;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, width, height);
}

/**
 * Dibuja información del rostro en un canvas
 */
export function drawFaceInfo(
  canvas: HTMLCanvasElement,
  result: HumanResult,
  showDetails: boolean = true
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || !result.face || result.face.length === 0) return;

  const face = result.face[0];

  // Dibujar rectángulo
  if (face.box) {
    const color = face.score > 0.8 ? '#00ff00' : face.score > 0.6 ? '#ffff00' : '#ff0000';
    drawFaceBox(canvas, face.box, color, 3);
  }

  // En modo no-debug, no mostrar info técnica al usuario
  if (!showDetails) return;

  // Solo mostrar info técnica en modo debug
  ctx.font = '13px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 2;

  const info: string[] = [
    `Score: ${(face.score * 100).toFixed(0)}%`,
  ];

  if (face.live !== undefined) {
    info.push(`Live: ${(face.live * 100).toFixed(0)}%`);
  }

  if (face.real !== undefined) {
    info.push(`Real: ${(face.real * 100).toFixed(0)}%`);
  }

  const x = 10;
  let y = canvas.height - 10 - (info.length * 18);

  info.forEach((text) => {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    y += 18;
  });
}
