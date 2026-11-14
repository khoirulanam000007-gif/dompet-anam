type Props = { title: string; sub: string; icon: string; colors: [string, string] };

export default function PageHeader({ title, sub, icon, colors }: Props) {
  return (
    <div
      className="rise relative overflow-hidden rounded-b-3xl px-5 pb-7 pt-5 text-white"
      style={{ background: `radial-gradient(120% 140% at 100% 0%, rgba(201,169,97,.30), transparent 55%), linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
    >
      <span className="pointer-events-none absolute -right-1 -top-2 text-7xl opacity-20">{icon}</span>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-white/80">{sub}</p>
      <div className="mt-3 h-0.5 w-10 bg-gold" />
    </div>
  );
}
