import type { User, FaceVector, UserRole } from './api.types';
import type {
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
    RegistrationResponseJSON,
    AuthenticationResponseJSON,
} from '@simplewebauthn/browser';

/**
 * Tipos para autenticación y registro
 */

// === REGISTRO ===

// Request para iniciar registro
export interface StartRegistrationRequest {
    email: string;
    fullName: string;
}

// Response de inicio de registro
export interface StartRegistrationResponse {
    success: true;
    options: PublicKeyCredentialCreationOptionsJSON | null;
    userId: string;
    skipWebAuthn?: boolean;
    skipFace?: boolean;
    message?: string;
}

// Request para verificar registro WebAuthn
export interface VerifyRegistrationRequest {
    userId: string;
    response: RegistrationResponseJSON;
}

// Response de verificación de registro
export interface VerifyRegistrationResponse {
    success: true;
    verified: boolean;
    userId: string;
}

// Request para completar registro facial
export interface CompleteFaceRegistrationRequest {
    userId: string;
    faceVector: FaceVector;
    }

// Response de registro facial completo
export interface CompleteFaceRegistrationResponse {
    success: true;
    message: string;
}

// === LOGIN ===

// Request para iniciar login
export interface StartLoginRequest {
    email?: string;
}

// Response de inicio de login
export interface StartLoginResponse {
    success: true;
    options: PublicKeyCredentialRequestOptionsJSON;
}

// Request para verificar login WebAuthn
export interface VerifyLoginRequest {
    response: AuthenticationResponseJSON;
}

// Response de verificación de login
export interface VerifyLoginResponse {
  success: true;
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
}

// Request para verificar rostro en login
export interface VerifyFaceLoginRequest {
  userId: string;
  faceVector: FaceVector;
}

// Response de verificación facial
export interface VerifyFaceLoginResponse {
  success: true;
  message: string;
  user: User;
}

// === IDENTIFICACIÓN POR ROSTRO ===

// Request para identificar usuario por rostro
export interface IdentifyByFaceRequest {
  faceVector: FaceVector;
}

// Response de identificación facial
export interface IdentifyByFaceResponse {
  success: true;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
}
