/**
 * Tipos base para las respuestas de la API
 */

// Respuestas genéricas
export interface ApiSuccessResponse<T = unknown> {
    success: true;
    data?: T;
    message?: string;
}

export interface ApiErrorResponse {
    success: false;
    error: string;
    details?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Roles de usuario
export type UserRole = 'client' | 'admin';

// Usuario
export interface User {
    _id: string;
    email: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
    failedLoginAttempts: number;
    lastLogin?: string;
    createdAt?: string;
}

// Dispositivo WebAuthn
export interface AuthenticatorDevice {
    id: number;
    credentialID: string;
    transports: string[];
    counter: number;
}

// Vector facial (128+ dimensiones)
export type FaceVector = number[];
