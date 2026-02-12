import User from '../models/User.js';
import type { IUser } from '../models/User.js';
import CryptoService from './CryptoService.js';
import { config } from '../config/env.js';

class BiometricService {
    private readonly SIMILARITY_THRESHOLD = config.SIMILARITY_THRESHOLD;
    private readonly MIN_VECTOR_LENGTH = config.MIN_VECTOR_LENGTH;

    /**
     * Calcula la similaridad coseno entre dos vectores faciales.
     * Retorna un valor entre 0 (totalmente diferentes) y 1 (idénticos).
     * 
     * @param vectorA - Primer vector facial
     * @param vectorB - Segundo vector facial  
     * @returns Similaridad coseno (0-1)
     */
    private cosineSimilarity(vectorA: Float32Array, vectorB: Float32Array): number {
        if (vectorA.length !== vectorB.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i]! * vectorB[i]!;
            normA += vectorA[i]! * vectorA[i]!;
            normB += vectorB[i]! * vectorB[i]!;
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        
        if (magnitude === 0) {
            throw new Error('Zero magnitude vector detected');
        }

        return dotProduct / magnitude;
    }

    /**
     * Valida que un vector facial cumpla con los requisitos mínimos.
     */
    private validateVector(vector: Float32Array | number[]): void {
        if (!vector || vector.length < this.MIN_VECTOR_LENGTH) {
            throw new Error(`Vector must have at least ${this.MIN_VECTOR_LENGTH} dimensions`);
        }

        const hasValidNumbers = Array.from(vector).every(
            val => typeof val === 'number' && !isNaN(val) && isFinite(val)
        );

        if (!hasValidNumbers) {
            throw new Error('Vector contains invalid numbers');
        }
    }

    /**
     * Verifica que el vector facial sea único en el sistema.
     * Crítico para cumplir con regulaciones de identificación única.
     * 
     * @param faceVector - Vector facial a verificar
     * @param excludeUserId - ID de usuario a excluir de la búsqueda (para actualizaciones)
     * @returns true si el rostro es único, false si ya existe
     */
    async isUniqueFace(
        faceVector: Float32Array | number[], 
        excludeUserId?: string
    ): Promise<boolean> {
        this.validateVector(faceVector);

        const vectorToCheck = new Float32Array(faceVector);
        
        // Obtener usuarios con vectores faciales registrados
        const users = await User.find(
            { 
                encryptedFaceVector: { $exists: true, $ne: '' },
                ...(excludeUserId && { _id: { $ne: excludeUserId } })
            },
            '+encryptedFaceVector'
        );

        // Comparar contra todos los rostros existentes
        for (const user of users) {
            const storedVector = CryptoService.decryptVector(user.encryptedFaceVector);
            const similarity = this.cosineSimilarity(vectorToCheck, storedVector);
            
            // Si encuentra un rostro muy similar, no es único
            if (similarity >= this.SIMILARITY_THRESHOLD) {
                return false;
            }
        }

        return true;
    }

    /**
     * Encuentra un usuario por su vector facial.
     * Usado durante el login para identificar al usuario por su rostro.
     * 
     * @param faceVector - Vector facial capturado
     * @returns Usuario encontrado o null
     */
    async findUserByFace(faceVector: Float32Array | number[]): Promise<IUser | null> {
        this.validateVector(faceVector);

        const vectorToCheck = new Float32Array(faceVector);
        
        const users = await User.find(
            { 
                encryptedFaceVector: { $exists: true, $ne: '' },
                isActive: true
            },
            '+encryptedFaceVector'
        );

        for (const user of users) {
            const storedVector = CryptoService.decryptVector(user.encryptedFaceVector);
            const similarity = this.cosineSimilarity(vectorToCheck, storedVector);
            
            if (similarity >= this.SIMILARITY_THRESHOLD) {
                return user;
            }
        }

        return null;
    }

    /**
     * Guarda un vector facial encriptado para un usuario.
     * 
     * @param userId - ID del usuario
     * @param faceVector - Vector facial a guardar
     */
    async saveFaceVector(userId: string, faceVector: Float32Array | number[]): Promise<void> {
        this.validateVector(faceVector);

        const isUnique = await this.isUniqueFace(faceVector, userId);
        
        if (!isUnique) {
            throw new Error('Face already registered in the system');
        }

        const encryptedVector = CryptoService.encryptVector(faceVector);
        
        await User.findByIdAndUpdate(userId, {
            encryptedFaceVector: encryptedVector
        });
    }

    /**
     * Verifica que un vector facial coincida con el del usuario.
     * 
     * @param userId - ID del usuario
     * @param faceVector - Vector facial a verificar
     * @returns true si coincide, false si no
     */
    async verifyUserFace(userId: string, faceVector: Float32Array | number[]): Promise<boolean> {
        this.validateVector(faceVector);

        const user = await User.findById(userId).select('+encryptedFaceVector');
        
        if (!user || !user.encryptedFaceVector) {
            return false;
        }

        const storedVector = CryptoService.decryptVector(user.encryptedFaceVector);
        const inputVector = new Float32Array(faceVector);
        const similarity = this.cosineSimilarity(inputVector, storedVector);
        
        console.log(`[BiometricService] Face verification - similarity: ${similarity.toFixed(6)}, threshold: ${this.SIMILARITY_THRESHOLD}, stored length: ${storedVector.length}, input length: ${inputVector.length}`);
        
        return similarity >= this.SIMILARITY_THRESHOLD;
    }
}

export default new BiometricService();
