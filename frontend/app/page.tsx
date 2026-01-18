'use client';

import { useState } from 'react';
import Image from 'next/image';
import { authApi } from '@/services/api/authApi';
import EquipmentList from '@/components/EquipmentList';
import StoreList from '@/components/StoresList'; 
import { LayoutDashboard, Store, HardDrive, Wrench, LogOut } from 'lucide-react';

// Interfaces para TypeScript (Cero 'any')
interface Usuario {
  id: number;
  usuario: string;
}

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
}

export default function Home() {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [usuario, setUsuario] = useState<string>('');
  const [contrasena, setContrasena] = useState<string>('');
  const [mensaje, setMensaje] = useState<string>('');
  
  // Estado del usuario
  const [usuarioLogueado, setUsuarioLogueado] = useState<Usuario | null>(null);
  
  // Estado de navegación
  const [activeTab, setActiveTab] = useState<string>('Dashboard');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje('');
    
    try {
      if (isLogin) {
        const res = await authApi.login({ usuario, contrasena });
        setUsuarioLogueado(res.data.usuario);
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
    setUsuario('');
    setContrasena('');
    setMensaje('');
    setActiveTab('Dashboard');
  };

  // VISTA PRINCIPAL (USUARIO LOGUEADO)
  if (usuarioLogueado) {
    return (
      <div className="flex h-screen bg-bone">
        {/* SIDEBAR */}
        <aside className="w-64 bg-night text-white flex flex-col shadow-2xl">
          {/* LOGO EN EL SIDEBAR */}
          <div className="p-8 flex justify-center items-center">
            <Image 
              src="/logo.png" 
              alt="LadyBird Logo" 
              width={160} 
              height={50} 
              priority 
              className="object-contain"
            />
          </div>
          
          <nav className="flex-1 px-4 space-y-2">
            {[
              { id: 'Dashboard', icon: LayoutDashboard },
              { id: 'Stores', icon: Store },
              { id: 'Equipments', icon: HardDrive },
              { id: 'Maintenance', icon: Wrench },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  activeTab === item.id 
                  ? 'bg-rose text-night shadow-lg font-bold' 
                  : 'text-tumbleweed hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon size={20} className={activeTab === item.id ? 'text-night' : 'group-hover:scale-110 transition-transform'} />
                <span className="font-semibold">{item.id}</span>
              </button>
            ))}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center space-x-3 px-4 py-3 mb-2">
              <div className="w-8 h-8 bg-rose text-night rounded-full flex items-center justify-center text-xs font-black uppercase shadow-inner">
                {usuarioLogueado.usuario.substring(0, 2)}
              </div>
              <span className="text-sm font-medium truncate text-tumbleweed tracking-tight">{usuarioLogueado.usuario}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 text-rose/60 hover:text-rose hover:bg-rose/10 rounded-xl transition-all font-black uppercase text-[10px] tracking-[0.2em]"
            >
              <LogOut size={16} />
              <span>Logout System</span>
            </button>
          </div>
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 overflow-y-auto p-10 bg-bone">
          {activeTab === 'Stores' && <StoreList />}
          {activeTab === 'Equipments' && <EquipmentList />}

          {(activeTab === 'Dashboard' || activeTab === 'Maintenance') && (
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-tumbleweed">
              <h2 className="text-3xl font-black text-night uppercase italic tracking-tighter mb-4">{activeTab}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                 <div className="p-8 bg-sky/20 rounded-3xl border border-sky/30">
                    <p className="text-night/60 font-black uppercase text-[10px] tracking-widest mb-1">Status</p>
                    <p className="text-2xl font-black text-night uppercase italic">Systems Active</p>
                 </div>
                 <div className="p-8 bg-rose/10 rounded-3xl border border-rose/20">
                    <p className="text-night/60 font-black uppercase text-[10px] tracking-widest mb-1">Welcome back</p>
                    <p className="text-2xl font-black text-night">{usuarioLogueado.usuario}</p>
                 </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // VISTA DE LOGIN / REGISTRO
  return (
    <main className="min-h-screen bg-night flex items-center justify-center p-4">
      <div className="bg-bone p-12 rounded-[3.5rem] shadow-2xl max-w-md w-full border border-tumbleweed">
        {/* LOGO EN EL LOGIN */}
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
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full p-5 bg-white border border-tumbleweed rounded-[1.5rem] outline-none focus:ring-2 focus:ring-night transition-all text-night font-bold shadow-sm"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
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
            className="w-full py-5 bg-night text-bone rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-night/90 transition-all transform active:scale-95 shadow-night/20"
          >
            {isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>

        <button 
          onClick={() => { setIsLogin(!isLogin); setMensaje(''); }} 
          className="w-full mt-10 text-[10px] font-black uppercase tracking-[0.3em] text-night/30 hover:text-night transition-colors"
        >
          {isLogin ? "Sign Up Now" : "Back to Login"}
        </button>
      </div>
    </main>
  );
}