# FaceScanner Setup Guide

Guía completa para configurar y usar el componente FaceScanner con Human.js.

## 📦 Instalación de Modelos

Los modelos de Human.js son necesarios para el reconocimiento facial. Hay dos opciones:

### Opción 1: Usar CDN (Recomendado para desarrollo)

Los modelos se cargarán automáticamente desde el CDN de jsDelivr. No necesitas descargar nada.

```typescript
// Ya configurado en useHuman.ts
modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
```

### Opción 2: Usar Modelos Locales (Recomendado para producción)

**1. Descargar modelos:**

```bash
# Opción A: Descargar manualmente desde GitHub
# https://github.com/vladmandic/human/tree/main/models

# Opción B: Usar curl para descargar los modelos necesarios
cd public/models

# Face Detection
curl -O https://cdn.jsdelivr.net/npm/@vladmandic/human/models/blazeface.json
curl -O https://cdn.jsdelivr.net/npm/@vladmandic/human/models/blazeface-front.bin

# Face Landmarks
curl -O https://cdn.jsdelivr.net/npm/@vladmandic/human/models/facemesh.json
curl -O https://cdn.jsdelivr.net/npm/@vladmandic/human/models/facemesh.bin

# Face Embedding/Recognition
curl -O https://cdn.jsdelivr.net/npm/@vladmandic/human/models/faceres.json
curl -O https://cdn.jsdelivr.net/npm/@vladmandic/human/models/faceres.bin
```

**2. Actualizar configuración en `useHuman.ts`:**

```typescript
modelBasePath: '/models', // En lugar del CDN
```

## 🎯 Uso del Componente

### Ejemplo Básico

```typescript
import { FaceScanner } from '@/components/biometrics/FaceScanner';

function RegisterPage() {
  const handleFaceCapture = (vector: number[]) => {
    console.log('Vector facial capturado:', vector);
    // Enviar al backend
  };

  const handleError = (error: string) => {
    console.error('Error:', error);
  };

  return (
    <FaceScanner
      onFaceDetected={handleFaceCapture}
      onError={handleError}
      autoCapture={true}
    />
  );
}
```

### Props Disponibles

```typescript
interface FaceScannerProps {
  onFaceDetected: (faceVector: number[]) => void;  // Callback cuando se captura un rostro
  onError?: (error: string) => void;                // Callback de errores
  autoCapture?: boolean;                            // Captura automática (default: false)
  captureDelay?: number;                            // Delay antes de capturar (default: 2000ms)
  minConfidence?: number;                           // Confianza mínima (default: 0.7)
  showOverlay?: boolean;                            // Mostrar overlay visual (default: true)
  className?: string;                               // Clases CSS personalizadas
}
```

### Ejemplos Avanzados

#### Registro de Usuario

```typescript
import { useState } from 'react';
import { FaceScanner } from '@/components/biometrics/FaceScanner';
import { authService } from '@/api';

function RegisterWithFace() {
  const [userId, setUserId] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFaceCapture = async (vector: number[]) => {
    try {
      await authService.completeFaceRegistration({
        userId,
        faceVector: vector
      });
      alert('¡Registro completado!');
    } catch (err) {
      setError('Error al registrar el rostro');
    }
  };

  return (
    <div>
      <h2>Escanea tu rostro</h2>
      {scanning && (
        <FaceScanner
          onFaceDetected={handleFaceCapture}
          onError={setError}
          autoCapture={true}
          captureDelay={2000}
          minConfidence={0.8}
        />
      )}
      {error && <p className="error">{error}</p>}
      <button onClick={() => setScanning(!scanning)}>
        {scanning ? 'Detener' : 'Iniciar Escaneo'}
      </button>
    </div>
  );
}
```

#### Login con Identificación Facial

