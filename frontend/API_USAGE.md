# API y Axios - Guía de Uso

Esta guía explica cómo usar los servicios API configurados en el proyecto.

## 📁 Estructura

```
src/
├── api/
│   ├── axios.config.ts    # Configuración de Axios
│   ├── auth.service.ts    # Servicio de autenticación
│   ├── user.service.ts    # Servicio de gestión de usuarios
│   └── index.ts           # Exports centralizados
└── types/
    ├── api.types.ts       # Tipos base de API
    ├── auth.types.ts      # Tipos de autenticación
    ├── user.types.ts      # Tipos de usuarios
    └── index.ts           # Exports centralizados
```

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_API_URL=http://localhost:3000/api
```

## 📚 Uso de los Servicios

### 1. Autenticación - Registro Completo

```typescript
import { authService } from '@/api';
import { startRegistration } from '@simplewebauthn/browser';

// 1. Iniciar registro
const startRegistrationData = await authService.startRegistration({
  email: 'user@example.com',
  fullName: 'John Doe'
});

// 2. Ejecutar WebAuthn en el navegador
const credential = await startRegistration(startRegistrationData.options);

// 3. Verificar credencial WebAuthn
const verifyData = await authService.verifyRegistration({
  userId: startRegistrationData.userId,
  response: credential
});

// 4. Capturar rostro y completar registro
const faceVector = await captureFaceVector(); // Tu función de captura
await authService.completeFaceRegistration({
  userId: startRegistrationData.userId,
  faceVector: faceVector
});
```

### 2. Autenticación - Login Completo

```typescript
import { authService } from '@/api';
import { startAuthentication } from '@simplewebauthn/browser';

// 1. Iniciar login
const startLoginData = await authService.startLogin({
  email: 'user@example.com' // Opcional
});

// 2. Ejecutar WebAuthn en el navegador
const assertion = await startAuthentication(startLoginData.options);

// 3. Verificar credencial WebAuthn (primera capa)
const verifyData = await authService.verifyLogin({
  response: assertion
});

// 4. Capturar rostro y verificar (segunda capa)
const faceVector = await captureFaceVector();
const loginResult = await authService.verifyFaceLogin({
  userId: verifyData.userId,
  faceVector: faceVector
});

console.log('Usuario autenticado:', loginResult.user);
```

### 3. Login Alternativo - Identificación por Rostro

```typescript
import { authService } from '@/api';

// 1. Capturar rostro primero
const faceVector = await captureFaceVector();

// 2. Identificar usuario
const identifyData = await authService.identifyByFace({
  faceVector: faceVector
});

console.log('Usuario identificado:', identifyData.user);

// 3. Continuar con el flujo de login normal usando el email
// ... (como en el ejemplo anterior)
```

### 4. Gestión de Usuarios

```typescript
import { userService } from '@/api';

// Listar todos los usuarios
const usersData = await userService.getAllUsers();
console.log(`Total usuarios: ${usersData.count}`);

// Obtener un usuario específico
const userData = await userService.getUserById('507f1f77bcf86cd799439011');
console.log(userData.user);

// Actualizar usuario
const updatedUser = await userService.updateUser('507f1f77bcf86cd799439011', {
  fullName: 'Jane Doe',
  role: 'admin'
});

// Desbloquear cuenta
await userService.unlockUser('507f1f77bcf86cd799439011');

// Actualizar vector facial
const newFaceVector = await captureFaceVector();
await userService.updateFaceVector('507f1f77bcf86cd799439011', {
  faceVector: newFaceVector
});

// Obtener dispositivos del usuario
const devicesData = await userService.getUserDevices('507f1f77bcf86cd799439011');
console.log(`Dispositivos: ${devicesData.count}`);

// Eliminar dispositivo
await userService.removeDevice('507f1f77bcf86cd799439011', 'credentialId123');

// Desactivar usuario
await userService.deleteUser('507f1f77bcf86cd799439011');
```

## 🛡️ Manejo de Errores

### Opción 1: Try-Catch Individual

```typescript
import { authService, getErrorMessage, isAccountLockedError } from '@/api';

