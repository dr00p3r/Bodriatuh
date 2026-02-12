import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { FaceScanner } from '@/components/biometrics/FaceScanner';
import { authService, getErrorMessage } from '@/api';
import { useAuth } from '@/context';
import type { User } from '@/types';
import './LoginPage.css';

type LoginStep = 'form' | 'webauthn' | 'face' | 'success';

const MAX_FACE_RETRIES = 3;

interface FormData {
  email: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [step, setStep] = useState<LoginStep>('form');
  const [formData, setFormData] = useState<FormData>({ email: '' });
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null);
  const [faceRetries, setFaceRetries] = useState(0);
  const [faceScanKey, setFaceScanKey] = useState(0);

  // Validación de email
  const isEmailValid = (): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return formData.email.trim() !== '' && emailRegex.test(formData.email);
  };

  // Paso 1: Enviar email e iniciar login WebAuthn
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEmailValid()) {
      setError('Por favor, ingresa un email válido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Iniciar proceso de login
      const startData = await authService.startLogin({
        email: formData.email,
      });

      // Pasar al paso de WebAuthn
      setStep('webauthn');

      // Ejecutar WebAuthn automáticamente
      await handleWebAuthn(startData.options);
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      
      if (errorMsg.includes('User not found')) {
        setError('Usuario no encontrado. Por favor, regístrate primero.');
      } else if (errorMsg.includes('Account locked')) {
        setError('Cuenta bloqueada por múltiples intentos fallidos. Contacta al administrador.');
      } else {
        setError(errorMsg);
      }
      
      setLoading(false);
      setStep('form');
    }
  };

  // Paso 2: Ejecutar WebAuthn
  const handleWebAuthn = async (options: any) => {
    try {
      // Autenticar con WebAuthn
      const credential = await startAuthentication(options);

      // Verificar credencial en el backend (Primera capa)
      const verifyData = await authService.verifyLogin({
        response: credential,
      });

      // Guardar userId para el paso de facial
      setUserId(verifyData.userId);

      // Pasar al paso de captura facial
      setStep('face');
      setLoading(false);
    } catch (err) {
      const errorMsg = getErrorMessage(err);

      if (errorMsg.includes('NotAllowedError')) {
        setError('Autenticación cancelada. Por favor, intenta de nuevo.');
      } else if (errorMsg.includes('NotSupportedError')) {
        setError('Tu dispositivo no soporta autenticación biométrica.');
      } else if (errorMsg.includes('Invalid credentials')) {
        setError('Credenciales inválidas. Verifica tu dispositivo.');
      } else {
        setError(errorMsg);
      }

      setStep('form');
      setLoading(false);
    }
  };

  // Paso 3: Verificar rostro y completar login
  const handleFaceVerification = async (result: {
    detected: boolean;
    confidence: number;
    vector?: number[];
    embedding?: Float32Array;
    message?: string;
  }) => {
    if (!result.detected || !result.vector) {
      setError('No se pudo detectar el rostro correctamente');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verificar rostro (Segunda capa)
      const faceData = await authService.verifyFaceLogin({
        userId,
        faceVector: result.vector,
      });

      // Login completado exitosamente
      const user = faceData.user;
      
      // Guardar usuario en el contexto y localStorage
      login(user);
      
      setAuthenticatedUser(user);
      setStep('success');

      // Redirigir según el rol después de un breve delay
      setTimeout(() => {
        if (user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }, 2000);
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      const newRetries = faceRetries + 1;
      setFaceRetries(newRetries);

      if (errorMsg.includes('Account locked')) {
        setError('Cuenta bloqueada por múltiples intentos fallidos. Contacta al administrador.');
        setTimeout(() => {
          setStep('form');
          setUserId('');
          setFaceRetries(0);
        }, 3000);
      } else if (newRetries >= MAX_FACE_RETRIES) {
        setError(`Verificación facial fallida ${MAX_FACE_RETRIES} veces. Intenta de nuevo desde el inicio.`);
        setTimeout(() => {
          setStep('form');
          setUserId('');
          setFaceRetries(0);
        }, 4000);
      } else {
        setError(`El rostro no coincide (intento ${newRetries}/${MAX_FACE_RETRIES}). Acomódate bien e intenta de nuevo.`);
        // Reiniciar el scanner para permitir reintento sin salir del paso facial
        setFaceScanKey(prev => prev + 1);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFaceError = (error: Error) => {
    setError(error.message);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Iniciar Sesión</h1>
          <div className="step-indicator">
            <div className={`step ${step === 'form' || step === 'webauthn' || step === 'face' || step === 'success' ? 'active' : ''}`}>
              <span>1</span>
              <p>Email</p>
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
              <p>Acceso</p>
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

        {/* Paso 1: Formulario de Email */}
        {step === 'form' && (
          <div className="login-step">
            <h2>Bienvenido</h2>
            <p className="step-description">
              Ingresa tu email para iniciar sesión de forma segura
            </p>

            <form onSubmit={handleFormSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ email: e.target.value })}
                  placeholder="juan@example.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !isEmailValid()}
              >
                {loading ? 'Procesando...' : 'Continuar'}
              </button>
            </form>

            <div className="info-box">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
              </svg>
              <p>
                <strong>Seguridad:</strong> Tu inicio de sesión está protegido con autenticación
                de dos factores: biometría del dispositivo y reconocimiento facial.
              </p>
            </div>

            <div className="register-link">
              <p>
                ¿No tienes cuenta?{' '}
                <a href="/register">Regístrate aquí</a>
              </p>
            </div>
          </div>
        )}

        {/* Paso 2: WebAuthn en progreso */}
        {step === 'webauthn' && (
          <div className="login-step">
            <div className="loading-content">
              <div className="spinner"></div>
              <h2>Verificando Identidad</h2>
              <p className="step-description">
                Por favor, usa tu huella dactilar, Face ID o PIN para autenticarte
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
          <div className="login-step">
            <h2>Verificación Facial</h2>
            <p className="step-description">
              Posiciona tu rostro frente a la cámara para completar la autenticación.
            </p>

            <div className="face-scanner-wrapper">
              <FaceScanner
                key={faceScanKey}
                config={{
                  minConfidence: 0.75,
                  autoStart: true,
                  showOverlay: true,
                  timeout: 30000,
                }}
                onScanComplete={handleFaceVerification}
                onError={handleFaceError}
              />
            </div>

            {loading && (
              <div className="face-loading">
                <div className="spinner"></div>
                <p>Verificando rostro...</p>
              </div>
            )}

            <div className="tips-box">
              <h4>Consejos para una mejor verificación:</h4>
              <ul>
                <li>Asegúrate de tener buena iluminación</li>
                <li>Mira directamente a la cámara</li>
                <li>Mantén tu rostro centrado</li>
                <li>Usa la misma apariencia que al registrarte</li>
              </ul>
            </div>
          </div>
        )}

        {/* Paso 4: Login exitoso */}
        {step === 'success' && authenticatedUser && (
          <div className="login-step success-step">
            <div className="success-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            </div>
            <h2>¡Bienvenido de nuevo!</h2>
            <p className="success-message">
              Hola, {authenticatedUser.fullName}
            </p>

            <div className="user-info">
              <div className="info-item">
                <span className="label">Email:</span>
                <span className="value">{authenticatedUser.email}</span>
              </div>
              <div className="info-item">
                <span className="label">Rol:</span>
                <span className="value">{authenticatedUser.role}</span>
              </div>
            </div>

            <div className="redirect-message">
              <div className="spinner-small"></div>
              <p>Redirigiendo a tu panel...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
