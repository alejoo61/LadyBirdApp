'use client';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import LoginPage from '@/components/LoginPage';
import AppLayout from '@/components/AppLayout';

function AppContent() {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-night flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-bone/20 border-t-bone rounded-full animate-spin" />
      </main>
    );
  }

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