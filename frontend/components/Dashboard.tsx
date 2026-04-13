interface DashboardProps {
  usuario: string;
}

export default function Dashboard({ usuario }: DashboardProps) {
  return (
    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-tumbleweed">
      <h2 className="text-3xl font-black text-night uppercase italic tracking-tighter mb-4">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="p-8 bg-sky/20 rounded-3xl border border-sky/30">
          <p className="text-night/60 font-black uppercase text-[10px] tracking-widest mb-1">Status</p>
          <p className="text-2xl font-black text-night uppercase italic">Systems Active</p>
        </div>
        <div className="p-8 bg-rose/10 rounded-3xl border border-rose/20">
          <p className="text-night/60 font-black uppercase text-[10px] tracking-widest mb-1">Welcome back</p>
          <p className="text-2xl font-black text-night">{usuario}</p>
        </div>
      </div>
    </div>
  );
}