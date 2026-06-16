// components/equipment/EquipmentCard.tsx
'use client';

import { HardDrive, MapPin, Edit3, Printer, Trash2, ArrowRightLeft, History } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Equipment } from '@/services/api/equipmentApi';

interface Props {
  item:          Equipment;
  onEdit:        (item: Equipment) => void;
  onDelete:      (id: string) => void;
  onToggleStatus:(id: string, isDown: boolean) => void;
  onTransfer:    (item: Equipment) => void;
  onHistory:     (item: Equipment) => void;
  onPrint:       (item: Equipment) => void;
}

export default function EquipmentCard({ item, onEdit, onDelete, onToggleStatus, onTransfer, onHistory, onPrint }: Props) {
  return (
    <div className={`bg-white border rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all duration-300 ${item.isDown ? 'border-rose/50 bg-rose/5' : 'border-tumbleweed'}`}>
      {/* Top row */}
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${item.isDown ? 'bg-rose text-night' : 'bg-bone text-night/40'}`}>
          <HardDrive size={24} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase ${item.isDown ? 'bg-rose text-night shadow-sm' : 'bg-sky text-night'}`}>
            {item.status}
          </span>
          <span className="text-[11px] font-mono font-bold text-night/30 bg-bone px-3 py-1 rounded-lg">
            {item.equipmentCode}
          </span>
        </div>
      </div>

      <h3 className="font-black text-night text-xl mb-1 uppercase tracking-tight leading-tight">{item.name}</h3>
      <p className="text-[10px] text-night/30 font-bold uppercase tracking-widest mb-1">{item.type}</p>
      <div className="flex items-center text-[10px] text-night/40 mb-6 font-black uppercase tracking-widest">
        <MapPin size={12} className="mr-1 text-rose" /> {item.store?.name || '—'}
      </div>

      {/* QR */}
      <div className="flex justify-center mb-6 p-5 bg-bone rounded-3xl border border-tumbleweed/30">
        <div id={`qr-${item.id}`} className="p-2 bg-white rounded-xl shadow-inner">
          <QRCodeSVG value={item.qrCodeText || item.equipmentCode} size={110} level="H" />
        </div>
      </div>

      {/* Status toggle */}
      <button
        onClick={() => onToggleStatus(item.id, !!item.isDown)}
        className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 mb-3 ${
          item.isDown ? 'bg-sky text-night hover:bg-sky/80' : 'bg-rose text-night hover:bg-rose/80'
        }`}
      >
        {item.isDown ? 'Mark Fixed' : 'Mark Down'}
      </button>

      {/* Actions */}
      <div className="grid grid-cols-5 gap-1">
        {[
          { icon: Edit3,            onClick: () => onEdit(item),        title: 'Edit'     },
          { icon: ArrowRightLeft,   onClick: () => onTransfer(item),    title: 'Transfer' },
          { icon: History,          onClick: () => onHistory(item),     title: 'History'  },
          { icon: Printer,          onClick: () => onPrint(item),       title: 'Print'    },
          { icon: Trash2,           onClick: () => onDelete(item.id),   title: 'Delete', danger: true },
        ].map(({ icon: Icon, onClick, title, danger }) => (
          <button key={title} onClick={onClick} title={title}
            className={`p-2.5 bg-bone rounded-xl transition-all duration-200 text-night/40 ${
              danger ? 'hover:bg-red-500 hover:text-white' : 'hover:bg-night hover:text-bone'
            }`}>
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}