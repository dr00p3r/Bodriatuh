import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
    type VerifiedRegistrationResponse,
    type VerifiedAuthenticationResponse
} from '@simplewebauthn/server';
import User from '../models/User.js';
import type { IUser, IWebAuthnCredential } from '../models/User.js';
import type { 
    RegistrationResponseJSON,
    AuthenticationResponseJSON 
} from '@simplewebauthn/server';
import BiometricService from './BiometricService.js';
import { config } from '../config/env.js';

class AuthService {
    private readonly RP_NAME = config.RP_NAME;
    private readonly RP_ID = config.RP_ID;
    private readonly ORIGIN = config.ORIGIN;
    private readonly MAX_FAILED_ATTEMPTS = config.MAX_FAILED_ATTEMPTS;
    private readonly LOCK_TIME = config.LOCK_TIME;

    /**
     * Inicia el proceso de registro generando opciones para WebAuthn.
     * 
     * Si el usuario ya tiene credenciales WebAuthn pero no tiene vector facial,
     * significa que tuvo un registro interrumpido → se salta WebAuthn.
     * 
     * @param email - Email del usuario
     * @param fullName - Nombre completo del usuario
     * @returns Opciones de registro para el cliente, o indicador de que ya tiene passkey
     */
    async startRegistration(email: string, fullName: string) {
        let user = await User.findOne({ email }).select('+encryptedFaceVector');

        if (!user) {
            user = await User.create({
                email,
                fullName,
                webAuthnCredentials: [],
                failedLoginAttempts: 0
            });
        }

        // Si tiene credenciales pero NO vector facial → registro interrumpido
        // Saltar WebAuthn e ir directo a captura facial
        if (user.webAuthnCredentials.length > 0 && !user.encryptedFaceVector) {
            return {
                options: null,
                userId: user._id,
                skipWebAuthn: true,
                message: 'Este dispositivo ya tiene una llave registrada. Continúa con la captura facial.'
            };
        }

        // Si el usuario ya está completamente registrado (credenciales + rostro),
        // permitir agregar un nuevo dispositivo (passkey) y saltar captura facial
        const isAddingDevice = user.webAuthnCredentials.length > 0 && !!user.encryptedFaceVector;

        const options = await generateRegistrationOptions({
            rpName: this.RP_NAME,
            rpID: this.RP_ID,
            userName: email,
            userDisplayName: fullName,
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'required',
                authenticatorAttachment: 'platform'
            },
            excludeCredentials: user.webAuthnCredentials.map((cred: IWebAuthnCredential) => ({
                id: cred.credentialID,
                transports: cred.transports as AuthenticatorTransport[]
            }))
        });

        // Guardar challenge temporalmente
        user.currentChallenge = options.challenge;
        await user.save();