```typescript
import { FaceScanner } from '@/components/biometrics/FaceScanner';
import { authService } from '@/api';

function LoginByFace() {
  const [step, setStep] = useState<'identify' | 'verify'>('identify');
  const [userId, setUserId] = useState<string>('');

  const handleIdentifyFace = async (vector: number[]) => {
    try {
      // Primera captura: identificar usuario
      const result = await authService.identifyByFace({ faceVector: vector });
      setUserId(result.user.id);
      setStep('verify');
    } catch (err) {
      alert('No se pudo identificar el usuario');
    }
  };

  const handleVerifyFace = async (vector: number[]) => {
    try {
      // Segunda captura: verificar identidad
      const result = await authService.verifyFaceLogin({
        userId,
        faceVector: vector
      });
      console.log('Login exitoso:', result.user);
    } catch (err) {
      alert('Verificación facial fallida');
    }
  };

  return (
    <div>
      {step === 'identify' && (
        <>
          <h2>Identificación Facial</h2>
          <p>Mira a la cámara para identificarte</p>
          <FaceScanner
            onFaceDetected={handleIdentifyFace}
            autoCapture={true}
            minConfidence={0.75}
          />
        </>
      )}
      
      {step === 'verify' && (
        <>
          <h2>Verificación de Identidad</h2>
          <p>Vuelve a mirar a la cámara para confirmar</p>
          <FaceScanner
            onFaceDetected={handleVerifyFace}
            autoCapture={true}
            minConfidence={0.8}
          />
        </>
      )}
    </div>
  );
}
```

#### Captura Manual

```typescript
import { useRef } from 'react';
import { FaceScanner, FaceScannerRef } from '@/components/biometrics/FaceScanner';

function ManualCapture() {
  const scannerRef = useRef<FaceScannerRef>(null);

  const handleManualCapture = () => {
    scannerRef.current?.capture();
  };

  const handleFaceDetected = (vector: number[]) => {
    console.log('Vector capturado:', vector.length, 'dimensiones');
  };

  return (
    <div>
      <FaceScanner
        ref={scannerRef}
        onFaceDetected={handleFaceDetected}
        autoCapture={false}
      />
      <button onClick={handleManualCapture}>
        Capturar Rostro
      </button>
    </div>
  );
}
```

## 🎨 Personalización de Estilos

### CSS Personalizado

```css
/* Personalizar el contenedor */
.face-scanner-container {
  max-width: 640px;
  margin: 0 auto;
  border-radius: 12px;
  overflow: hidden;
}

/* Personalizar el video */
.face-scanner-container video {
  filter: brightness(1.1);
}

/* Personalizar el overlay */
.face-scanner-container canvas {
  opacity: 0.8;
}
```

### Usando className

```typescript
<FaceScanner
  className="my-custom-scanner"
  onFaceDetected={handleFace}
/>
```

## 🔧 Configuración de Human

Para ajustar la configuración de Human, edita `src/hooks/useHuman.ts`:

```typescript
const humanConfig: Partial<Config> = {
  // Rendimiento
  backend: 'webgl',           // 'webgl' | 'wasm' | 'cpu'
  
  // Face Detection
  face: {
    enabled: true,
    detector: {
      rotation: false,        // Detección con rotación (más lento)
    },
    mesh: {
      enabled: true,          // Landmarks faciales
    },
    iris: {
      enabled: false,         // Detección de iris (opcional)
    },
    description: {
      enabled: true,          // Embeddings faciales (REQUERIDO)
    },
    emotion: {
      enabled: false,         // Detección de emociones (opcional)
    },
  },
  
  // Modelos
  modelBasePath: '/models',
  
  // Filtros
  filter: {
    enabled: true,
    equalization: false,
    flip: false,
  },
};
```

## 📊 Validación del Vector Facial

El componente incluye validación automática, pero puedes usar la utilidad:

```typescript
import { validateFaceVector, normalizeFaceVector } from '@/utils/faceVector';

const vector = [/* ... */];

// Validar
const isValid = validateFaceVector(vector);

// Normalizar (recomendado antes de enviar al backend)
const normalized = normalizeFaceVector(vector);
```

## 🚨 Manejo de Errores Comunes

### Error: "Camera not available"
```typescript
// El usuario debe dar permiso a la cámara
// Mostrar instrucciones al usuario sobre cómo habilitar la cámara
```

