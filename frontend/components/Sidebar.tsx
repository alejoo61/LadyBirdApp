'use client';

import Image from 'next/image';
import {
  LayoutDashboard, Store, HardDrive, Wrench,
  UtensilsCrossed, FlaskConical, LogOut, ClipboardList,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppTab } from '@/context/AppContext';

interface Usuario {
  id: number;
  usuario: string;
}

interface SidebarProps {
  activeTab:   AppTab;
  onTabChange: (tab: AppTab) => void;
  usuario:     Usuario;
  onLogout:    () => void;
}

const NAV_ITEMS: { id: AppTab; icon: LucideIcon }[] = [
  { id: 'Dashboard',   icon: LayoutDashboard },
  { id: 'Catering',    icon: UtensilsCrossed },
  { id: 'Formulas',    icon: FlaskConical    },
  { id: 'Audit',       icon: ClipboardList   },
  { id: 'Stores',      icon: Store           },
  { id: 'Equipments',  icon: HardDrive       },
  { id: 'Maintenance', icon: Wrench          },
];

export default function Sidebar({ activeTab, onTabChange, usuario, onLogout }: SidebarProps) {
  return (
    <aside className="w-64 bg-night text-white flex flex-col shadow-2xl shrink-0">
      <div className="p-8 flex justify-center items-center">
        <Image src="/logo.png" alt="LadyBird Logo" width={160} height={50} priority className="object-contain" />
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              activeTab === item.id
                ? 'bg-rose text-night shadow-lg font-bold'
                : 'text-tumbleweed hover:bg-white/10 hover:text-white'
            }`}
          >
            <item.icon
              size={20}
              className={activeTab === item.id ? 'text-night' : 'group-hover:scale-110 transition-transform'}
            />
            <span className="font-semibold">{item.id}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="flex items-center space-x-3 px-4 py-3 mb-2">
          <div className="w-8 h-8 bg-rose text-night rounded-full flex items-center justify-center text-xs font-black uppercase shadow-inner">
            {usuario.usuario.substring(0, 2)}
          </div>
          <span className="text-sm font-medium truncate text-tumbleweed tracking-tight">
            {usuario.usuario}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-rose/60 hover:text-rose hover:bg-rose/10 rounded-xl transition-all font-black uppercase text-[10px] tracking-[0.2em]"
        >
          <LogOut size={16} />
          <span>Logout System</span>
        </button>
      </div>
    </aside>
  );
}