import type { Request, Response, NextFunction } from 'express';
import AuthService from '../services/AuthService.js';

class AuthController {
    /**
     * POST /api/auth/register/start
     * Inicia el proceso de registro WebAuthn
     */
    async startRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { email, fullName } = req.body;

            if (!email || !fullName) {
                res.status(400).json({ 
                    error: 'Email and fullName are required' 
                });
                return;
            }

            const result = await AuthService.startRegistration(email, fullName);
            
            res.status(200).json({
                success: true,
                options: result.options,
                userId: result.userId,
                skipWebAuthn: result.skipWebAuthn || false,
                skipFace: result.skipFace || false,
                ...(result.message && { message: result.message })
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/register/verify
     * Verifica la respuesta WebAuthn del cliente
     */
    async verifyRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId, response } = req.body;

            if (!userId || !response) {
                res.status(400).json({ 
                    error: 'userId and response are required' 
                });
                return;
            }

            const verification = await AuthService.verifyRegistration(userId, response);

            if (!verification.verified) {
                res.status(400).json({ 
                    error: 'Verification failed' 
                });
                return;
            }

            res.status(200).json({
                success: true,
                verified: true,
                userId
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/register/face
     * Completa el registro guardando el vector facial
     */
    async completeFaceRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId, faceVector } = req.body;

            if (!userId || !faceVector) {
                res.status(400).json({ 
                    error: 'userId and faceVector are required' 
                });
                return;
            }

            // Validar que faceVector sea un array
            if (!Array.isArray(faceVector)) {
                res.status(400).json({ 
                    error: 'faceVector must be an array' 
                });
                return;
            }

            await AuthService.completeFaceRegistration(userId, faceVector);

            res.status(200).json({
                success: true,
                message: 'Registration completed successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/login/start
     * Inicia el proceso de login WebAuthn
     */
    async startAuthentication(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { email } = req.body;

            const options = await AuthService.startAuthentication(email);

            res.status(200).json({
                success: true,
                options
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/login/verify
     * Verifica la respuesta WebAuthn del cliente
     */
    async verifyAuthentication(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { response } = req.body;

            if (!response) {
                res.status(400).json({ 
                    error: 'response is required' 
                });
                return;
            }

            const user = await AuthService.verifyAuthentication(response);

            res.status(200).json({
                success: true,
                userId: user._id,
                email: user.email,
                fullName: user.fullName,
                role: user.role
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/login/face
     * Verifica el rostro del usuario como segunda capa
     */
    async verifyFaceLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { userId, faceVector } = req.body;

            if (!userId || !faceVector) {
                res.status(400).json({ 
                    error: 'userId and faceVector are required' 
                });
                return;
            }

            if (!Array.isArray(faceVector)) {
                res.status(400).json({ 
                    error: 'faceVector must be an array' 
                });
                return;
            }

            const user = await AuthService.verifyFaceLogin(userId, faceVector);

            // Aquí podrías generar un JWT o sesión
            res.status(200).json({
                success: true,
                message: 'Authentication successful',
                user: {
                    _id: user._id,
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role,
                    isActive: user.isActive,
                    failedLoginAttempts: user.failedLoginAttempts,
                    lastLogin: user.lastLogin
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/identify
     * Identifica un usuario por su rostro (login sin email)
     */
    async identifyByFace(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { faceVector } = req.body;

            if (!faceVector) {
                res.status(400).json({ 
                    error: 'faceVector is required' 
                });
                return;
            }

            if (!Array.isArray(faceVector)) {
                res.status(400).json({ 
                    error: 'faceVector must be an array' 
                });
                return;
            }

            const user = await AuthService.identifyUserByFace(faceVector);

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
                return;
            }

            res.status(200).json({
                success: true,
                user: {
                    id: user._id,
                    email: user.email,
                    fullName: user.fullName
                }
            });
        } catch (error) {
            next(error);
        }
    }
}

export default new AuthController();
