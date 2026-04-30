'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login, registro } = useAuth();

  const [isLogin, setIsLogin]     = useState(true);
  const [usuario, setUsuario]     = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mensaje, setMensaje]     = useState('');
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(usuario, contrasena);
      } else {
        await registro(usuario, contrasena);
        setIsLogin(true);
        setMensaje('✅ Registration successful. Please login.');
        setUsuario('');
        setContrasena('');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setMensaje(`❌ ${error.response?.data?.error || 'Connection error'}`);
    } finally {
      setLoading(false);
    }
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
          <input
            type="text"
            placeholder="Username"
            value={usuario}
            onChange={e => setUsuario(e.target.value)}
            className="w-full p-5 bg-white border border-tumbleweed rounded-[1.5rem] outline-none focus:ring-2 focus:ring-night transition-all text-night font-bold shadow-sm"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={contrasena}
            onChange={e => setContrasena(e.target.value)}
            className="w-full p-5 bg-white border border-tumbleweed rounded-[1.5rem] outline-none focus:ring-2 focus:ring-night transition-all text-night font-bold shadow-sm"
            required
          />

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
            {isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setMensaje(''); }}
          className="w-full mt-10 text-[10px] font-black uppercase tracking-[0.3em] text-night/30 hover:text-night transition-colors"
        >
          {isLogin ? 'Sign Up Now' : 'Back to Login'}
        </button>
      </div>
    </main>
  );
}