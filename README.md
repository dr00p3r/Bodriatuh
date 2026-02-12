# Bodriatuh — Autenticación Biométrica

Sistema de autenticación multifactor que combina **WebAuthn (Passkeys)** y **reconocimiento facial** para garantizar una verificación de identidad segura y sin contraseñas.

## Tecnologías

| Capa | Stack |
|------|-------|
| **Frontend** | React 19, TypeScript, Vite, React Router, Human.js, SimpleWebAuthn Browser |
| **Backend** | Express 5, TypeScript, Mongoose, SimpleWebAuthn Server, Helmet |
| **Base de Datos** | MongoDB |

## Requisitos Previos

- **Node.js** >= 18
- **MongoDB** (local o Atlas)
- Navegador compatible con **WebAuthn** (Chrome, Edge, Firefox, Safari)
- Cámara web para la captura facial

## Instalación

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd Bodriatuh
```

### 2. Backend

```bash
cd backend
npm install
```

Crear un archivo `.env` en la raíz de `backend/` con las siguientes variables:

```env
NODE_ENV=development
PORT=3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/bodriatuh

# WebAuthn
RP_NAME=Bodriatuh
RP_ID=localhost
ORIGIN=http://localhost:5173

# Criptografía (la clave debe tener exactamente CRYPTO_KEY_LENGTH caracteres)
BIOMETRIC_SECRET_KEY=<clave-secreta>
CRYPTO_ALGORITHM=aes-256-cbc
CRYPTO_IV_LENGTH=16
CRYPTO_KEY_LENGTH=32

# Biometría
SIMILARITY_THRESHOLD=0.85
MIN_VECTOR_LENGTH=128

# Seguridad
MAX_FAILED_ATTEMPTS=5
LOCK_TIME=900000
```

Iniciar el servidor:

```bash
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

## Estructura del Proyecto

```
Bodriatuh/
├── backend/
│   └── src/
│       ├── config/         # Variables de entorno y conexión a BD
│       ├── controllers/    # Controladores de Auth y Users
│       ├── middlewares/     # Manejo centralizado de errores
│       ├── models/         # Modelo de usuario (Mongoose)
│       ├── routes/         # Definición de rutas API
│       └── services/       # Lógica de negocio (Auth, Biometric, Crypto)
├── frontend/
│   └── src/
│       ├── api/            # Servicios HTTP (Axios)
│       ├── components/     # Componentes reutilizables (FaceScanner, Guards)
│       ├── context/        # Contexto de autenticación (React Context)
│       ├── hooks/          # Hooks personalizados (useHuman, useRegistration)
│       ├── pages/          # Páginas (Login, Register, Dashboards)
│       ├── types/          # Tipos TypeScript
│       └── utils/          # Utilidades de procesamiento facial
└── README.md
```

## Endpoints Principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/register/start` | Inicia registro WebAuthn |
| `POST` | `/api/auth/register/verify` | Verifica credencial WebAuthn |
| `POST` | `/api/auth/register/face` | Completa registro con vector facial |
| `POST` | `/api/auth/login/start` | Inicia login WebAuthn |
| `POST` | `/api/auth/login/verify` | Verifica autenticación WebAuthn |
| `POST` | `/api/auth/login/face` | Verifica rostro como segundo factor |
| `POST` | `/api/auth/identify` | Identifica usuario solo por rostro |
| `GET`  | `/api/users` | Lista usuarios (admin) |
| `GET`  | `/api/users/:id` | Obtiene usuario por ID |
| `GET`  | `/health` | Health check del servidor |

## Flujo de Uso

### Registro
1. El usuario ingresa email y nombre.
2. Se crea una Passkey (WebAuthn) vinculada al dispositivo.
3. Se captura el rostro con la cámara y se genera un vector facial de 128 dimensiones.
4. El vector se encripta y almacena en la base de datos.

### Login
1. El usuario se autentica con su Passkey (huella, Face ID, PIN del dispositivo).
2. Se captura el rostro y se compara con el vector almacenado (similaridad coseno ≥ 0.85).
3. Si ambas verificaciones son exitosas, se concede acceso.

## Scripts Disponibles

### Backend
| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia el servidor en modo desarrollo con hot-reload |
| `npm start` | Inicia el servidor en producción |

### Frontend
| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia Vite en modo desarrollo |
| `npm run build` | Genera build de producción |
| `npm run lint` | Ejecuta ESLint |
| `npm run preview` | Previsualiza el build de producción |

## Licencia

ISC
