# API Routes Documentation

## Base URL
`http://localhost:3000/api`

---

## 📋 Consideraciones Importantes para Frontend

### WebAuthn Integration

**Bibliotecas recomendadas:**
- `@simplewebauthn/browser` - Cliente oficial para WebAuthn
```bash
npm install @simplewebauthn/browser
```

**Flujo de uso:**
```javascript
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

// Registro
const optionsResponse = await fetch('/api/auth/register/start', { /* ... */ });
const options = await optionsResponse.json();
const attestationResponse = await startRegistration(options.options);
// Enviar attestationResponse a /api/auth/register/verify

// Login
const optionsResponse = await fetch('/api/auth/login/start', { /* ... */ });
const options = await optionsResponse.json();
const assertionResponse = await startAuthentication(options.options);
// Enviar assertionResponse a /api/auth/login/verify
```

### Face Vector Generation

**Requisitos del vector facial:**
- **Tipo:** Array de números (Float32Array o number[])
- **Longitud mínima:** 128 dimensiones (configurable con `MIN_VECTOR_LENGTH`)
- **Valores válidos:** Números finitos, no NaN, no Infinity
- **Formato:** `[0.123, 0.456, -0.789, ...]`

**Bibliotecas recomendadas para detección facial:**
- `@vladmandic/face-api` - Face detection y embeddings
- `face-api.js` - Alternativa popular
- `@mediapipe/face_mesh` - Google MediaPipe

**Ejemplo con face-api.js:**
```javascript
import * as faceapi from 'face-api.js';

// Cargar modelos
await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
await faceapi.nets.faceRecognitionNet.loadFromUri('/models');

// Capturar rostro
const video = document.querySelector('video');
const detection = await faceapi
  .detectSingleFace(video)
  .withFaceLandmarks()
  .withFaceDescriptor();

const faceVector = Array.from(detection.descriptor); // 128 dimensiones
```

### Headers y CORS

**Headers requeridos:**
```javascript
{
  'Content-Type': 'application/json',
  // Si usas cookies/sesiones:
  'credentials': 'include'
}
```

**Configuración de CORS:**
- El servidor ya está configurado para aceptar requests desde `ORIGIN` (en .env)
- Credentials están habilitados
- Métodos permitidos: GET, POST, PUT, DELETE

### Error Handling

**Estructura de errores:**
```javascript
// Error response típico
{
  "success": false,
  "error": "Mensaje de error descriptivo"
}

// En desarrollo, puede incluir:
{
  "success": false,
  "error": "Error message",
  "details": "Stack trace o detalles técnicos"
}
```

**Códigos HTTP a manejar:**
- `200` - Éxito
- `400` - Validación fallida (revisar parámetros)
- `401` - Autenticación fallida
- `404` - Recurso no encontrado
- `409` - Conflicto (e.g., rostro ya registrado)
- `423` - Cuenta bloqueada temporalmente
- `500` - Error interno del servidor

### Rate Limiting y Seguridad

**Bloqueo de cuenta:**
- **Máximo:** 5 intentos fallidos (configurable con `MAX_FAILED_ATTEMPTS`)
- **Tiempo de bloqueo:** 15 minutos (configurable con `LOCK_TIME`)
- **Error esperado:** HTTP 423 con mensaje `"Account locked. Try again in X minutes"`

**Recomendaciones:**
1. Mostrar un contador de intentos fallidos al usuario
2. Implementar un temporizador cuando la cuenta esté bloqueada
3. Ofrecer opción de "recuperación" (contactar admin)

### Data Validation

**Validaciones en frontend (antes de enviar):**

**Email:**
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  // Mostrar error
}
```

**Face Vector:**
```javascript
if (!Array.isArray(faceVector) || faceVector.length < 128) {
  // Error: vector inválido
}
if (faceVector.some(v => !Number.isFinite(v))) {
  // Error: valores inválidos
}
```

**User ID:**
```javascript
// MongoDB ObjectId: 24 caracteres hexadecimales
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
if (!objectIdRegex.test(userId)) {
  // Error: ID inválido
}
```

### State Management

**Flujo recomendado para autenticación:**

1. **Registro:**
   ```
   startRegistration → [WebAuthn Credential] → verifyRegistration → 
   [Face Capture] → completeFaceRegistration → Success
   ```

2. **Login:**
   ```
   startAuthentication → [WebAuthn Credential] → verifyAuthentication → 
   [Face Capture] → verifyFaceLogin → Success
   ```

3. **Login alternativo:**
   ```
   [Face Capture] → identifyByFace → startAuthentication → 
   verifyAuthentication → [Face Capture] → verifyFaceLogin → Success
   ```

**Guardar estado entre pasos:**
```javascript
// Ejemplo con React/localStorage
localStorage.setItem('registrationUserId', userId);
localStorage.setItem('loginUserId', userId);

