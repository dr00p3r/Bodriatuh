import { useState, useEffect } from 'react';
import { useAuth } from '@/context';
import { userService, getErrorMessage } from '@/api';
import type { User, AuthenticatorDevice } from '@/types';
import './ClientDashboard.css';

type ViewMode = 'dashboard' | 'edit-profile' | 'devices';

interface ProfileFormData {
  fullName: string;
}

export function ClientDashboard() {
  const { user: currentUser, login, logout } = useAuth();
  
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Datos del usuario actualizado
  const [userData, setUserData] = useState<User | null>(currentUser);
  
  // Formulario de edición
  const [profileFormData, setProfileFormData] = useState<ProfileFormData>({
    fullName: currentUser?.fullName || '',
  });

  // Dispositivos
  const [devices, setDevices] = useState<AuthenticatorDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Cargar datos del usuario al montar
  useEffect(() => {
    if (currentUser) {
      loadUserData();
    }
  }, [currentUser]);

  // Cargar datos actualizados del usuario
  const loadUserData = async () => {
    if (!currentUser) return;

    try {
      const response = await userService.getUserById(currentUser._id);
      setUserData(response.user);
      setProfileFormData({ fullName: response.user.fullName });
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  // Cargar dispositivos
  const loadDevices = async () => {
    if (!currentUser) return;

    setLoadingDevices(true);
    try {
      const response = await userService.getUserDevices(currentUser._id);
      setDevices(response.devices);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingDevices(false);
    }
  };

  // Formatear fecha
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No disponible';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Calcular días desde el registro
  const getDaysSinceRegistration = () => {
    if (!userData?.createdAt) return null;
    
    const registrationDate = new Date(userData.createdAt);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - registrationDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // Actualizar perfil
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) return;

    if (profileFormData.fullName.trim() === '') {
      setError('El nombre no puede estar vacío');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await userService.updateUser(currentUser._id, {
        fullName: profileFormData.fullName,
      });

      // Actualizar datos locales
      const updatedUser = { ...currentUser, fullName: profileFormData.fullName };
      login(updatedUser); // Actualizar en el contexto
      setUserData(updatedUser);
      
      setSuccess('Perfil actualizado correctamente');
      
      setTimeout(() => {
        setViewMode('dashboard');
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Eliminar dispositivo
  const handleRemoveDevice = async (credentialId: string) => {
    if (!currentUser) return;
    
    if (!confirm('¿Estás seguro de eliminar este dispositivo? No podrás iniciar sesión con él.')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await userService.removeDevice(currentUser._id, credentialId);
      setSuccess('Dispositivo eliminado correctamente');
      await loadDevices();
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

  if (!userData) {
    return (
      <div className="client-dashboard">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  const daysSinceRegistration = getDaysSinceRegistration();

  return (
    <div className="client-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Mi Panel</h1>
            <p>Bienvenido, {userData.fullName}</p>
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
          onClick={() => {
            setViewMode('dashboard');
            setError('');
            setSuccess('');
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          Inicio
        </button>
        <button
          className={`nav-btn ${viewMode === 'edit-profile' ? 'active' : ''}`}
          onClick={() => {
            setViewMode('edit-profile');
            setError('');
            setSuccess('');
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
          </svg>
          Editar Perfil
        </button>
        <button
          className={`nav-btn ${viewMode === 'devices' ? 'active' : ''}`}
          onClick={() => {
            setViewMode('devices');
            setError('');
            setSuccess('');
            loadDevices();
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.484-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z" clipRule="evenodd" />
          </svg>
          Dispositivos
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
            {/* Welcome Card */}
            <div className="welcome-card">
              <div className="welcome-content">
                <h2>¡Hola, {userData.fullName}! 👋</h2>
                <p>Bienvenido a tu panel personal. Aquí puedes ver tu información y gestionar tu cuenta.</p>
                {daysSinceRegistration !== null && (
                  <div className="welcome-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                    </svg>
                    {daysSinceRegistration === 0 ? 'Registrado hoy' : `${daysSinceRegistration} días con nosotros`}
                  </div>
                )}
              </div>
              <div className="welcome-avatar">
                <div className="avatar">
                  {userData.fullName.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Profile Card */}
            <div className="profile-section">
              <div className="section-header">
                <h2>Mi Perfil</h2>
                <button
                  className="btn btn-edit"
                  onClick={() => setViewMode('edit-profile')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                  </svg>
                  Editar
                </button>
              </div>

              <div className="profile-card">
                <div className="profile-item">
                  <div className="profile-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                    </svg>
                  </div>
                  <div className="profile-content">
                    <p className="profile-label">Nombre Completo</p>
                    <p className="profile-value">{userData.fullName}</p>
                  </div>
                </div>

                <div className="profile-item">
                  <div className="profile-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                      <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                    </svg>
                  </div>
                  <div className="profile-content">
                    <p className="profile-label">Correo Electrónico</p>
                    <p className="profile-value">{userData.email}</p>
                  </div>
                </div>

                <div className="profile-item">
                  <div className="profile-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="profile-content">
                    <p className="profile-label">Fecha de Registro</p>
                    <p className="profile-value">{formatDate(userData.createdAt)}</p>
                  </div>
                </div>

                {userData.lastLogin && (
                  <div className="profile-item">
                    <div className="profile-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="profile-content">
                      <p className="profile-label">Último Acceso</p>
                      <p className="profile-value">{formatDate(userData.lastLogin)}</p>
                    </div>
                  </div>
                )}

                <div className="profile-item">
                  <div className="profile-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.75z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="profile-content">
                    <p className="profile-label">Rol</p>
                    <p className="profile-value">
                      <span className="badge badge-client">Cliente</span>
                    </p>
                  </div>
                </div>

                <div className="profile-item">
                  <div className="profile-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="profile-content">
                    <p className="profile-label">Estado de la Cuenta</p>
                    <p className="profile-value">
                      <span className={`status-badge ${userData.isActive ? 'status-active' : 'status-inactive'}`}>
                        {userData.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Info */}
            <div className="info-card">
              <div className="info-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="info-content">
                <h3>Seguridad de tu Cuenta</h3>
                <p>
                  Tu cuenta está protegida con autenticación de dos factores: biometría del dispositivo 
                  y reconocimiento facial. Puedes gestionar tus dispositivos en la sección "Dispositivos".
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vista Editar Perfil */}
        {viewMode === 'edit-profile' && (
          <div className="edit-profile-view">
            <div className="edit-profile-container">
              <div className="edit-profile-header">
                <h2>Editar Perfil</h2>
                <p>Actualiza tu información personal</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="edit-profile-form">
                <div className="form-group">
                  <label htmlFor="fullName">Nombre Completo</label>
                  <input
                    type="text"
                    id="fullName"
                    value={profileFormData.fullName}
                    onChange={(e) => setProfileFormData({ fullName: e.target.value })}
                    placeholder="Tu nombre completo"
                    required
                  />
                  <p className="field-hint">Este nombre se mostrará en tu perfil</p>
                </div>

                <div className="form-group">
                  <label>Correo Electrónico</label>
                  <input
                    type="email"
                    value={userData.email}
                    disabled
                    className="input-disabled"
                  />
                  <p className="field-hint">El correo electrónico no puede ser modificado</p>
                </div>

                <div className="info-box">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                  </svg>
                  <p>
                    Por seguridad, algunos campos como el correo electrónico y el rol no pueden ser modificados.
                    Si necesitas cambiar estos datos, contacta a un administrador.
                  </p>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setViewMode('dashboard');
                      setProfileFormData({ fullName: userData.fullName });
                    }}
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

        {/* Vista Dispositivos */}
        {viewMode === 'devices' && (
          <div className="devices-view">
            <div className="devices-container">
              <div className="devices-header">
                <h2>Mis Dispositivos</h2>
                <p>Gestiona los dispositivos con acceso a tu cuenta</p>
              </div>

              {loadingDevices ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Cargando dispositivos...</p>
                </div>
              ) : devices.length === 0 ? (
                <div className="empty-state">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.484-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z" clipRule="evenodd" />
                  </svg>
                  <p>No hay dispositivos registrados</p>
                </div>
              ) : (
                <div className="devices-list">
                  {devices.map((device, index) => (
                    <div key={device.credentialID} className="device-card">
                      <div className="device-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.484-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="device-content">
                        <h3>Dispositivo {index + 1}</h3>
                        <p className="device-id">ID: {device.credentialID.slice(0, 20)}...</p>
                        <p className="device-counter">Usos: {device.counter}</p>
                        {device.transports.length > 0 && (
                          <div className="device-transports">
                            {device.transports.map((transport) => (
                              <span key={transport} className="transport-badge">
                                {transport}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="device-actions">
                        <button
                          className="btn-icon btn-icon-delete"
                          onClick={() => handleRemoveDevice(device.credentialID)}
                          title="Eliminar dispositivo"
                          disabled={devices.length === 1}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {devices.length === 1 && (
                <div className="warning-box">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <p>
                    <strong>Advertencia:</strong> Este es tu único dispositivo. No podrás eliminarlo 
                    sin perder acceso a tu cuenta. Registra otro dispositivo antes de eliminar este.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ClientDashboard;
