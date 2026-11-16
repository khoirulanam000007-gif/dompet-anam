import { useId } from "react";

// Logo DompetPro: dompet dengan kartu emas yang menyembul. Digambar sebagai SVG sehingga tajam di semua ukuran.
export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label="DompetPro">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0b1f3a" /><stop offset="1" stopColor="#0f6b52" /></linearGradient>
        <linearGradient id={`${id}o`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9d49c" /><stop offset="1" stopColor="#c9a961" /></linearGradient>
        <radialGradient id={`${id}r`}><stop offset="0" stopColor="#c9a961" stopOpacity=".42" /><stop offset="1" stopColor="#c9a961" stopOpacity="0" /></radialGradient>
        <clipPath id={`${id}c`}><rect width="64" height="64" rx="16" /></clipPath>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}g)`} />
      <circle cx="54" cy="6" r="34" fill={`url(#${id}r)`} clipPath={`url(#${id}c)`} />
      <g transform="rotate(-14 30 21)">
        <rect x="18" y="12" width="24" height="18" rx="3.5" fill={`url(#${id}o)`} />
        <rect x="18" y="17" width="24" height="3" fill="#0b1f3a" fillOpacity=".27" />
      </g>
      <rect x="11" y="22" width="42" height="28" rx="7.5" fill="#f7f6f2" />
      <rect x="36" y="30" width="19" height="13" rx="6.5" fill="#0b1f3a" />
      <circle cx="44.5" cy="36.5" r="2.8" fill={`url(#${id}o)`} />
    </svg>
  );
}

// Tulisan "DompetPro" dengan "Pro" berwarna emas. onLight = emas lebih tua agar terbaca di latar terang.
export function Wordmark({ onLight = false, className = "" }: { onLight?: boolean; className?: string }) {
  return <span className={className}>Dompet<span style={{ color: onLight ? "#b08d3c" : "#c9a961" }}>Pro</span></span>;
}