// Limpiar después de completar
localStorage.removeItem('registrationUserId');
```

### WebAuthn Browser Support

**Verificar compatibilidad:**
```javascript
if (!window.PublicKeyCredential) {
  alert('Tu navegador no soporta WebAuthn');
  return;
}

// Verificar soporte de autenticación de plataforma (biometría)
const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
if (!available) {
  alert('Autenticación biométrica no disponible');
}
```

**Navegadores compatibles:**
- Chrome/Edge 67+
- Firefox 60+
- Safari 13+
- Opera 54+

### Performance Considerations

**Face detection:**
- Puede ser intensivo en CPU/GPU
- Recomendado: mostrar loading spinner
- Timeout sugerido: 10-15 segundos

**Large payloads:**
- Face vectors: ~512 bytes - 2KB
- WebAuthn responses: ~1-5 KB
- Límite del servidor: 10MB

---

## Authentication Routes (`/auth`)

### 1. Start Registration
**POST** `/api/auth/register/start`

Inicia el proceso de registro con WebAuthn.

**Request Body:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "options": { /* WebAuthn registration options */ },
  "userId": "507f1f77bcf86cd799439011"
}
```

**Error Response (400):**
```json
{
  "error": "Email and fullName are required"
}
```

---

### 2. Verify Registration
**POST** `/api/auth/register/verify`

Verifica la respuesta WebAuthn del cliente.

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "response": { /* WebAuthn registration response */ }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "verified": true,
  "userId": "507f1f77bcf86cd799439011"
}
```

**Error Responses:**
- **400:** `{ "error": "userId and response are required" }`
- **400:** `{ "error": "Verification failed" }`

---

### 3. Complete Face Registration
**POST** `/api/auth/register/face`

Completa el registro guardando el vector facial del usuario.

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "faceVector": [0.123, 0.456, 0.789, /* ... 128+ números */]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Registration completed successfully"
}
```

**Error Responses:**
- **400:** `{ "error": "userId and faceVector are required" }`
- **400:** `{ "error": "faceVector must be an array" }`
- **409:** `{ "error": "Face already registered in the system" }`

---

### 4. Start Login
**POST** `/api/auth/login/start`

Inicia el proceso de login con WebAuthn.

**Request Body (opcional):**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "options": { /* WebAuthn authentication options */ }
}
```

---

### 5. Verify Login
**POST** `/api/auth/login/verify`

Verifica la respuesta WebAuthn del cliente (primera capa de autenticación).

**Request Body:**
```json
{
  "response": { /* WebAuthn authentication response */ }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "fullName": "John Doe",
  "role": "client"
}
```

**Error Responses:**
- **400:** `{ "error": "response is required" }`
- **401:** `{ "error": "Authentication verification failed" }`
- **423:** `{ "error": "Account locked. Try again in X minutes" }`

---

### 6. Verify Face Login
**POST** `/api/auth/login/face`

Verifica el rostro del usuario como segunda capa de autenticación.

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "faceVector": [0.123, 0.456, 0.789, /* ... 128+ números */]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Authentication successful",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "client",
    "lastLogin": "2026-02-05T10:30:00.000Z"
  }
}
```

**Error Responses:**
- **400:** `{ "error": "userId and faceVector are required" }`
- **400:** `{ "error": "faceVector must be an array" }`
- **401:** `{ "error": "Face verification failed" }`

---

### 7. Identify by Face
**POST** `/api/auth/identify`

Identifica un usuario por su rostro sin necesidad de email.

