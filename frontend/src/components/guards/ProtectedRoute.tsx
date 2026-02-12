import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context';
import './ProtectedRoute.css';

interface ProtectedRouteProps {
  allowedRoles: ('admin' | 'client')[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();

  // Mostrar loading mientras se carga el estado de autenticación
  if (isLoading) {
    return (
      <div className="protected-route-loading">
        Cargando sesión...
      </div>
    );
  }

  // Si no hay usuario autenticado, redirigir al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si el usuario no tiene el rol permitido, redirigir a unauthorized
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Si todo está bien, renderizar las rutas hijas
  return <Outlet />;
};

export default ProtectedRoute;
