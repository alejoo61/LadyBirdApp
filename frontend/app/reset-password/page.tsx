'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { authApi } from '@/services/api/authApi';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [token, setToken]             = useState<string | null>(null);
  const [contrasena, setContrasena]   = useState('');
  const [confirmar, setConfirmar]     = useState('');
  const [mensaje, setMensaje]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);

  // Leer token del URL en el cliente sin useSearchParams
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      setMensaje('❌ Invalid or missing reset token');
    } else {
      setToken(t);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje('');

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

    setLoading(true);
    try {
      await authApi.resetPassword(token!, contrasena);
      setSuccess(true);
      setMensaje('✅ Password updated successfully');
      setTimeout(() => router.push('/'), 2500);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setMensaje(`❌ ${error.response?.data?.error || 'Invalid or expired token'}`);
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
          <p className="text-night/60 font-black uppercase text-xs tracking-[0.3em]">
            {success ? 'Password Updated' : 'Set New Password'}
          </p>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <input
              type="password"
              placeholder="New password"
              value={contrasena}
              onChange={e => setContrasena(e.target.value)}
              className="w-full p-5 bg-white border border-tumbleweed rounded-[1.5rem] outline-none focus:ring-2 focus:ring-night transition-all text-night font-bold shadow-sm"
              required
              disabled={!token}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              className="w-full p-5 bg-white border border-tumbleweed rounded-[1.5rem] outline-none focus:ring-2 focus:ring-night transition-all text-night font-bold shadow-sm"
              required
              disabled={!token}
            />

            <p className="text-[10px] text-night/40 font-bold uppercase tracking-widest text-center">
              Min 8 chars · uppercase · lowercase · number
            </p>

            {mensaje && (
              <div className={`p-4 rounded-2xl text-[10px] font-black text-center uppercase tracking-widest ${
                mensaje.includes('❌') ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {mensaje}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-5 bg-night text-bone rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-night/90 transition-all transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-bone/30 border-t-bone rounded-full animate-spin" />
              )}
              Update Password
            </button>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <div className="text-5xl">✅</div>
            <p className="text-night/60 font-bold text-sm">
              Redirecting to login...
            </p>
          </div>
        )}

        <button
          onClick={() => router.push('/')}
          className="w-full mt-10 text-[10px] font-black uppercase tracking-[0.3em] text-night/30 hover:text-night transition-colors"
        >
          Back to Login
        </button>
      </div>
    </main>
  );
}