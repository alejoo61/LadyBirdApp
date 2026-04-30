'use client';

import { useState } from 'react';
import Image from 'next/image';
import { authApi } from '@/services/api/authApi';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import CateringOrdersList from '@/components/CateringOrdersList';
import StoreList from '@/components/StoresList';
import EquipmentList from '@/components/EquipmentList';
import FormulaManager from '@/components/FormulaManager';
import NewOrderWizard from '@/components/NewOrderWizard';
import type { Store } from '@/services/api/storesApi';

interface Usuario {
  id: number;
  usuario: string;
}

interface ApiError {
  response?: { data?: { error?: string } };
}

export default function Home() {
  const [isLogin, setIsLogin]                 = useState(true);
  const [usuario, setUsuario]                 = useState('');
  const [contrasena, setContrasena]           = useState('');
  const [mensaje, setMensaje]                 = useState('');
  const [usuarioLogueado, setUsuarioLogueado] = useState<Usuario | null>(null);
  const [activeTab, setActiveTab]             = useState('Dashboard');
  const [showNewOrder, setShowNewOrder]       = useState(false);
  const [stores, setStores]                   = useState<Store[]>([]);

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setMensaje('');
  try {
    if (isLogin) {
      const res = await authApi.login({ usuario, contrasena });
      setUsuarioLogueado(res.data.usuario);
      localStorage.setItem('lb_user', JSON.stringify(res.data.usuario));
    } else {
      await authApi.registro({ usuario, contrasena });
      setIsLogin(true);
      setMensaje('✅ Registration successful. Please login.');
    }
  } catch (err: unknown) {
    const error = err as ApiError;
    setMensaje(`❌ ${error.response?.data?.error || 'Connection error'}`);
  }
};

  const handleLogout = () => {
    setUsuarioLogueado(null);
    localStorage.removeItem('lb_user');
    setUsuario('');
    setContrasena('');
    setMensaje('');
    setActiveTab('Dashboard');
    setShowNewOrder(false);
  };

  if (usuarioLogueado) {
    return (
      <div className="flex h-screen bg-bone">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          usuario={usuarioLogueado}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto p-10 bg-bone">
          {activeTab === 'Dashboard'   && <Dashboard usuario={usuarioLogueado.usuario} />}
          {activeTab === 'Catering'    && (
            <CateringOrdersList
              onNewOrder={(storeList) => {
                if (storeList) setStores(storeList);
                setShowNewOrder(true);
              }}
            />
          )}
          {activeTab === 'Formulas'    && <FormulaManager />}
          {activeTab === 'Stores'      && <StoreList />}
          {activeTab === 'Equipments'  && <EquipmentList />}
          {activeTab === 'Maintenance' && <Dashboard usuario={usuarioLogueado.usuario} />}
        </main>

        {showNewOrder && (
          <NewOrderWizard
            stores={stores}
            onClose={() => setShowNewOrder(false)}
            onSave={() => {
              setShowNewOrder(false);
              setActiveTab('Catering');
            }}
          />
        )}
      </div>
    );
  }

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
          <input type="text" placeholder="Username" value={usuario}
            onChange={e => setUsuario(e.target.value)}
            className="w-full p-5 bg-white border border-tumbleweed rounded-[1.5rem] outline-none focus:ring-2 focus:ring-night transition-all text-night font-bold shadow-sm"
            required />
          <input type="password" placeholder="Password" value={contrasena}
            onChange={e => setContrasena(e.target.value)}
            className="w-full p-5 bg-white border border-tumbleweed rounded-[1.5rem] outline-none focus:ring-2 focus:ring-night transition-all text-night font-bold shadow-sm"
            required />
          {mensaje && (
            <div className={`p-4 rounded-2xl text-[10px] font-black text-center uppercase tracking-widest ${
              mensaje.includes('❌') ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {mensaje}
            </div>
          )}
          <button type="submit"
            className="w-full py-5 bg-night text-bone rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-night/90 transition-all transform active:scale-95">
            {isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>
        <button onClick={() => { setIsLogin(!isLogin); setMensaje(''); }}
          className="w-full mt-10 text-[10px] font-black uppercase tracking-[0.3em] text-night/30 hover:text-night transition-colors">
          {isLogin ? 'Sign Up Now' : 'Back to Login'}
        </button>
      </div>
    </main>
  );
}