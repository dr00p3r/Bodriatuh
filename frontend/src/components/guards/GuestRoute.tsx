import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context';

/**
 * GuestRoute — solo permite acceso a usuarios NO autenticados.
 * Si el usuario ya tiene sesión válida, lo redirige al dashboard.
 */
export const GuestRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // O un spinner si prefieres
  }

  if (user) {
    // Redirigir según rol
    const destination = user.role === 'admin' ? '/admin' : '/dashboard';
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
};

export default GuestRoute;