**Request Body:**
```json
{
  "faceVector": [0.123, 0.456, 0.789, /* ... 128+ números */]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

**Error Responses:**
- **400:** `{ "error": "faceVector is required" }`
- **400:** `{ "error": "faceVector must be an array" }`
- **404:** `{ "success": false, "error": "User not found" }`

---

## User Management Routes (`/users`)

### 8. Get All Users
**GET** `/api/users`

Obtiene la lista de todos los usuarios activos.

**Success Response (200):**
```json
{
  "success": true,
  "count": 10,
  "users": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "fullName": "John Doe",
      "email": "john@example.com",
      "role": "client",
      "isActive": true,
      "failedLoginAttempts": 0,
      "lastLogin": "2026-02-05T10:30:00.000Z"
    }
  ]
}
```

---

### 9. Get User by ID
**GET** `/api/users/:id`

Obtiene la información de un usuario específico.

**URL Parameters:**
- `id` - MongoDB ObjectId del usuario

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "client",
    "isActive": true
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

---

### 10. Update User
**PUT** `/api/users/:id`

Actualiza la información de un usuario.

**URL Parameters:**
- `id` - MongoDB ObjectId del usuario

**Request Body:**
```json
{
  "fullName": "Jane Doe",
  "role": "admin",
  "isActive": true
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "role": "admin",
    "isActive": true
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

---

### 11. Delete User
**DELETE** `/api/users/:id`

Desactiva un usuario (soft delete).

**URL Parameters:**
- `id` - MongoDB ObjectId del usuario

**Success Response (200):**
```json
{
  "success": true,
  "message": "User deactivated successfully"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

---

### 12. Unlock User
**POST** `/api/users/:id/unlock`

Desbloquea una cuenta de usuario bloqueada por intentos fallidos.

**URL Parameters:**
- `id` - MongoDB ObjectId del usuario

**Success Response (200):**
```json
{
  "success": true,
  "message": "User unlocked successfully",
  "user": { /* ... */ }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

---

### 13. Update Face Vector
**PUT** `/api/users/:id/face`

Actualiza el vector facial de un usuario.

**URL Parameters:**
- `id` - MongoDB ObjectId del usuario

**Request Body:**
```json
{
  "faceVector": [0.123, 0.456, 0.789, /* ... 128+ números */]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Face vector updated successfully"
}
```

**Error Responses:**
- **400:** `{ "success": false, "error": "Valid user ID is required" }`
- **400:** `{ "success": false, "error": "faceVector is required and must be an array" }`
- **409:** `{ "error": "Face already registered in the system" }`

---

### 14. Get User Devices
**GET** `/api/users/:id/devices`

Obtiene la lista de dispositivos WebAuthn registrados por un usuario.

**URL Parameters:**
- `id` - MongoDB ObjectId del usuario

**Success Response (200):**
```json
{
  "success": true,
  "count": 2,
  "devices": [
    {
      "id": 0,
      "credentialID": "AbCdEfGhIj...",
      "transports": ["internal", "usb"],
      "counter": 5
    }
  ]
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

---

### 15. Remove Device
**DELETE** `/api/users/:id/devices/:credentialId`

Elimina un dispositivo WebAuthn registrado.

**URL Parameters:**
- `id` - MongoDB ObjectId del usuario
- `credentialId` - ID parcial de la credencial

**Success Response (200):**
```json
{
  "success": true,
  "message": "Device removed successfully"
}
```

**Error Responses:**
- **400:** `{ "success": false, "error": "Valid credential ID is required" }`
- **404:** `{ "success": false, "error": "User not found" }`
- **404:** `{ "success": false, "error": "Device not found" }`

---

## Health Check

### Health Status
**GET** `/health`

Verifica el estado del servidor.

**Success Response (200):**
```json
{
  "status": "OK",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "environment": "development"
}
```

---

## Error Responses

Todas las rutas pueden devolver los siguientes errores:

**500 - Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "details": "Error message (solo en development)"
}
```

**404 - Route Not Found:**
```json
{
  "success": false,
  "error": "Route not found",
  "path": "/api/invalid/path"
}
```

---

## Authentication Flow

### Complete Registration Flow:
1. `POST /api/auth/register/start` - Obtener opciones WebAuthn
2. Cliente: Ejecutar `navigator.credentials.create()`
3. `POST /api/auth/register/verify` - Verificar credencial WebAuthn
4. Cliente: Capturar rostro y generar vector facial
5. `POST /api/auth/register/face` - Completar registro con vector facial

### Complete Login Flow:
1. `POST /api/auth/login/start` - Obtener opciones WebAuthn
2. Cliente: Ejecutar `navigator.credentials.get()`
3. `POST /api/auth/login/verify` - Verificar credencial WebAuthn (1ª capa)
4. Cliente: Capturar rostro y generar vector facial
5. `POST /api/auth/login/face` - Verificar rostro (2ª capa)

### Alternative Login Flow (Face-first):
1. Cliente: Capturar rostro y generar vector facial
2. `POST /api/auth/identify` - Identificar usuario por rostro
3. `POST /api/auth/login/start` - Con email obtenido
4. Continuar con flujo normal...
