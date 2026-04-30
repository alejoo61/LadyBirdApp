'use client';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import LoginPage from '@/components/LoginPage';
import AppLayout from '@/components/AppLayout';

function AppContent() {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <AppLayout /> : <LoginPage />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}