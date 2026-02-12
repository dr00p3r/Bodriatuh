import apiClient from './axios.config';
import type {
    GetAllUsersResponse,
    GetUserByIdResponse,
    UpdateUserRequest,
    UpdateUserResponse,
    DeleteUserResponse,
    UnlockUserResponse,
    UpdateFaceVectorRequest,
    UpdateFaceVectorResponse,
    GetUserDevicesResponse,
    RemoveDeviceResponse,
} from '../types';

/**
 * Servicio de gestión de usuarios
 * Contiene todos los métodos CRUD para usuarios
 */

export const userService = {
    /**
     * === OBTENER USUARIOS ===
     */

    /**
     * Obtiene la lista de todos los usuarios activos
     * @returns Lista de usuarios con su información
     */
    getAllUsers: async (): Promise<GetAllUsersResponse> => {
        const response = await apiClient.get<GetAllUsersResponse>('/users');
        return response.data;
    },

    /**
     * Obtiene la información de un usuario específico
     * @param userId - ID del usuario
     * @returns Información completa del usuario
     */
    getUserById: async (userId: string): Promise<GetUserByIdResponse> => {
        const response = await apiClient.get<GetUserByIdResponse>(`/users/${userId}`);
        return response.data;
    },

    /**
     * === ACTUALIZAR USUARIO ===
     */

    /**
     * Actualiza la información de un usuario
     * @param userId - ID del usuario
     * @param data - Datos a actualizar (fullName, role, isActive)
     * @returns Usuario actualizado
     */
    updateUser: async (
        userId: string,
        data: UpdateUserRequest
    ): Promise<UpdateUserResponse> => {
        const response = await apiClient.put<UpdateUserResponse>(
            `/users/${userId}`,
            data
        );
        return response.data;
    },

    /**
     * === ELIMINAR USUARIO ===
     */

    /**
     * Desactiva un usuario (soft delete)
     * @param userId - ID del usuario
     * @returns Confirmación de desactivación
     */
    deleteUser: async (userId: string): Promise<DeleteUserResponse> => {
        const response = await apiClient.delete<DeleteUserResponse>(`/users/${userId}`);
        return response.data;
    },

    /**
     * === DESBLOQUEAR USUARIO ===
     */

    /**
     * Desbloquea una cuenta de usuario bloqueada por intentos fallidos
     * @param userId - ID del usuario
     * @returns Usuario desbloqueado
     */
    unlockUser: async (userId: string): Promise<UnlockUserResponse> => {
        const response = await apiClient.post<UnlockUserResponse>(
            `/users/${userId}/unlock`
        );
        return response.data;
    },

    /**
     * === ACTUALIZAR VECTOR FACIAL ===
     */

    /**
     * Actualiza el vector facial de un usuario
     * @param userId - ID del usuario
     * @param data - Nuevo vector facial
     * @returns Confirmación de actualización
     */
    updateFaceVector: async (
        userId: string,
        data: UpdateFaceVectorRequest
    ): Promise<UpdateFaceVectorResponse> => {
        const response = await apiClient.put<UpdateFaceVectorResponse>(
            `/users/${userId}/face`,
            data
        );
        return response.data;
    },

    /**
     * === GESTIÓN DE DISPOSITIVOS ===
     */

    /**
     * Obtiene la lista de dispositivos WebAuthn registrados por un usuario
     * @param userId - ID del usuario
     * @returns Lista de dispositivos del usuario
     */
    getUserDevices: async (userId: string): Promise<GetUserDevicesResponse> => {
        const response = await apiClient.get<GetUserDevicesResponse>(
            `/users/${userId}/devices`
        );
        return response.data;
    },

    /**
     * Elimina un dispositivo WebAuthn registrado
     * @param userId - ID del usuario
     * @param credentialId - ID de la credencial a eliminar
     * @returns Confirmación de eliminación
     */
    removeDevice: async (
        userId: string,
        credentialId: string
    ): Promise<RemoveDeviceResponse> => {
        const response = await apiClient.delete<RemoveDeviceResponse>(
            `/users/${userId}/devices/${credentialId}`
        );
        return response.data;
    },
};

export default userService;