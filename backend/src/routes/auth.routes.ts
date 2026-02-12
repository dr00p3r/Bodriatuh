import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';

const router = Router();

// Registro
router.post('/register/start', AuthController.startRegistration.bind(AuthController));
router.post('/register/verify', AuthController.verifyRegistration.bind(AuthController));
router.post('/register/face', AuthController.completeFaceRegistration.bind(AuthController));

// Login
router.post('/login/start', AuthController.startAuthentication.bind(AuthController));
router.post('/login/verify', AuthController.verifyAuthentication.bind(AuthController));
router.post('/login/face', AuthController.verifyFaceLogin.bind(AuthController));

// Identificación por rostro
router.post('/identify', AuthController.identifyByFace.bind(AuthController));

export default router;
