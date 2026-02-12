# 🚀 INICIO RÁPIDO - Sistema de Login Seguro

## ⚡ Pasos para Ejecutar (5 minutos)

### 1️⃣ Backend (Terminal 1)
```bash
cd backend
npm install
npm run dev
```
✅ Backend en: **http://localhost:3000**

### 2️⃣ Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run setup-models  # Solo primera vez
npm run dev
```
✅ Frontend en: **http://localhost:5173**

---

## 👤 Crear Primer Usuario Admin

### Opción A: Registro Normal + Cambio Manual
1. Ir a http://localhost:5173/register
2. Registrar usuario con email y nombre
3. Completar WebAuthn (huella/PIN) y facial
4. **En MongoDB**, cambiar el `role` del usuario a `"admin"`

### Opción B: Seed Script (Si existe en backend)
```bash
cd backend
npm run seed
```

---

## 🎯 Rutas Disponibles

| Ruta | Descripción | Rol Requerido |
|------|-------------|---------------|
| `/login` | Inicio de sesión | Público |
| `/register` | Registro de usuarios | Público |
| `/admin` | Dashboard administrador | Admin |
| `/dashboard` | Dashboard cliente | Cliente |
| `/unauthorized` | Acceso denegado | Público |

---

## ✅ Verificación Rápida

### ✔️ Backend funcionando
```bash
curl http://localhost:3000/api/health
```

### ✔️ Frontend funcionando
Abrir http://localhost:5173 en el navegador

---

## 🐛 Problemas Comunes

### Error: "Cannot connect to backend"
```bash
# Verifica que el backend esté corriendo
cd backend
npm run dev
```

### Error: "Models not found"
```bash
cd frontend
npm run setup-models
```

### Error: "WebAuthn not supported"
- Usa Chrome, Firefox o Edge
- Verifica que estés en localhost o HTTPS

---

## 📝 Credenciales de Prueba

Después de crear el primer usuario admin, puedes:

1. **Login como Admin**: Usar el email del usuario admin creado
2. **Crear Clientes**: Desde el dashboard admin, crear usuarios con rol "client"

---

## 🎉 ¡Todo Listo!

Tu sistema está configurado con:
- ✅ Autenticación WebAuthn (huella/Face ID/PIN)
- ✅ Reconocimiento facial
- ✅ Roles: Admin y Cliente
- ✅ Dashboards personalizados
- ✅ Gestión completa de usuarios

**¡Disfruta tu sistema de autenticación biométrica! 🔐**

---

## 📚 Documentación Completa

- **SETUP.md** - Guía detallada de configuración
- **PROJECT_STATUS.md** - Estado completo del proyecto
- **PENDING_ENDPOINTS.md** - Endpoints disponibles
