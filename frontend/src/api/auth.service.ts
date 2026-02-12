import apiClient from './axios.config';
import type {
    StartRegistrationRequest,
    StartRegistrationResponse,
    VerifyRegistrationRequest,
    VerifyRegistrationResponse,
    CompleteFaceRegistrationRequest,
    CompleteFaceRegistrationResponse,
    StartLoginRequest,
    StartLoginResponse,
    VerifyLoginRequest,
    VerifyLoginResponse,
    VerifyFaceLoginRequest,
    VerifyFaceLoginResponse,
    IdentifyByFaceRequest,
    IdentifyByFaceResponse,
} from '../types';

/**
 * Servicio de autenticación
 * Contiene todos los métodos para registro y login
 */

export const authService = {
    /**
     * === REGISTRO ===
     */

    /**
     * Inicia el proceso de registro con WebAuthn
     * @param email - Email del usuario
     * @param fullName - Nombre completo del usuario
     * @returns Opciones de WebAuthn y userId
     */
    startRegistration: async (
        data: StartRegistrationRequest
    ): Promise<StartRegistrationResponse> => {
        const response = await apiClient.post<StartRegistrationResponse>(
            '/auth/register/start',
            data
        );
        return response.data;
    },

    /**
     * Verifica la respuesta WebAuthn del registro
     * @param userId - ID del usuario
     * @param response - Respuesta de WebAuthn
     * @returns Resultado de la verificación
     */
    verifyRegistration: async (
        data: VerifyRegistrationRequest
    ): Promise<VerifyRegistrationResponse> => {
        const response = await apiClient.post<VerifyRegistrationResponse>(
            '/auth/register/verify',
            data
        );
        return response.data;
    },

    /**
     * Completa el registro guardando el vector facial
     * @param userId - ID del usuario
     * @param faceVector - Vector facial (128+ dimensiones)
     * @returns Confirmación de registro completo
     */
    completeFaceRegistration: async (
        data: CompleteFaceRegistrationRequest
    ): Promise<CompleteFaceRegistrationResponse> => {
        const response = await apiClient.post<CompleteFaceRegistrationResponse>(
            '/auth/register/face',
            data
        );
        return response.data;
    },

    /**
     * === LOGIN ===
     */

    /**
     * Inicia el proceso de login con WebAuthn
     * @param email - Email del usuario (opcional)
     * @returns Opciones de WebAuthn
     */
    startLogin: async (data?: StartLoginRequest): Promise<StartLoginResponse> => {
        const response = await apiClient.post<StartLoginResponse>(
            '/auth/login/start',
            data || {}
        );
        return response.data;
    },

    /**
     * Verifica la respuesta WebAuthn del login (primera capa)
     * @param response - Respuesta de WebAuthn
     * @returns Información del usuario autenticado
     */
    verifyLogin: async (data: VerifyLoginRequest): Promise<VerifyLoginResponse> => {
        const response = await apiClient.post<VerifyLoginResponse>(
            '/auth/login/verify',
            data
        );
        return response.data;
    },

    /**
     * Verifica el rostro del usuario (segunda capa)
     * @param userId - ID del usuario
     * @param faceVector - Vector facial (128+ dimensiones)
     * @returns Confirmación de autenticación completa con datos del usuario
     */
    verifyFaceLogin: async (
        data: VerifyFaceLoginRequest
    ): Promise<VerifyFaceLoginResponse> => {
        const response = await apiClient.post<VerifyFaceLoginResponse>(
            '/auth/login/face',
            data
        );
        return response.data;
    },

    /**
     * === IDENTIFICACIÓN POR ROSTRO ===
     */

    /**
     * Identifica un usuario por su rostro sin necesidad de email
     * @param faceVector - Vector facial (128+ dimensiones)
     * @returns Información básica del usuario identificado
     */
    identifyByFace: async (
        data: IdentifyByFaceRequest
    ): Promise<IdentifyByFaceResponse> => {
        const response = await apiClient.post<IdentifyByFaceResponse>(
            '/auth/identify',
            data
        );
        return response.data;
    },
};

export default authService;