import type { User, AuthenticatorDevice, FaceVector } from './api.types';

/**
 * Tipos para gestión de usuarios
 */

// === OBTENER USUARIOS ===

// Response para listar todos los usuarios
export interface GetAllUsersResponse {
  success: true;
  count: number;
  users: User[];
}

// Response para obtener un usuario por ID
export interface GetUserByIdResponse {
  success: true;
  user: User;
}

// === ACTUALIZAR USUARIO ===

// Request para actualizar usuario
export interface UpdateUserRequest {
  fullName?: string;
  role?: 'client' | 'admin';
  isActive?: boolean;
}

// Response de actualización de usuario
export interface UpdateUserResponse {
  success: true;
  message: string;
  user: User;
}

// === ELIMINAR USUARIO ===

// Response de eliminación (soft delete)
export interface DeleteUserResponse {
  success: true;
  message: string;
}

// === DESBLOQUEAR USUARIO ===

// Response de desbloqueo de cuenta
export interface UnlockUserResponse {
  success: true;
  message: string;
  user: User;
}

// === ACTUALIZAR VECTOR FACIAL ===

// Request para actualizar vector facial
export interface UpdateFaceVectorRequest {
  faceVector: FaceVector;
}

// Response de actualización de vector facial
export interface UpdateFaceVectorResponse {
  success: true;
  message: string;
}

// === DISPOSITIVOS ===

// Response para obtener dispositivos del usuario
export interface GetUserDevicesResponse {
  success: true;
  count: number;
  devices: AuthenticatorDevice[];
}

// Response de eliminación de dispositivo
export interface RemoveDeviceResponse {
  success: true;
  message: string;
}