### Error: "No face detected"
```typescript
// Ajustar minConfidence
<FaceScanner minConfidence={0.6} />

// O aumentar captureDelay
<FaceScanner captureDelay={3000} />
```

### Error: "Models not loaded"
```typescript
// Verificar que los modelos estén disponibles
// Si usas local: verificar public/models/
// Si usas CDN: verificar conexión a internet
```

### Error: "Invalid face vector"
```typescript
// Verificar que faceDescriptorLength sea 128+ en configuración
// O capturar nuevamente con mejor iluminación
```

## 🎯 Mejores Prácticas

### 1. Iluminación
- **Buena iluminación frontal** mejora la precisión
- Evitar contraluz fuerte
- Luz natural o artificial suave y uniforme

### 2. Posición del Rostro
- **Rostro centrado** en la cámara
- **Distancia**: 30-60 cm de la cámara
- **Ángulo**: frontal, sin inclinación excesiva

### 3. Captura de Vector
- **Múltiples capturas**: capturar 2-3 vectores y promediar
- **Validación**: siempre validar el vector antes de enviar
- **Normalización**: normalizar el vector para mejor comparación

### 4. UX
- **Feedback visual**: usar el overlay para guiar al usuario
- **Instrucciones claras**: indicar qué hacer
- **Progreso**: mostrar estado de carga de modelos

### 5. Performance
- **Lazy loading**: cargar Human solo cuando se necesite
- **Cleanup**: siempre limpiar recursos (cámara, canvas)
- **Throttling**: evitar detecciones demasiado frecuentes

## 🔐 Seguridad y Privacidad

### Recomendaciones

1. **No almacenar imágenes**: solo enviar vectores faciales
2. **HTTPS**: siempre usar HTTPS en producción
3. **Permisos**: solicitar permisos de cámara de forma clara
4. **Privacidad**: informar al usuario sobre el uso de biometría

### Ejemplo de Solicitud de Permisos

```typescript
async function requestCameraPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.error('Camera permission denied');
    return false;
  }
}

// Usar antes de mostrar FaceScanner
const hasPermission = await requestCameraPermission();
if (hasPermission) {
  // Mostrar FaceScanner
}
```

## 📱 Compatibilidad

### Navegadores Soportados
- ✅ Chrome 90+
- ✅ Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14.1+
- ✅ Mobile Chrome/Safari

### Requisitos
- WebGL o WebAssembly support
- getUserMedia API (cámara)
- ES2020+ support

### Verificar Soporte

```typescript
function checkBrowserSupport() {
  const hasWebGL = !!document.createElement('canvas').getContext('webgl2');
  const hasCamera = !!navigator.mediaDevices?.getUserMedia;
  const hasWasm = typeof WebAssembly !== 'undefined';
  
  return hasWebGL && hasCamera && hasWasm;
}

if (!checkBrowserSupport()) {
  alert('Tu navegador no es compatible con el reconocimiento facial');
}
```

## 🐛 Debugging

### Modo Debug

Activa logs detallados en `useHuman.ts`:

```typescript
const humanConfig: Partial<Config> = {
  debug: true,  // Activar logs
  // ...
};
```

### Verificar Estado

```typescript
import { useHuman } from '@/hooks/useHuman';

function DebugPanel() {
  const { human, isLoading, error } = useHuman();
  
  return (
    <div>
      <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
      <p>Error: {error || 'None'}</p>
      <p>Human loaded: {human ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

## 📚 Recursos Adicionales

- [Human.js Documentation](https://github.com/vladmandic/human)
- [Human.js Demo](https://vladmandic.github.io/human/demo/index.html)
- [WebAuthn Guide](https://webauthn.guide/)
- [API Documentation](./ROUTES.md)

## 🆘 Soporte

Si encuentras problemas:
1. Verifica la consola del navegador
2. Revisa que los modelos estén cargados
3. Confirma permisos de cámara
4. Prueba con mejor iluminación
5. Ajusta minConfidence y captureDelay