try {
  const result = await authService.startRegistration({
    email: 'user@example.com',
    fullName: 'John Doe'
  });
  console.log(result);
} catch (error) {
  const errorMsg = getErrorMessage(error);
  
  if (isAccountLockedError(error)) {
    alert('Tu cuenta está bloqueada. Intenta más tarde.');
  } else {
    alert(`Error: ${errorMsg}`);
  }
}
```

### Opción 2: Hook de React para Manejo de Errores

```typescript
// src/hooks/useApiRequest.ts
import { useState } from 'react';
import { getErrorMessage } from '@/api';

export function useApiRequest<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async (apiCall: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiCall();
      return result;
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading, error };
}

// Uso en componente
function MyComponent() {
  const { execute, loading, error } = useApiRequest();

  const handleRegister = async () => {
    const result = await execute(() => 
      authService.startRegistration({
        email: 'user@example.com',
        fullName: 'John Doe'
      })
    );

    if (result) {
      console.log('Success:', result);
    }
  };

  return (
    <div>
      {loading && <p>Cargando...</p>}
      {error && <p>Error: {error}</p>}
      <button onClick={handleRegister}>Registrar</button>
    </div>
  );
}
```

## 🎯 Validaciones Recomendadas

### Validar Email

```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailRegex.test(email)) {
  throw new Error('Email inválido');
}
```

### Validar Face Vector

```typescript
function validateFaceVector(vector: number[]): boolean {
  // Verificar que sea un array
  if (!Array.isArray(vector)) return false;
  
  // Verificar longitud mínima (128 dimensiones)
  if (vector.length < 128) return false;
  
  // Verificar que todos los valores sean números finitos
  return vector.every(v => Number.isFinite(v));
}

const faceVector = await captureFaceVector();
if (!validateFaceVector(faceVector)) {
  throw new Error('Vector facial inválido');
}
```

### Validar User ID (MongoDB ObjectId)

```typescript
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

if (!objectIdRegex.test(userId)) {
  throw new Error('User ID inválido');
}
```

## 🔄 Interceptores de Axios

Los interceptores están configurados en `axios.config.ts` y se ejecutan automáticamente:

### Request Interceptor
- Añade headers automáticamente
- Puedes descomentar la sección de tokens si usas JWT

### Response Interceptor
- Maneja errores de forma centralizada
- Loggea errores en consola
- Puedes personalizar el comportamiento para cada código HTTP

```typescript
// Ejemplo: redirigir al login en error 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## 📝 TypeScript Types

Todos los tipos están exportados desde `src/types/index.ts`:

```typescript
import type { 
  User, 
  UserRole, 
  FaceVector,
  StartRegistrationRequest,
  VerifyLoginResponse,
  GetAllUsersResponse,
  // ... más tipos
} from '@/types';
```

## 🚀 Ejemplo Completo en un Componente

```typescript
import { useState } from 'react';
import { authService, getErrorMessage } from '@/api';
import { startRegistration } from '@simplewebauthn/browser';
import type { User } from '@/types';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const handleRegister = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Iniciar registro
      const startData = await authService.startRegistration({
        email,
        fullName
      });

      // 2. WebAuthn
      const credential = await startRegistration(startData.options);

      // 3. Verificar credencial
      await authService.verifyRegistration({
        userId: startData.userId,
        response: credential
      });

      // 4. Capturar rostro
      const faceVector = await captureFaceVector(); // Tu implementación

      // 5. Completar registro
      await authService.completeFaceRegistration({
        userId: startData.userId,
        faceVector
      });

      alert('Registro exitoso!');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Registro</h1>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Nombre completo"
      />
      <button onClick={handleRegister} disabled={loading}>
        {loading ? 'Registrando...' : 'Registrar'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

## 🔐 Seguridad

- ✅ CORS está configurado en el backend
- ✅ Credentials (cookies) están habilitadas
- ✅ Timeout de 15 segundos configurado
- ✅ Manejo centralizado de errores
- ✅ Validaciones de tipos con TypeScript

## 📦 Siguiente Paso

Implementa la función `captureFaceVector()` usando `@vladmandic/face-api` según las instrucciones en [ROUTES.md](ROUTES.md).
