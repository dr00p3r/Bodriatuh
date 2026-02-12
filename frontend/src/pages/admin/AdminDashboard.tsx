import { useState, useEffect } from 'react';
import { useAuth } from '@/context';
import { userService, authService, getErrorMessage } from '@/api';
import { startRegistration } from '@simplewebauthn/browser';
import { FaceScanner } from '@/components/biometrics/FaceScanner';
import type { User } from '@/types';
import './AdminDashboard.css';

type ViewMode = 'dashboard' | 'create' | 'edit';
type CreateStep = 'form' | 'webauthn' | 'face' | 'success';

interface CreateUserFormData {
  email: string;
  fullName: string;
  role: 'client' | 'admin';
}

interface EditUserFormData {
  fullName: string;
  role: 'client' | 'admin';
  isActive: boolean;
}

export function AdminDashboard() {
  const { user: currentUser, logout } = useAuth();
  
  // Estado general
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Estado para crear usuario
  const [createStep, setCreateStep] = useState<CreateStep>('form');
  const [createFormData, setCreateFormData] = useState<CreateUserFormData>({
    email: '',
    fullName: '',
    role: 'client',
  });
  const [newUserId, setNewUserId] = useState<string>('');

  // Estado para editar usuario
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState<EditUserFormData>({
    fullName: '',
    role: 'client',
    isActive: true,
  });

  // Cargar usuarios al montar
  useEffect(() => {
    loadUsers();
  }, []);

  // Cargar lista de usuarios
  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userService.getAllUsers();
      setUsers(response.users);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Filtrar usuarios por búsqueda
  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // === CREAR USUARIO ===

  const isCreateFormValid = (): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (
      createFormData.email.trim() !== '' &&
      createFormData.fullName.trim() !== '' &&
      emailRegex.test(createFormData.email)
    );
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isCreateFormValid()) {
      setError('Por favor, completa todos los campos correctamente');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Iniciar proceso de registro
      const startData = await authService.startRegistration({
        email: createFormData.email,
        fullName: createFormData.fullName,
      });

      setNewUserId(startData.userId);
      setCreateStep('webauthn');
      
      // Ejecutar WebAuthn automáticamente
      await handleCreateWebAuthn(startData.options, startData.userId);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  const handleCreateWebAuthn = async (options: any, uid: string) => {
    try {
      const credential = await startRegistration(options);
      await authService.verifyRegistration({
        userId: uid,
        response: credential,
      });

      setCreateStep('face');
      setLoading(false);
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      
      if (errorMsg.includes('NotAllowedError')) {
        setError('Registro cancelado por el usuario.');
      } else if (errorMsg.includes('NotSupportedError')) {
        setError('El dispositivo no soporta autenticación biométrica.');
      } else {
        setError(errorMsg);
      }
      
      setCreateStep('form');
      setLoading(false);
    }
  };

  const handleCreateFaceCapture = async (result: {
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
      await authService.completeFaceRegistration({
        userId: newUserId,
        faceVector: result.vector,
      });

      // Actualizar rol si es necesario
      if (createFormData.role === 'admin') {
        await userService.updateUser(newUserId, {
          role: 'admin',
        });
      }

      setCreateStep('success');
      setSuccess(`Usuario ${createFormData.fullName} creado exitosamente`);
      
      // Recargar lista de usuarios
      await loadUsers();
      
      // Resetear formulario después de 2 segundos
      setTimeout(() => {
        resetCreateForm();
        setViewMode('dashboard');
      }, 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFaceError = (error: Error) => {
    setError(error.message);
  };

  const resetCreateForm = () => {
    setCreateStep('form');
    setCreateFormData({ email: '', fullName: '', role: 'client' });
    setNewUserId('');
    setError('');
    setSuccess('');
  };

  // === EDITAR USUARIO ===

  const startEditUser = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    });
    setViewMode('edit');
    setError('');
    setSuccess('');
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await userService.updateUser(selectedUser._id, editFormData);
      
      setSuccess(`Usuario ${editFormData.fullName} actualizado exitosamente`);
      await loadUsers();
      
      setTimeout(() => {
        setViewMode('dashboard');
        setSelectedUser(null);
      }, 1500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setViewMode('dashboard');
    setSelectedUser(null);
    setError('');
    setSuccess('');
  };

  // === OTRAS ACCIONES ===

  const handleUnlockUser = async (userId: string, userName: string) => {
    if (!confirm(`¿Desbloquear cuenta de ${userName}?`)) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await userService.unlockUser(userId);
      setSuccess(`Cuenta de ${userName} desbloqueada exitosamente`);
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`¿Estás seguro de desactivar la cuenta de ${userName}?`)) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await userService.deleteUser(userId);
      setSuccess(`Usuario ${userName} desactivado exitosamente`);
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('¿Cerrar sesión?')) {
      logout();
      window.location.href = '/login';
    }
  };

  // === RENDERIZADO ===

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Panel de Administración</h1>
            <p>Bienvenido, {currentUser?.fullName}</p>
          </div>
          <div className="header-right">
            <button onClick={handleLogout} className="btn btn-logout">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="dashboard-nav">
        <button
          className={`nav-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
          onClick={() => setViewMode('dashboard')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          Dashboard
        </button>
        <button
          className={`nav-btn ${viewMode === 'create' ? 'active' : ''}`}
          onClick={() => {
            resetCreateForm();
            setViewMode('create');
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
          </svg>
          Crear Usuario
        </button>
      </nav>

      <main className="dashboard-main">
        {/* Mensajes globales */}
        {error && (
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <p>{success}</p>
          </div>
        )}

        {/* Vista Dashboard */}
        {viewMode === 'dashboard' && (
          <div className="dashboard-view">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
                  </svg>
                </div>
                <div className="stat-content">
                  <p className="stat-label">Total Usuarios</p>
                  <p className="stat-value">{users.length}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon stat-icon-success">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="stat-content">
                  <p className="stat-label">Usuarios Activos</p>
                  <p className="stat-value">{users.filter(u => u.isActive).length}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon stat-icon-warning">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="stat-content">
                  <p className="stat-label">Cuentas Bloqueadas</p>
                  <p className="stat-value">{users.filter(u => u.failedLoginAttempts >= 5).length}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon stat-icon-admin">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.75z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="stat-content">
                  <p className="stat-label">Administradores</p>
                  <p className="stat-value">{users.filter(u => u.role === 'admin').length}</p>
                </div>
              </div>
            </div>

            {/* Búsqueda y tabla de usuarios */}
            <div className="users-section">
              <div className="section-header">
                <h2>Gestión de Usuarios</h2>
                <div className="search-box">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar por email o nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Cargando usuarios...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="empty-state">
                  <p>No se encontraron usuarios</p>
                </div>
              ) : (
                <div className="users-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Intentos Fallidos</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user._id}>
                          <td>
                            <div className="user-name">{user.fullName}</div>
                          </td>
                          <td>{user.email}</td>
                          <td>
                            <span className={`badge badge-${user.role}`}>
                              {user.role === 'admin' ? 'Admin' : 'Cliente'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${user.isActive ? 'status-active' : 'status-inactive'}`}>
                              {user.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>
                            <span className={user.failedLoginAttempts >= 5 ? 'text-danger' : ''}>
                              {user.failedLoginAttempts}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn-icon btn-icon-edit"
                                onClick={() => startEditUser(user)}
                                title="Editar"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                                </svg>
                              </button>
                              
                              {user.failedLoginAttempts >= 5 && (
                                <button
                                  className="btn-icon btn-icon-unlock"
                                  onClick={() => handleUnlockUser(user._id, user.fullName)}
                                  title="Desbloquear"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M14.5 1A4.5 4.5 0 0010 5.5V9H3a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1.5V5.5a3 3 0 116 0v2.75a.75.75 0 001.5 0V5.5A4.5 4.5 0 0014.5 1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              )}
                              
                              {user._id !== currentUser?._id && (
                                <button
                                  className="btn-icon btn-icon-delete"
                                  onClick={() => handleDeleteUser(user._id, user.fullName)}
                                  title="Desactivar"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vista Crear Usuario */}
        {viewMode === 'create' && (
          <div className="create-view">
            <div className="create-container">
              <div className="create-header">
                <h2>Crear Nuevo Usuario</h2>
                <div className="step-indicator">
                  <div className={`step ${createStep === 'form' || createStep === 'webauthn' || createStep === 'face' || createStep === 'success' ? 'active' : ''}`}>
                    <span>1</span>
                    <p>Datos</p>
                  </div>
                  <div className={`step ${createStep === 'webauthn' || createStep === 'face' || createStep === 'success' ? 'active' : ''}`}>
                    <span>2</span>
                    <p>Biometría</p>
                  </div>
                  <div className={`step ${createStep === 'face' || createStep === 'success' ? 'active' : ''}`}>
                    <span>3</span>
                    <p>Rostro</p>
                  </div>
                  <div className={`step ${createStep === 'success' ? 'active' : ''}`}>
                    <span>4</span>
                    <p>Completo</p>
                  </div>
                </div>
              </div>

              {createStep === 'form' && (
                <form onSubmit={handleCreateUserSubmit} className="create-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="fullName">Nombre Completo *</label>
                      <input
                        type="text"
                        id="fullName"
                        value={createFormData.fullName}
                        onChange={(e) => setCreateFormData({ ...createFormData, fullName: e.target.value })}
                        placeholder="Juan Pérez"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">Email *</label>
                      <input
                        type="email"
                        id="email"
                        value={createFormData.email}
                        onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                        placeholder="juan@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="role">Rol *</label>
                    <select
                      id="role"
                      value={createFormData.role}
                      onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value as 'client' | 'admin' })}
                      required
                    >
                      <option value="client">Cliente</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        resetCreateForm();
                        setViewMode('dashboard');
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading || !isCreateFormValid()}
                    >
                      {loading ? 'Procesando...' : 'Continuar'}
                    </button>
                  </div>
                </form>
              )}

              {createStep === 'webauthn' && (
                <div className="create-step">
                  <div className="loading-content">
                    <div className="spinner"></div>
                    <h3>Configurando Autenticación Biométrica</h3>
                    <p>El nuevo usuario debe usar su huella dactilar, Face ID o PIN</p>
                  </div>
                </div>
              )}

              {createStep === 'face' && (
                <div className="create-step">
                  <h3>Captura de Rostro</h3>
                  <p>El usuario debe posicionar su rostro frente a la cámara</p>

                  <div className="face-scanner-wrapper">
                    <FaceScanner
                      config={{
                        minConfidence: 0.75,
                        autoStart: true,
                        showOverlay: true,
                        timeout: 30000,
                      }}
                      onScanComplete={handleCreateFaceCapture}
                      onError={handleCreateFaceError}
                    />
                  </div>

                  {loading && (
                    <div className="face-loading">
                      <div className="spinner"></div>
                      <p>Procesando rostro...</p>
                    </div>
                  )}
                </div>
              )}

              {createStep === 'success' && (
                <div className="create-step success-content">
                  <div className="success-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3>¡Usuario Creado!</h3>
                  <p>El usuario {createFormData.fullName} ha sido creado exitosamente</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vista Editar Usuario */}
        {viewMode === 'edit' && selectedUser && (
          <div className="edit-view">
            <div className="edit-container">
              <div className="edit-header">
                <h2>Editar Usuario</h2>
                <p>Modificando: {selectedUser.email}</p>
              </div>

              <form onSubmit={handleEditUserSubmit} className="edit-form">
                <div className="form-group">
                  <label htmlFor="editFullName">Nombre Completo *</label>
                  <input
                    type="text"
                    id="editFullName"
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="editRole">Rol *</label>
                  <select
                    id="editRole"
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as 'client' | 'admin' })}
                    required
                  >
                    <option value="client">Cliente</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={editFormData.isActive}
                      onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                    />
                    <span>Cuenta activa</span>
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={cancelEdit}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
