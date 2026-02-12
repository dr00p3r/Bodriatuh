# RegisterPage - Documentación

Componente completo de registro de usuarios con autenticación biométrica y reconocimiento facial.

## 🎯 Características

- ✅ **Flujo de 4 pasos** con indicador visual de progreso
- ✅ **Validación de formulario** en tiempo real
- ✅ **Integración WebAuthn** para autenticación biométrica del dispositivo
- ✅ **Captura facial** con FaceScanner
- ✅ **Manejo de errores** robusto y específico
- ✅ **UX/UI profesional** con animaciones y feedback visual
- ✅ **Responsive design** para móviles y escritorio
- ✅ **TypeScript completo** con tipos estrictos

## 📋 Flujo de Registro

### Paso 1: Información Personal
- Usuario ingresa email y nombre completo
- Validación en tiempo real del formato de email
- Botón deshabilitado si el formulario no es válido

### Paso 2: Autenticación Biométrica (WebAuthn)
- Se solicita al usuario verificar su identidad con huella, Face ID o PIN
- Se crea una credencial WebAuthn en el dispositivo
- La credencial se verifica en el backend

### Paso 3: Captura Facial
- Se activa la cámara con el componente FaceScanner
- Captura automática después de 2 segundos de detectar un rostro
- Validación del vector facial (128+ dimensiones)

### Paso 4: Registro Completo
- Muestra confirmación visual de éxito
- Información del usuario registrado
- Opciones para ir al login o registrar otro usuario

## 🚀 Uso Básico

### Integración Simple

```tsx
import { RegisterPage } from '@/pages/auth/RegisterPage';

function App() {
  return <RegisterPage />;
}
```

### Con React Router

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RegisterPage } from '@/pages/auth/RegisterPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        {/* otras rutas */}
      </Routes>
    </BrowserRouter>
  );
}
```

## 🔧 Personalización

### Modificar Configuración de FaceScanner

En [RegisterPage.tsx](RegisterPage.tsx), línea ~200:

```tsx
<FaceScanner
  onFaceDetected={handleFaceCapture}
  onError={handleFaceError}
  autoCapture={true}
  captureDelay={2000}        // Cambiar delay antes de captura
  minConfidence={0.75}       // Ajustar confianza mínima (0-1)
  showOverlay={true}
/>
```

### Personalizar Estilos

Edita [RegisterPage.css](RegisterPage.css) para cambiar:
- Colores del gradiente de fondo
- Tamaño y estilo del contenedor
- Animaciones
- Responsive breakpoints

```css
/* Ejemplo: cambiar gradiente de fondo */
.register-page {
  background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
}
```

### Redirección Después del Registro

Opciones:

**1. Usar React Router:**

```tsx
import { useNavigate } from 'react-router-dom';

export function RegisterPage() {
  const navigate = useNavigate();
  
  // En el paso de éxito, reemplazar el link:
  <button onClick={() => navigate('/login')} className="btn btn-primary">
    Ir al Login
  </button>
}
```

**2. Callback personalizado:**

```tsx
interface RegisterPageProps {
  onSuccess?: (user: User) => void;
}

export function RegisterPage({ onSuccess }: RegisterPageProps) {
  // En handleFaceCapture, después del registro exitoso:
  if (onSuccess) {
    onSuccess(registeredUser);
  }
}
```

## 🎨 Componentes Visuales

### Indicador de Pasos

Muestra visualmente en qué paso del proceso está el usuario:

```
[1] ──── [2] ──── [3] ──── [4]
 ✓      activo   pendiente pendiente
```

### Mensajes de Error

Los errores se muestran de forma prominente con iconos y animación:

```tsx
// El componente maneja automáticamente:
- Errores de validación
- Errores de WebAuthn
- Errores de captura facial
- Errores de red/API
```

### Loading States

Indicadores visuales en cada paso:
- Spinner durante WebAuthn
- Spinner durante procesamiento de rostro
- Estados deshabilitados de botones

## 🔐 Seguridad

### Validaciones Implementadas

1. **Email:** Validación con regex antes de enviar
2. **Nombre:** No puede estar vacío
3. **WebAuthn:** Manejo de errores específicos del navegador
4. **Vector facial:** Validación automática en FaceScanner

### Manejo de Errores WebAuthn

```tsx
// Errores específicos manejados:
- NotAllowedError: Usuario canceló
- NotSupportedError: Dispositivo no compatible
- InvalidStateError: Credencial ya registrada
- NetworkError: Problema de conexión
```

## 🧪 Testing

### Desarrollo Local

```bash
# 1. Asegúrate de que el backend esté corriendo
cd ../backend
npm run dev