        return {
            options,
            userId: user._id,
            // Si ya tiene rostro registrado, el frontend puede saltar la captura facial
            ...(isAddingDevice && { skipFace: true, message: 'Registrando nuevo dispositivo. No necesitas captura facial.' })
        };
    }

    /**
     * Verifica la respuesta de registro WebAuthn y guarda las credenciales.
     * 
     * @param userId - ID del usuario
     * @param response - Respuesta del cliente WebAuthn
     */
    async verifyRegistration(userId: string, response: RegistrationResponseJSON): Promise<VerifiedRegistrationResponse> {
        const user = await User.findById(userId);

        if (!user || !user.currentChallenge) {
            throw new Error('User not found or invalid registration state');
        }

        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: user.currentChallenge,
            expectedOrigin: this.ORIGIN,
            expectedRPID: this.RP_ID
        });

        if (!verification.verified || !verification.registrationInfo) {
            throw new Error('Registration verification failed');
        }

        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

        // Agregar credencial al usuario
        user.webAuthnCredentials.push({
            credentialID: credential.id,
            credentialPublicKey: Buffer.from(credential.publicKey),
            counter: credential.counter,
            ...(response.response.transports && { transports: response.response.transports })
        });

        user.currentChallenge = '' as any;
        await user.save();

        return verification;
    }

    /**
     * Completa el registro guardando el vector facial del usuario.
     * Segunda fase del registro después de WebAuthn.
     * 
     * @param userId - ID del usuario
     * @param faceVector - Vector facial capturado
     */
    async completeFaceRegistration(userId: string, faceVector: Float32Array | number[]): Promise<void> {
        const user = await User.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        if (user.webAuthnCredentials.length === 0) {
            throw new Error('WebAuthn credentials must be registered first');
        }

        await BiometricService.saveFaceVector(userId, faceVector);
    }

    /**
     * Inicia el proceso de login generando opciones de autenticación.
     * 
     * @param email - Email del usuario (opcional, puede ser identificado por rostro)
     */
    async startAuthentication(email?: string) {
        const query = email ? { email, isActive: true } : { isActive: true };
        const users = await User.find(query);

        if (users.length === 0) {
            throw new Error('No users found');
        }

        const allowCredentials = users.flatMap((user: IUser) =>
            user.webAuthnCredentials.map((cred: IWebAuthnCredential) => ({
                id: cred.credentialID,
                //transports: cred.transports as AuthenticatorTransport[]
            }))
        );

        const options = await generateAuthenticationOptions({
            rpID: this.RP_ID,
            userVerification: 'preferred',
            ...(allowCredentials.length > 0 && { allowCredentials })
        });

        // Guardar challenge en todos los usuarios posibles
        for (const user of users) {
            user.currentChallenge = options.challenge;
            await user.save();
        }

        return options;
    }

    /**
     * Verifica la autenticación WebAuthn.
     * Primera fase del login.
     * 
     * @param response - Respuesta del cliente WebAuthn
     * @returns Usuario autenticado
     */
    async verifyAuthentication(response: AuthenticationResponseJSON): Promise<IUser> {
        const credentialID = response.id;

        const user = await User.findOne({
            'webAuthnCredentials.credentialID': credentialID,
            isActive: true
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Verificar si está bloqueado
        if (user.lockUntil && user.lockUntil > new Date()) {
            const remainingTime = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
            throw new Error(`Account locked. Try again in ${remainingTime} minutes`);
        }

        const credential = user.webAuthnCredentials.find(
            (cred: IWebAuthnCredential) => cred.credentialID === credentialID
        );

        if (!credential || !user.currentChallenge) {
            throw new Error('Invalid authentication state');
        }

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: user.currentChallenge,
            expectedOrigin: this.ORIGIN,
            expectedRPID: this.RP_ID,
            credential: {
                id: credential.credentialID,
                publicKey: new Uint8Array(credential.credentialPublicKey),
                counter: credential.counter
            }
        });

        if (!verification.verified) {
            await this.handleFailedLogin(user);
            throw new Error('Authentication verification failed');
        }

        // Actualizar counter (previene ataques de replay)
        credential.counter = verification.authenticationInfo.newCounter;
        user.currentChallenge = '' as any;
        await user.save();

        return user;
    }

    /**
     * Verifica el rostro del usuario como segunda capa de autenticación.
     * Segunda fase del login después de WebAuthn.
     * 
     * @param userId - ID del usuario
     * @param faceVector - Vector facial capturado
     * @returns Usuario si la verificación es exitosa
     */
    async verifyFaceLogin(userId: string, faceVector: Float32Array | number[]): Promise<IUser> {
        const user = await User.findById(userId).select('+encryptedFaceVector');

        if (!user) {
            throw new Error('User not found');
        }

        const isValidFace = await BiometricService.verifyUserFace(userId, faceVector);

        if (!isValidFace) {
            await this.handleFailedLogin(user);
            throw new Error('Face verification failed');
        }

        // Login exitoso: resetear intentos fallidos
        user.failedLoginAttempts = 0;
        user.lockUntil = null as any;
        user.lastLogin = new Date();
        await user.save();

        return user;
    }

    /**
     * Maneja intentos fallidos de login aplicando rate limiting.
     */
    private async handleFailedLogin(user: IUser): Promise<void> {
        user.failedLoginAttempts += 1;

        if (user.failedLoginAttempts >= this.MAX_FAILED_ATTEMPTS) {
            user.lockUntil = new Date(Date.now() + this.LOCK_TIME);
        }

        await user.save();
    }

    /**
     * Identifica un usuario por su rostro durante el login.
     * Permite login sin necesidad de ingresar email.
     * 
     * @param faceVector - Vector facial capturado
     * @returns Usuario identificado o null
     */
    async identifyUserByFace(faceVector: Float32Array | number[]): Promise<IUser | null> {
        return await BiometricService.findUserByFace(faceVector);
    }
}

export default new AuthService();
