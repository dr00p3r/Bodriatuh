# FaceScanner Component - Guía de Uso

Componente completo para detección y captura facial usando Human library con IA.

## 🎯 Características

- ✅ **Detección facial en tiempo real** con Human AI library
- ✅ **Validación de liveness** - Detecta si es un rostro real vs foto/pantalla
- ✅ **Anti-spoofing** - Previene ataques con imágenes
- ✅ **Generación de vector facial** (embedding de 128+ dimensiones)
- ✅ **Overlay visual** con información en tiempo real
- ✅ **Manejo robusto de errores**
- ✅ **Responsive** y accesible
- ✅ **TypeScript** con tipos completos

## 📦 Instalación de Modelos

Los modelos de Human deben estar en la carpeta `public/models/`. Descárgalos así:

```bash
# Opción 1: Copiar desde node_modules
mkdir -p public/models
cp -r node_modules/@vladmandic/human/models/* public/models/

# Opción 2: Descargar manualmente
# Visita: https://github.com/vladmandic/human/tree/main/models
```

## 🚀 Uso Básico

```tsx
import { FaceScanner } from '@/components/biometrics';
import type { FaceDetectionResult } from '@/types';

function MyComponent() {
  const handleScanComplete = (result: FaceDetectionResult) => {
    if (result.detected && result.vector) {
      console.log('Face vector:', result.vector);
      console.log('Confidence:', result.confidence);
      
      // Enviar al backend
      sendToBackend(result.vector);
    }
  };

  const handleError = (error: Error) => {
    console.error('Face scan error:', error);
    alert(error.message);
  };

  return (
    <FaceScanner
      onScanComplete={handleScanComplete}
      onError={handleError}
    />
  );
}
```

## ⚙️ Configuración Avanzada

```tsx
import { FaceScanner } from '@/components/biometrics';

function AdvancedExample() {
  return (
    <FaceScanner
      config={{
        minConfidence: 0.7,      // Confianza mínima (0-1)
        vectorLength: 128,        // Longitud del vector
        timeout: 20000,           // Timeout en ms
        autoStart: true,          // Iniciar automáticamente
        showOverlay: true,        // Mostrar overlay visual
        debugMode: true,          // Modo debug (logs extra)
      }}
      onScanComplete={(result) => {
        console.log('Scan complete:', result);
      }}
      onError={(error) => {
        console.error('Error:', error);
      }}
      onStatusChange={(status) => {
        console.log('Status changed:', status);
      }}
      className="my-custom-scanner"
    />
  );
}
```

## 📊 Props del Componente

### `config?: FaceScannerConfig`

```typescript
{
  minConfidence?: number;    // Default: 0.6 (60%)
  vectorLength?: number;     // Default: 128
  timeout?: number;          // Default: 15000ms (15s)
  autoStart?: boolean;       // Default: false
  showOverlay?: boolean;     // Default: true
  debugMode?: boolean;       // Default: false
}
```

### `onScanComplete?: (result: FaceDetectionResult) => void`

Callback ejecutado cuando se captura exitosamente un rostro.

```typescript
interface FaceDetectionResult {
  detected: boolean;       // Si se detectó un rostro
  confidence: number;      // Confianza (0-1)
  vector?: number[];       // Vector facial (128+ dims)
  embedding?: Float32Array; // Embedding raw
  message?: string;        // Mensaje descriptivo
}
```

### `onError?: (error: Error) => void`

Callback ejecutado cuando ocurre un error.

### `onStatusChange?: (status: FaceScannerStatus) => void`

Callback ejecutado cuando cambia el estado del escáner.

Estados posibles:
- `'idle'` - No iniciado
- `'initializing'` - Cargando modelos
- `'ready'` - Listo para escanear
- `'scanning'` - Escaneando rostro
- `'processing'` - Procesando datos
- `'success'` - Escaneo exitoso
- `'error'` - Error en el escaneo

## 🔧 Utilidades

### Validar Vector Facial

