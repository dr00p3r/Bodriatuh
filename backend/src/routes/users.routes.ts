import { Router } from 'express';
import UsersController from '../controllers/UsersController.js';

const router = Router();

// CRUD de usuarios
router.get('/', UsersController.getAllUsers.bind(UsersController));
router.get('/:id', UsersController.getUserById.bind(UsersController));
router.put('/:id', UsersController.updateUser.bind(UsersController));
router.delete('/:id', UsersController.deleteUser.bind(UsersController));

// Gestión de cuenta
router.post('/:id/unlock', UsersController.unlockUser.bind(UsersController));

// Gestión biométrica
router.put('/:id/face', UsersController.updateFaceVector.bind(UsersController));

// Gestión de dispositivos
router.get('/:id/devices', UsersController.getUserDevices.bind(UsersController));
router.delete('/:id/devices/:credentialId', UsersController.removeDevice.bind(UsersController));

export default router;
