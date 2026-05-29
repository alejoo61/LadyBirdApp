'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/services/api/authApi';

type Mode = 'login' | 'register' | 'forgot';

export default function LoginPage() {
  const { login, registro } = useAuth();

  const [mode, setMode]           = useState<Mode>('login');
  const [email, setEmail]         = useState('');
  const [nombre, setNombre]       = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mensaje, setMensaje]     = useState('');
  const [loading, setLoading]     = useState(false);

  const reset = () => {
    setEmail(''); setNombre(''); setContrasena('');
    setConfirmar(''); setMensaje('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje('');

    // Validaciones frontend
    if (!email.endsWith('@ladybirdtaco.com')) {
      setMensaje('❌ Only @ladybirdtaco.com email addresses are allowed');
      return;
    }

    if (mode === 'register') {
      if (contrasena.length < 8) {
        setMensaje('❌ Password must be at least 8 characters');
        return;
      }
      if (!/[A-Z]/.test(contrasena) || !/[a-z]/.test(contrasena) || !/[0-9]/.test(contrasena)) {
        setMensaje('❌ Password must include uppercase, lowercase, and a number');
        return;
      }
      if (contrasena !== confirmar) {
        setMensaje('❌ Passwords do not match');
        return;
      }
    }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        await authApi.forgotPassword(email);
        setMensaje('✅ If that email exists, a reset link has been sent');
        setEmail('');
      } catch {
        setMensaje('❌ Error sending reset email');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, contrasena);
      } else {
        await registro(email, contrasena, nombre);
        setMensaje('✅ Account created successfully');
        reset();
        setMode('login');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setMensaje(`❌ ${error.response?.data?.error || 'Connection error'}`);
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Mode, string> = {
    login:    'Login',
    register: 'Create Account',
    forgot:   'Reset Password',
  };

  return (
    <main className="min-h-screen bg-night flex items-center justify-center p-4">
      <div className="bg-bone p-12 rounded-[3.5rem] shadow-2xl max-w-md w-full border border-tumbleweed">
        <div className="flex justify-center mb-10">
          <Image src="/logo.png" alt="LadyBird Logo" width={220} height={70} priority />
        </div>
        <div className="text-center mb-10">
          <p className="text-night/60 font-black uppercase text-xs tracking-[0.3em]">Access Management</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Email */}
          <input
            type="email"
            placeholder="Email (@ladybirdtaco.com)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full p-5 bg-white border border-tumbleweed rounded-[1.5rem] outline-none focus:ring-2 focus:ring-night transition-all text-night font-bold shadow-sm"
            required
          />

          {/* Nombre — solo en registro */}
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Full name"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full p-5 bg-white border border-tumbleweed rounded-[1.5rem] outline-none focus:ring-2 focus:ring-night transition-all text-night font-bold shadow-sm"
            />
          )}

          {/* Password — no en forgot */}
          {mode !== 'forgot' && (
            <input
              type="password"
              placeholder="Password"
              value={contrasena}
              onChange={e => setContrasena(e.target.value)}
              className="w-full p-5 bg-white border border-tumbleweed rounded-[1.5rem] outline-none focus:ring-2 focus:ring-night transition-all text-night font-bold shadow-sm"
              required
            />
          )}

          {/* Confirmar password — solo en registro */}
          {mode === 'register' && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              className="w-full p-5 bg-white border border-tumbleweed rounded-[1.5rem] outline-none focus:ring-2 focus:ring-night transition-all text-night font-bold shadow-sm"
              required
            />
          )}

          {/* Hint de password en registro */}
          {mode === 'register' && (
            <p className="text-[10px] text-night/40 font-bold uppercase tracking-widest text-center">
              Min 8 chars · uppercase · lowercase · number
            </p>
          )}

          {mensaje && (
            <div className={`p-4 rounded-2xl text-[10px] font-black text-center uppercase tracking-widest ${
              mensaje.includes('❌') ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {mensaje}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-night text-bone rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-night/90 transition-all transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-bone/30 border-t-bone rounded-full animate-spin" />
            )}
            {titles[mode]}
          </button>
        </form>

        {/* Links de navegación */}
        <div className="mt-10 flex flex-col gap-3">
          {mode === 'login' && (
            <>
              <button
                onClick={() => { setMode('register'); reset(); }}
                className="w-full text-[10px] font-black uppercase tracking-[0.3em] text-night/30 hover:text-night transition-colors"
              >
                Sign Up Now
              </button>
              <button
                onClick={() => { setMode('forgot'); reset(); }}
                className="w-full text-[10px] font-black uppercase tracking-[0.3em] text-night/20 hover:text-night/60 transition-colors"
              >
                Forgot Password?
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button
              onClick={() => { setMode('login'); reset(); }}
              className="w-full text-[10px] font-black uppercase tracking-[0.3em] text-night/30 hover:text-night transition-colors"
            >
              Back to Login
            </button>
          )}
        </div>
      </div>
    </main>
  );
}