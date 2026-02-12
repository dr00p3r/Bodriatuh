import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context';
import { ProtectedRoute, GuestRoute } from '@/components/guards';

// Auth Pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { UnauthorizedPage } from '@/pages/auth/UnauthorizedPage';

// Admin Pages
import { AdminDashboard } from '@/pages/admin/AdminDashboard';

// Client Pages
import { ClientDashboard } from '@/pages/client/ClientDashboard';

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Guest Routes — redirige a dashboard si ya tiene sesión */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Admin Routes - Protected */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          {/* Client Routes - Protected */}
          <Route element={<ProtectedRoute allowedRoles={['client']} />}>
            <Route path="/dashboard" element={<ClientDashboard />} />
          </Route>

          {/* Default Route - Redirect to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Catch all - Redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