```typescript
import { validateFaceVector } from '@/utils';

const vector = [0.123, 0.456, ...]; // 128+ números

if (validateFaceVector(vector)) {
  console.log('Vector válido');
} else {
  console.error('Vector inválido');
}
```

### Calcular Similitud entre Rostros

```typescript
import { calculateCosineSimilarity } from '@/utils';

const similarity = calculateCosineSimilarity(vector1, vector2);
console.log('Similarity:', similarity); // 0-1 (1 = idéntico)

// Threshold recomendado: 0.6-0.7
if (similarity > 0.7) {
  console.log('Mismo rostro!');
}
```

### Normalizar Vector

```typescript
import { normalizeFaceVector } from '@/utils';

const normalizedVector = normalizeFaceVector(rawVector);
```

## 🎨 Personalización de Estilos

El componente usa CSS modules. Puedes sobrescribir los estilos:

```css
/* Tu CSS personalizado */
.my-custom-scanner {
  max-width: 800px;
}

.my-custom-scanner .face-scanner__video-container {
  border-radius: 20px;
  border: 4px solid #3b82f6;
}

.my-custom-scanner .face-scanner__button--primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
}
```

## 🔄 Integración con Autenticación

### Registro Completo

```tsx
import { FaceScanner } from '@/components/biometrics';
import { authService } from '@/api';
import { startRegistration } from '@simplewebauthn/browser';

function RegisterPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<'webauthn' | 'face'>('webauthn');

  const handleWebAuthn = async () => {
    // 1. Iniciar registro
    const startData = await authService.startRegistration({
      email: 'user@example.com',
      fullName: 'John Doe',
    });

    // 2. Ejecutar WebAuthn
    const credential = await startRegistration(startData.options);

    // 3. Verificar credencial
    await authService.verifyRegistration({
      userId: startData.userId,
      response: credential,
    });

    // 4. Guardar userId y pasar a captura facial
    setUserId(startData.userId);
    setStep('face');
  };

  const handleFaceScan = async (result: FaceDetectionResult) => {
    if (!userId || !result.vector) return;

    // 5. Completar registro con vector facial
    await authService.completeFaceRegistration({
      userId,
      faceVector: result.vector,
    });

    alert('Registro completo!');
  };

  return (
    <div>
      {step === 'webauthn' && (
        <button onClick={handleWebAuthn}>
          Registrar con WebAuthn
        </button>
      )}

      {step === 'face' && (
        <div>
          <h2>Captura tu rostro</h2>
          <FaceScanner
            config={{ autoStart: true }}
            onScanComplete={handleFaceScan}
          />
        </div>
      )}
    </div>
  );
}
```

### Login Completo

```tsx
import { FaceScanner } from '@/components/biometrics';
import { authService } from '@/api';
import { startAuthentication } from '@simplewebauthn/browser';

function LoginPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<'webauthn' | 'face'>('webauthn');

  const handleWebAuthn = async () => {
    // 1. Iniciar login
    const startData = await authService.startLogin({
      email: 'user@example.com',
    });

    // 2. Ejecutar WebAuthn
    const assertion = await startAuthentication(startData.options);

    // 3. Verificar credencial (primera capa)
    const verifyData = await authService.verifyLogin({
      response: assertion,
    });

    // 4. Guardar userId y pasar a captura facial
    setUserId(verifyData.userId);
    setStep('face');
  };

  const handleFaceScan = async (result: FaceDetectionResult) => {
    if (!userId || !result.vector) return;

    // 5. Verificar rostro (segunda capa)
    const loginResult = await authService.verifyFaceLogin({
      userId,
      faceVector: result.vector,
    });

    console.log('Usuario autenticado:', loginResult.user);
    alert('Login exitoso!');
  };

  return (
    <div>
      {step === 'webauthn' && (
        <button onClick={handleWebAuthn}>
          Login con WebAuthn
        </button>
      )}

      {step === 'face' && (
        <div>
          <h2>Verifica tu rostro</h2>
          <FaceScanner
            config={{ autoStart: true }}
            onScanComplete={handleFaceScan}
          />
        </div>
      )}
    </div>
  );
}
```

