'use client';

import Image from 'next/image';
import {
  LayoutDashboard, Store, HardDrive, Wrench,
  UtensilsCrossed, FlaskConical, LogOut, ClipboardList,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { AppTab } from '@/context/AppContext';

interface Usuario { id: number; email: string; nombre: string; role: string; }
interface SidebarProps { activeTab: AppTab; onTabChange: (tab: AppTab) => void; usuario: Usuario; onLogout: () => void; }

interface NavItem  { id: AppTab; icon: LucideIcon; label: string; }
interface NavGroup { label: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'General',
    items: [
      { id: 'Dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Catering',
    items: [
      { id: 'Catering',   icon: UtensilsCrossed, label: 'Orders'   },
      { id: 'Formulas',   icon: FlaskConical,    label: 'Formulas' },
      { id: 'Audit',      icon: ClipboardList,   label: 'Audit'    },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'Stores',      icon: Store,     label: 'Stores'      },
      { id: 'Equipments',  icon: HardDrive, label: 'Equipment'   },
      { id: 'Maintenance', icon: Wrench,    label: 'Maintenance' },
    ],
  },
];

export default function Sidebar({ activeTab, onTabChange, usuario, onLogout }: SidebarProps) {
  const displayName = usuario.nombre || usuario.email.split('@')[0];
  const initials    = displayName.substring(0, 2).toUpperCase();

  // Grupos colapsables — todos abiertos por defecto
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (label: string) => setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));

  return (
    <aside className="w-64 bg-night text-white flex flex-col shadow-2xl shrink-0">
      {/* Logo */}
      <div className="p-8 flex justify-center items-center border-b border-white/5">
        <Image src="/logo.png" alt="LadyBird Logo" width={140} height={44} priority className="object-contain" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const isCollapsed = collapsed[group.label];
          return (
            <div key={group.label} className="mb-2">
              {/* Group header */}
              <button
                onClick={() => toggle(group.label)}
                className="w-full flex items-center justify-between px-3 py-1.5 mb-1 group"
              >
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-tumbleweed/50 group-hover:text-tumbleweed/80 transition-colors">
                  {group.label}
                </span>
                {isCollapsed
                  ? <ChevronRight size={12} className="text-tumbleweed/30" />
                  : <ChevronDown  size={12} className="text-tumbleweed/30" />
                }
              </button>

              {/* Items */}
              {!isCollapsed && group.items.map((item) => (
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
                    size={18}
                    className={activeTab === item.id ? 'text-night' : 'group-hover:scale-110 transition-transform'}
                  />
                  <span className="font-semibold text-sm">{item.label}</span>
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center space-x-3 px-4 py-3 mb-1">
          <div className="w-8 h-8 bg-rose text-night rounded-full flex items-center justify-center text-xs font-black uppercase shadow-inner shrink-0">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold truncate text-white tracking-tight">{displayName}</span>
            <span className="text-[10px] font-medium truncate text-tumbleweed/60">{usuario.email}</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-rose/60 hover:text-rose hover:bg-rose/10 rounded-xl transition-all font-black uppercase text-[10px] tracking-[0.2em]"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}