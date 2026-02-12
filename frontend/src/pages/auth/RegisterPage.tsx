import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { FaceScanner } from '@/components/biometrics/FaceScanner';
import { authService, getErrorMessage } from '@/api';
import type { User } from '@/types';
import './RegisterPage.css';

type RegistrationStep = 'form' | 'webauthn' | 'face' | 'success';

interface FormData {
    email: string;
    fullName: string;
}

export function RegisterPage() {
    const [step, setStep] = useState<RegistrationStep>('form');
    const [formData, setFormData] = useState<FormData>({
        email: '',
        fullName: '',
    });
    const [userId, setUserId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [registeredUser, setRegisteredUser] = useState<User | null>(null);

    // Validación de formulario
    const isFormValid = (): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return (
        formData.email.trim() !== '' &&
        formData.fullName.trim() !== '' &&
        emailRegex.test(formData.email)
        );
    };

    // Paso 1: Enviar formulario e iniciar registro WebAuthn
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isFormValid()) {
            setError('Por favor, completa todos los campos correctamente');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Iniciar proceso de registro
            const startData = await authService.startRegistration({
                email: formData.email,
                fullName: formData.fullName,
            });

            // Guardar userId para los siguientes pasos
            setUserId(startData.userId);

            // Si el usuario ya tiene passkey (registro interrumpido), ir directo a face
            if (startData.skipWebAuthn) {
                setStep('face');
                setLoading(false);
                return;
            }
            
            // Pasar al paso de WebAuthn
            setStep('webauthn');
            
            // Ejecutar WebAuthn automáticamente
            await handleWebAuthn(startData.options!, startData.userId, startData.skipFace);
        } 
        catch (err) {
            setError(getErrorMessage(err));
            setLoading(false);
        }
    };

  // Paso 2: Ejecutar WebAuthn
    const handleWebAuthn = async (options: any, uid: string, skipFace?: boolean) => {
        try {
            // Crear credencial WebAuthn
            const credential = await startRegistration({ optionsJSON: options });

            // Verificar credencial en el backend
            await authService.verifyRegistration({
                userId: uid,
                response: credential,
            });

            // Si es un dispositivo nuevo para un usuario ya registrado, saltar captura facial
            if (skipFace) {
                setStep('success');
                setRegisteredUser({
                    _id: uid,
                    email: formData.email,
                    fullName: formData.fullName,
                    role: 'client',
                    isActive: true,
                    failedLoginAttempts: 0,
                } as User);
                setLoading(false);
                return;
            }

            // Pasar al paso de captura facial
            setStep('face');
            setLoading(false);
        } 
        catch (err) {
            // Manejar errores específicos de WebAuthn
            const errorMsg = getErrorMessage(err);
            
            if (errorMsg.includes('NotAllowedError')) {
                setError('Registro cancelado. Por favor, intenta de nuevo.');
            } 
            else if (errorMsg.includes('NotSupportedError')) {
                setError('Tu dispositivo no soporta autenticación biométrica.');
            }
            else if (errorMsg.includes('InvalidStateError')) {
                // La credencial ya existe — el dispositivo ya tiene passkey
                // Ir directo a captura facial
                setStep('face');
                setLoading(false);
                return;
            }
            else {
                setError(errorMsg);
            }
            
            setStep('form');
            setLoading(false);
        }
    };

  // Paso 3: Capturar rostro y completar registro
    const handleFaceCapture = async (result: { detected: boolean; confidence: number; vector?: number[]; embedding?: Float32Array; message?: string }) => {
        console.log('[RegisterPage] handleFaceCapture called with result:', {
            detected: result.detected,
            confidence: result.confidence,
            hasVector: !!result.vector,
            vectorLength: result.vector?.length,
            message: result.message
        });

        if (!result.detected || !result.vector) {
            console.error('[RegisterPage] Face not detected or no vector');
            setError('No se pudo detectar el rostro correctamente');
            return;
        }

        setLoading(true);
        setError('');

        try {
            console.log('[RegisterPage] Sending face data to backend...');
            await authService.completeFaceRegistration({
                userId,
                faceVector: result.vector,
            });

            console.log('[RegisterPage] Face registration completed successfully!');

            // Registro completado exitosamente
            setStep('success');
            setRegisteredUser({
                _id: userId,
                email: formData.email,
                fullName: formData.fullName,
                role: 'client',
                isActive: true,
                failedLoginAttempts: 0,
            } as User);
        } 
        catch (err) {
            console.error('[RegisterPage] Face registration error:', err);
            const errorMsg = getErrorMessage(err);
            
            if (errorMsg.includes('Face already registered')) {
                setError('Este rostro ya está registrado en el sistema. Por favor, contacta al administrador.');
            } else {
                setError(errorMsg);
            }
        } 
        finally {
            setLoading(false);
        }
    };

    const handleFaceError = (error: Error) => {
        console.error('[RegisterPage] Face scanner error:', error);
        setError(error.message);
    };

    const handleFaceStatusChange = (status: string) => {
        console.log('[RegisterPage] Face scanner status changed:', status);
    };

    // Reiniciar proceso
    const handleReset = () => {
        setStep('form');
        setFormData({ email: '', fullName: '' });
        setUserId('');
        setError('');
        setRegisteredUser(null);
    };

    // Renderizar el paso actual
    return (
        <div className="register-page">
            <div className="register-container">
                <div className="register-header">
                    <h1>Registro de Usuario</h1>
                    <div className="step-indicator">
                        <div className={`step ${step === 'form' || step === 'webauthn' || step === 'face' || step === 'success' ? 'active' : ''}`}>
                            <span>1</span>
                            <p>Información</p>
                        </div>
                        <div className={`step ${step === 'webauthn' || step === 'face' || step === 'success' ? 'active' : ''}`}>
                            <span>2</span>
                            <p>Biometría</p>
                        </div>
                        <div className={`step ${step === 'face' || step === 'success' ? 'active' : ''}`}>
                            <span>3</span>
                            <p>Rostro</p>
                        </div>
                        <div className={`step ${step === 'success' ? 'active' : ''}`}>
                            <span>4</span>
                            <p>Completo</p>
                        </div>
                    </div>
                </div>

                {/* Error global */}
                {error && (
                <div className="error-message">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                    <p>{error}</p>
                </div>
                )}

                {/* Paso 1: Formulario */}
                {step === 'form' && (
                <div className="register-step">
                    <h2>Información Personal</h2>
                    <p className="step-description">
                    Ingresa tu información para crear una cuenta segura
                    </p>

                    <form onSubmit={handleFormSubmit} className="register-form">
                        <div className="form-group">
                            <label htmlFor="fullName">Nombre Completo</label>
                            <input
                                type="text"
                                id="fullName"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                placeholder="Juan Pérez"
                                required
                                autoComplete="name"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="juan@example.com"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !isFormValid()}
                        >
                            {loading ? 'Procesando...' : 'Continuar'}
                        </button>
                    </form>

                    <div className="info-box">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                        </svg>
                        <p>
                            <strong>Seguridad:</strong> Tu cuenta estará protegida con autenticación de dos factores:
                            biometría del dispositivo y reconocimiento facial.
                        </p>
                    </div>
                </div>
                )}

                {/* Paso 2: WebAuthn en progreso */}
                {step === 'webauthn' && (
                <div className="register-step">
                    <div className="loading-content">
                        <div className="spinner"></div>
                        <h2>Configurando Autenticación Biométrica</h2>
                        <p className="step-description">
                            Por favor, usa tu huella dactilar, Face ID o PIN para verificar tu identidad
                        </p>
                        <div className="info-box">
                            <p>
                            Tu dispositivo te pedirá que verifiques tu identidad usando el método
                            de autenticación que tengas configurado (huella, rostro o PIN)
                            </p>
                        </div>
                    </div>
                </div>
                )}

                {/* Paso 3: Captura facial */}
                {step === 'face' && (
                <div className="register-step">
                    <h2>Captura de Rostro</h2>
                    <p className="step-description">
                        Posiciona tu rostro frente a la cámara. La captura se realizará automáticamente.
                    </p>

                    <div className="face-scanner-wrapper">
                        {console.log('[RegisterPage] Rendering FaceScanner component')}
                        <FaceScanner
                            config={{
                                minConfidence: 0.6,
                                autoStart: true,
                                showOverlay: true,
                                timeout: 30000,
                                debugMode: true,
                            }}
                            onScanComplete={handleFaceCapture}
                            onError={handleFaceError}
                            onStatusChange={handleFaceStatusChange}
                        />
                    </div>

                    {loading && (
                        <div className="face-loading">
                            <div className="spinner"></div>
                            <p>Procesando rostro...</p>
                        </div>
                    )}

                    <div className="tips-box">
                        <h4>Consejos para una mejor captura:</h4>
                        <ul>
                            <li>Asegúrate de tener buena iluminación</li>
                            <li>Mira directamente a la cámara</li>
                            <li>Mantén tu rostro centrado</li>
                            <li>Evita usar lentes o accesorios que cubran tu rostro</li>
                        </ul>
                    </div>
                </div>
                )}

                {/* Paso 4: Registro exitoso */}
                {step === 'success' && registeredUser && (
                <div className="register-step success-step">
                    <div className="success-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                    </div>
                    
                    <h2>¡Registro Completado!</h2>
                    <p className="success-message">
                        Tu cuenta ha sido creada exitosamente, {registeredUser.fullName}
                    </p>

                    <div className="user-info">
                        <div className="info-item">
                            <span className="label">Email:</span>
                            <span className="value">{registeredUser.email}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Rol:</span>
                            <span className="value">{registeredUser.role}</span>
                        </div>
                    </div>

                    <div className="success-actions">
                        <a href="/login" className="btn btn-primary">
                            Ir al Login
                        </a>
                        <button onClick={handleReset} className="btn btn-secondary">
                            Registrar Otro Usuario
                        </button>
                    </div>

                    <div className="info-box">
                        <p>
                            <strong>Próximos pasos:</strong> Ahora puedes iniciar sesión usando tu
                            autenticación biométrica y reconocimiento facial.
                        </p>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}

export default RegisterPage;
