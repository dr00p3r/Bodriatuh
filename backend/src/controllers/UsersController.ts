import type { Request, Response, NextFunction } from 'express';
import User from '../models/User.js';
import type { IUser, IWebAuthnCredential } from '../models/User.js';
import BiometricService from '../services/BiometricService.js';

class UsersController {
    /**
     * GET /api/users
     * Obtiene todos los usuarios (solo admin)
     */
    async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const users = await User.find({ isActive: true })
                .select('-webAuthnCredentials -currentChallenge -encryptedFaceVector');

            res.status(200).json({
                success: true,
                count: users.length,
                users
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/users/:id
     * Obtiene un usuario por ID
     */
    async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;

            const user = await User.findById(id)
                .select('-webAuthnCredentials -currentChallenge -encryptedFaceVector');

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
                return;
            }

            res.status(200).json({
                success: true,
                user
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /api/users/:id
     * Actualiza un usuario
     */
    async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { fullName, role, isActive } = req.body;

            const updateData: Partial<Pick<IUser, 'fullName' | 'role' | 'isActive'>> = {};
            if (fullName) updateData.fullName = fullName;
            if (role) updateData.role = role;
            if (typeof isActive === 'boolean') updateData.isActive = isActive;

            const user = await User.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            ).select('-webAuthnCredentials -currentChallenge -encryptedFaceVector');

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'User updated successfully',
                user
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/users/:id
     * Elimina (desactiva) un usuario
     */
    async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;

            const user = await User.findByIdAndUpdate(
                id,
                { isActive: false },
                { new: true }
            ).select('-webAuthnCredentials -currentChallenge -encryptedFaceVector');

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'User deactivated successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/users/:id/unlock
     * Desbloquea una cuenta de usuario
     */
    async unlockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;

            const user = await User.findByIdAndUpdate(
                id,
                { 
                    failedLoginAttempts: 0,
                    lockUntil: null as any
                },
                { new: true }
            ).select('-webAuthnCredentials -currentChallenge -encryptedFaceVector');

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'User unlocked successfully',
                user
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /api/users/:id/face
     * Actualiza el vector facial de un usuario
     */
    async updateFaceVector(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { faceVector } = req.body;

            if (!id || typeof id !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Valid user ID is required'
                });
                return;
            }

            if (!faceVector || !Array.isArray(faceVector)) {
                res.status(400).json({
                    success: false,
                    error: 'faceVector is required and must be an array'
                });
                return;
            }

            await BiometricService.saveFaceVector(id, faceVector);

            res.status(200).json({
                success: true,
                message: 'Face vector updated successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/users/:id/devices
     * Obtiene los dispositivos registrados de un usuario
     */
    async getUserDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;

            const user = await User.findById(id);

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
                return;
            }

            const devices = user.webAuthnCredentials.map((cred: IWebAuthnCredential, index: number) => ({
                id: index,
                credentialID: cred.credentialID.substring(0, 10) + '...',
                transports: cred.transports,
                counter: cred.counter
            }));

            res.status(200).json({
                success: true,
                count: devices.length,
                devices
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/users/:id/devices/:credentialId
     * Elimina un dispositivo registrado
     */
    async removeDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id, credentialId } = req.params;

            if (!credentialId || typeof credentialId !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Valid credential ID is required'
                });
                return;
            }

            const user = await User.findById(id);

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
                return;
            }

            const initialLength = user.webAuthnCredentials.length;
            user.webAuthnCredentials = user.webAuthnCredentials.filter(
                (cred: IWebAuthnCredential) => !cred.credentialID.includes(credentialId)
            );

            if (user.webAuthnCredentials.length === initialLength) {
                res.status(404).json({
                    success: false,
                    error: 'Device not found'
                });
                return;
            }

            await user.save();

            res.status(200).json({
                success: true,
                message: 'Device removed successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new UsersController();
