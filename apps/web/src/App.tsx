import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Ammunition } from './pages/Ammunition';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Reports } from './pages/Reports';
import { Sessions } from './pages/Sessions';
import { WeaponDetail } from './pages/WeaponDetail';
import { Weapons } from './pages/Weapons';
import { Locations } from './pages/Locations';
import { Admin } from './pages/Admin';
import { AccountSettings } from './pages/AccountSettings';
import { Badges } from './pages/Badges';
import { Feedback } from './pages/Feedback';
import { AdminFeedback } from './pages/AdminFeedback';

export function App() {
  const { user, isLoading } = useAuth();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('huntledger.session_expired')) {
      setSessionExpired(true);
      sessionStorage.removeItem('huntledger.session_expired');
    }
  }, []);

  if (isLoading) {
    return <div className="centered">Loading…</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : (
        <>
          {sessionExpired && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0,
              background: '#c45a4a', color: '#fff', textAlign: 'center',
              padding: '12px 16px', zIndex: 9999, fontSize: 14, fontWeight: 500,
            }}>
              Din session har gått ut. Logga in igen.
            </div>
          )}
          <Login />
        </>
      )} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="sessions" element={<Sessions />} />
          <Route path="locations" element={<Locations />} />
        <Route path="weapons" element={<Weapons />} />
        <Route path="weapons/:id" element={<WeaponDetail />} />
        <Route path="ammunition" element={<Ammunition />} />
        <Route path="reports" element={<Reports />} />
          <Route path="admin" element={(user as any)?.isAdmin ? <Admin /> : <Navigate to="/" />} />
          <Route path="settings" element={user ? <AccountSettings /> : <Navigate to="/login" />} />
          <Route path="badges" element={user ? <Badges /> : <Navigate to="/login" />} />
          <Route path="feedback" element={user ? <Feedback /> : <Navigate to="/login" />} />
          <Route path="feedback-admin" element={(user as any)?.isAdmin ? <AdminFeedback /> : <Navigate to="/" />} />
          <Route path="overview" element={<Dashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}