### Login Alternativo (Face-First)

```tsx
import { FaceScanner } from '@/components/biometrics';
import { authService } from '@/api';

function FaceFirstLogin() {
  const handleFaceScan = async (result: FaceDetectionResult) => {
    if (!result.vector) return;

    try {
      // 1. Identificar usuario por rostro
      const identifyData = await authService.identifyByFace({
        faceVector: result.vector,
      });

      console.log('Usuario identificado:', identifyData.user);
      
      // 2. Continuar con flujo WebAuthn normal usando el email
      // ... (como en el ejemplo anterior)
    } catch (error) {
      alert('No se pudo identificar el rostro');
    }
  };

  return (
    <div>
      <h2>Login con tu rostro</h2>
      <FaceScanner
        config={{ autoStart: true, minConfidence: 0.7 }}
        onScanComplete={handleFaceScan}
      />
    </div>
  );
}
```

## 🛡️ Mejores Prácticas

### 1. Manejo de Errores

```tsx
const handleError = (error: Error) => {
  // Errores de permisos de cámara
  if (error.message.includes('permission')) {
    alert('Por favor, permite el acceso a la cámara');
    return;
  }

  // Timeout
  if (error.message.includes('timeout')) {
    alert('Tiempo agotado. Intenta de nuevo');
    return;
  }

  // Error genérico
  alert(`Error: ${error.message}`);
};
```

### 2. Feedback Visual

```tsx
const [status, setStatus] = useState<string>('');

<FaceScanner
  onStatusChange={(status) => {
    const messages = {
      initializing: 'Cargando modelos de IA...',
      ready: 'Listo para escanear',
      scanning: 'Posiciona tu rostro en el marco',
      success: 'Rostro capturado correctamente',
      error: 'Error al capturar rostro',
    };
    setStatus(messages[status] || status);
  }}
/>

<p>{status}</p>
```

### 3. Loading States

```tsx
const [isProcessing, setIsProcessing] = useState(false);

const handleScanComplete = async (result: FaceDetectionResult) => {
  setIsProcessing(true);
  
  try {
    await authService.completeFaceRegistration({
      userId: currentUserId,
      faceVector: result.vector!,
    });
  } finally {
    setIsProcessing(false);
  }
};

{isProcessing && <Spinner />}
```

## 🐛 Troubleshooting

### Modelos no cargan

**Error:** `Failed to load models`

**Solución:** Verifica que los modelos estén en `public/models/`:
```bash
ls -la public/models/
# Debe mostrar: face/*, body/*, hand/*, etc.
```

### Cámara no funciona

**Error:** `NotFoundError` o `NotAllowedError`

**Solución:**
- Verifica permisos de cámara en el navegador
- Usa HTTPS (localhost funciona con HTTP)
- Verifica que la cámara no esté en uso por otra app

### Detección muy lenta

**Solución:**
- Reduce la resolución del video en `videoConstraints`
- Desactiva features no necesarios en config de Human
- Usa backend WebGL (GPU)

### Confianza muy baja

**Solución:**
- Mejora la iluminación
- Centra el rostro en el marco
- Evita obstrucciones (lentes de sol, mascarilla)
- Ajusta `minConfidence` a un valor más bajo (no recomendado < 0.5)

## 📚 Referencias

- [Human Library Docs](https://github.com/vladmandic/human)
- [WebAuthn Guide](https://webauthn.guide/)
- [Face Recognition Best Practices](https://developers.google.com/ml-kit/vision/face-detection)

## 🎓 Estructura del Código

```
src/
├── components/
│   └── biometrics/
│       ├── FaceScanner.tsx      # Componente principal
│       ├── FaceScanner.css      # Estilos
│       └── index.ts             # Exports
├── hooks/
│   ├── useHuman.ts              # Hook para Human library
│   └── index.ts
├── utils/
│   ├── faceProcessing.ts        # Utilidades de procesamiento
│   └── index.ts
└── types/
    ├── face.types.ts            # Tipos de detección facial
    └── index.ts
```
