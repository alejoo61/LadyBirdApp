'use client';

import { useState } from 'react';
import { authApi } from '@/services/api/authApi';
import EquipmentList from '@/components/EquipmentList';
import { LayoutDashboard, Store, HardDrive, Wrench, LogOut } from 'lucide-react';

// 1. Definimos la interfaz del usuario para evitar el 'any'
interface Usuario {
  id: number;
  usuario: string;
}

// 2. Definimos una interfaz para el error de la API
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
  
  // Usamos la interfaz Usuario en el estado
  const [usuarioLogueado, setUsuarioLogueado] = useState<Usuario | null>(null);
  
  const [activeTab, setActiveTab] = useState<string>('Dashboard');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje('');
    
    try {
      if (isLogin) {
        const res = await authApi.login({ usuario, contrasena });
        // Suponiendo que la respuesta tiene esta estructura según tus archivos previos
        setUsuarioLogueado(res.data.usuario);
      } else {
        await authApi.registro({ usuario, contrasena });
        setIsLogin(true);
        setMensaje('✅ Registro exitoso. Ahora puedes iniciar sesión.');
      }
    } catch (err: unknown) {
      // Manejo de error tipado sin usar 'any'
      const error = err as ApiError;
      setMensaje(`❌ ${error.response?.data?.error || 'Error en la conexión'}`);
    }
  };

  const handleLogout = () => {
    setUsuarioLogueado(null);
    setUsuario('');
    setContrasena('');
    setMensaje('');
    setActiveTab('Dashboard');
  };

  // Vista cuando el usuario ha iniciado sesión
  if (usuarioLogueado) {
    return (
      <div className="flex h-screen bg-gray-50 text-gray-900">
        {/* SIDEBAR */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
          <div className="p-8">
            <h1 className="text-2xl font-black tracking-tighter text-purple-400">LADYBIRD</h1>
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
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === item.id 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                <span className="font-semibold">{item.id}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center space-x-3 px-4 py-3 mb-2 text-slate-300">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                {usuarioLogueado.usuario.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-sm font-medium truncate">{usuarioLogueado.usuario}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            >
              <LogOut size={20} />
              <span className="font-semibold">Logout</span>
            </button>
          </div>
        </aside>

        {/* CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-10">
          {activeTab === 'Equipments' ? (
            <EquipmentList />
          ) : (
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-3xl font-bold mb-4 text-gray-800">{activeTab}</h2>
              <p className="text-gray-500">This section is currently under development.</p>
              
              {activeTab === 'Dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                  <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100">
                    <p className="text-purple-600 font-bold mb-1">Welcome back,</p>
                    <p className="text-2xl font-black text-purple-900">{usuarioLogueado.usuario}</p>
                  </div>
                  <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-blue-600 font-bold mb-1">System Status</p>
                    <p className="text-2xl font-black text-blue-900">Stable</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Vista de Login / Registro
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">
            {isLogin ? 'Welcome Back' : 'Join Us'}
          </h2>
          <p className="text-slate-500 mt-2 font-medium">
            {isLogin ? 'Please enter your details' : 'Create your manager account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
              Email
            </label>
            <input
              type="text"
              placeholder="e.g. jdoe"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 transition-all text-slate-700"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 transition-all text-slate-700"
              required
            />
          </div>

          {mensaje && (
            <div className={`p-4 rounded-2xl text-sm font-bold text-center ${
              mensaje.includes('❌') ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {mensaje}
            </div>
          )}

          <button 
            type="submit" 
            className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 transition transform active:scale-[0.98]"
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setMensaje('');
            }} 
            className="text-sm font-bold text-slate-400 hover:text-purple-600 transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </main>
  );
}