import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { authService, getErrorMessage } from '@/api';
import type { User } from '@/types';

interface UseRegistrationReturn {
  // Estado
  loading: boolean;
  error: string | null;
  userId: string | null;
  registeredUser: User | null;
  skipFace: boolean;
  
  // Funciones
  registerUser: (email: string, fullName: string) => Promise<boolean>;
  completeFaceRegistration: (faceVector: number[]) => Promise<boolean>;
  reset: () => void;
  clearError: () => void;
}

/**
 * Hook para manejar el flujo completo de registro
 * Encapsula la lógica de WebAuthn y comunicación con la API
 */
export function useRegistration(): UseRegistrationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [registeredUser, setRegisteredUser] = useState<User | null>(null);
  const [skipFace, setSkipFace] = useState(false);

  /**
   * Paso 1 y 2: Registrar usuario con WebAuthn
   */
  const registerUser = async (
    email: string,
    fullName: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      // 1. Iniciar registro
      const startData = await authService.startRegistration({
        email,
        fullName,
      });

      // Guardar userId
      setUserId(startData.userId);

      // Si el backend indica saltar captura facial (usuario ya registrado, agregando dispositivo)
      if (startData.skipFace) {
        setSkipFace(true);
      }

      // 2. Ejecutar WebAuthn
      const credential = await startRegistration(startData.options);

      // 3. Verificar credencial
      await authService.verifyRegistration({
        userId: startData.userId,
        response: credential,
      });

      setLoading(false);
      return true;
    } catch (err) {
      const errorMsg = getErrorMessage(err);

      // Manejar errores específicos de WebAuthn
      if (errorMsg.includes('NotAllowedError')) {
        setError('Registro cancelado. Por favor, intenta de nuevo.');
      } else if (errorMsg.includes('NotSupportedError')) {
        setError('Tu dispositivo no soporta autenticación biométrica.');
      } else if (errorMsg.includes('InvalidStateError')) {
        setError('Esta credencial ya está registrada en este dispositivo.');
      } else {
        setError(errorMsg);
      }

      setLoading(false);
      return false;
    }
  };

  /**
   * Paso 3: Completar registro con vector facial
   */
  const completeFaceRegistration = async (
    faceVector: number[]
  ): Promise<boolean> => {
    if (!userId) {
      setError('Error: No hay un registro en progreso.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.completeFaceRegistration({
        userId,
        faceVector,
      });

      // Marcar registro como completo (simulamos el usuario)
      setRegisteredUser({
        _id: userId,
        email: '',
        fullName: '',
        role: 'client',
        isActive: true,
        failedLoginAttempts: 0,
      } as User);

      setLoading(false);
      return true;
    } catch (err) {
      const errorMsg = getErrorMessage(err);

      if (errorMsg.includes('Face already registered')) {
        setError(
          'Este rostro ya está registrado en el sistema. Por favor, contacta al administrador.'
        );
      } else {
        setError(errorMsg);
      }

      setLoading(false);
      return false;
    }
  };

  /**
   * Reiniciar el estado del hook
   */
  const reset = () => {
    setLoading(false);
    setError(null);
    setUserId(null);
    setRegisteredUser(null);
    setSkipFace(false);
  };

  /**
   * Limpiar error
   */
  const clearError = () => {
    setError(null);
  };

  return {
    loading,
    error,
    userId,
    registeredUser,
    skipFace,
    registerUser,
    completeFaceRegistration,
    reset,
    clearError,
  };
}
