import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorResponse } from '../types';

/**
 * Configuración de Axios para comunicación con la API
 */

// URL base de la API (ajustar según tu configuración)
const API_BASE_URL = import.meta.env.VITE_API_URL;

// Crear instancia de Axios con configuración base
export const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // Habilitar envío de cookies/credenciales
    withCredentials: true,
    // Timeout de 15 segundos (face detection puede tardar)
    timeout: 15000,
});

/**
 * Interceptor de request
 * Aquí puedes agregar tokens, headers adicionales, etc.
 */
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Si necesitas agregar un token de autenticación:
        // const token = localStorage.getItem('authToken');
        // if (token && config.headers) {
        //   config.headers.Authorization = `Bearer ${token}`;
        // }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * Interceptor de response
 * Maneja errores de forma centralizada
 */
apiClient.interceptors.response.use(
    (response) => {
        // Si la respuesta es exitosa, retornarla directamente
        return response;
    },
    (error: AxiosError<ApiErrorResponse>) => {
        // Manejo de errores comunes
        if (error.response) {
        // El servidor respondió con un código de error
        const { status, data } = error.response;

        switch (status) {
            case 401:
            // Usuario no autenticado o credenciales inválidas
            console.error('Authentication error:', data?.error);
            // Aquí podrías redirigir al login
            // window.location.href = '/login';
            break;

            case 403:
            // Usuario no autorizado para esta acción
            console.error('Authorization error:', data?.error);
            break;

            case 404:
            // Recurso no encontrado
            console.error('Resource not found:', data?.error);
            break;

            case 409:
            // Conflicto (e.g., rostro ya registrado)
            console.error('Conflict:', data?.error);
            break;

            case 423:
            // Cuenta bloqueada
            console.error('Account locked:', data?.error);
            break;

            case 500:
            // Error interno del servidor
            console.error('Server error:', data?.error);
            break;

            default:
            console.error('API error:', data?.error || error.message);
        }
        } else if (error.request) {
        // La petición fue hecha pero no hubo respuesta
        console.error('No response from server:', error.message);
        } else {
        // Algo sucedió al configurar la petición
        console.error('Request error:', error.message);
        }

        return Promise.reject(error);
    }
);

/**
 * Helper para extraer el mensaje de error de una respuesta
 */
export const getErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiErrorResponse>;
        return axiosError.response?.data?.error || axiosError.message || 'An unexpected error occurred';
    }
    
    if (error instanceof Error) {
        return error.message;
    }
    
    return 'An unexpected error occurred';
};

/**
 * Helper para verificar si un error es de autenticación
 */
export const isAuthError = (error: unknown): boolean => {
    if (axios.isAxiosError(error)) {
        return error.response?.status === 401;
    }
    return false;
};

/**
 * Helper para verificar si la cuenta está bloqueada
 */
export const isAccountLockedError = (error: unknown): boolean => {
    if (axios.isAxiosError(error)) {
        return error.response?.status === 423;
    }
    return false;
};

export default apiClient;
