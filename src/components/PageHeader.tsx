import type { ReactNode } from "react";

type Props = { title: string; sub: string; icon: string; colors: [string, string]; children?: ReactNode };

export default function PageHeader({ title, sub, icon, colors, children }: Props) {
  return (
    <div
      className="page-hero rise relative overflow-hidden rounded-b-[2rem] px-5 pt-5 text-white"
      style={{ background: `radial-gradient(120% 140% at 100% 0%, rgba(201,169,97,.34), transparent 55%), linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
    >
      <span className="pointer-events-none absolute -right-2 -top-3 text-8xl opacity-20">{icon}</span>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-white/80">{sub}</p>
      <div className="mt-3 h-0.5 w-10 bg-gold" />
      {children}
    </div>
  );
}