# 2. Inicia el frontend
cd ../frontend
npm run dev
```

### Casos de Prueba

1. **Registro exitoso completo:**
   - Llenar formulario
   - Completar WebAuthn
   - Capturar rostro
   - Ver pantalla de éxito

2. **Errores de validación:**
   - Email inválido
   - Campos vacíos

3. **Cancelación de WebAuthn:**
   - Cancelar prompt de biometría
   - Verificar que vuelve al formulario

4. **Problemas de cámara:**
   - Denegar permiso de cámara
   - Verificar mensaje de error

5. **Rostro ya registrado:**
   - Intentar registrar el mismo rostro dos veces
   - Verificar error específico

## 🐛 Troubleshooting

### Error: "Tu dispositivo no soporta autenticación biométrica"

**Causa:** El navegador o dispositivo no soporta WebAuthn.

**Solución:**
- Usar un navegador moderno (Chrome 90+, Firefox 88+, Safari 14.1+)
- Verificar que el sitio esté en HTTPS (en producción)
- En desarrollo, usar localhost (permitido sin HTTPS)

### Error: "Face already registered in the system"

**Causa:** El rostro ya está asociado a otra cuenta.

**Solución:**
- Usar un rostro diferente
- Contactar al administrador para eliminar el registro anterior
- Verificar que no sea una cuenta duplicada

### La cámara no se activa

**Causa:** Permisos de cámara denegados o no disponibles.

**Solución:**
- Verificar permisos del navegador (icono de candado en la barra de URL)
- Asegurarse de que no hay otra aplicación usando la cámara
- Recargar la página

### WebAuthn falla inmediatamente

**Causa:** Navegador en modo incógnito o extensiones bloqueando.

**Solución:**
- Usar ventana normal (no incógnito)
- Desactivar extensiones de privacidad temporalmente
- Verificar que el origen esté permitido

## 📱 Compatibilidad

### Navegadores Soportados

| Navegador | Versión Mínima | WebAuthn | Face Scanner |
|-----------|----------------|----------|--------------|
| Chrome    | 90+            | ✅       | ✅           |
| Edge      | 90+            | ✅       | ✅           |
| Firefox   | 88+            | ✅       | ✅           |
| Safari    | 14.1+          | ✅       | ✅           |
| iOS Safari| 14.5+          | ✅       | ✅           |

### Dispositivos

- ✅ Desktop (Windows, macOS, Linux)
- ✅ Móviles (iOS, Android)
- ✅ Tablets
- ⚠️ Requiere cámara frontal funcional

## 🎓 Hook Personalizado

También se incluye un hook `useRegistration` para usar la lógica en componentes personalizados:

```tsx
import { useRegistration } from '@/hooks/useRegistration';

function CustomRegisterFlow() {
  const {
    loading,
    error,
    userId,
    registeredUser,
    registerUser,
    completeFaceRegistration,
    reset,
    clearError,
  } = useRegistration();

  const handleSubmit = async (email: string, fullName: string) => {
    const success = await registerUser(email, fullName);
    if (success) {
      // Continuar con captura facial
    }
  };

  const handleFace = async (vector: number[]) => {
    const success = await completeFaceRegistration(vector);
    if (success) {
      // Registro completo!
    }
  };

  return (
    <div>
      {loading && <p>Cargando...</p>}
      {error && <p>Error: {error}</p>}
      {/* Tu UI personalizada */}
    </div>
  );
}
```

## 📚 Referencias

- [WebAuthn Guide](https://webauthn.guide/)
- [SimpleWebAuthn Docs](https://simplewebauthn.dev/)
- [FaceScanner Setup](../FACE_SCANNER_SETUP.md)
- [API Documentation](../ROUTES.md)

## 🆘 Soporte

Para problemas o preguntas:
1. Revisar la consola del navegador para errores
2. Verificar que el backend esté corriendo
3. Consultar la documentación de la API
4. Revisar permisos de cámara y WebAuthn
