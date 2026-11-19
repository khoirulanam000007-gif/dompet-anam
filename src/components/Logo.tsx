import { useId } from "react";

// Logo Dompet Pro: monogram "P" emas dengan koin, di atas latar navy.
export default function Logo({ className = "h-14 w-14" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="Logo Dompet Pro">
      <defs>
        <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1="150" y1="120" x2="380" y2="395">
          <stop offset="0" stopColor="#f6e3a6" /><stop offset="0.5" stopColor="#d4af5a" /><stop offset="1" stopColor="#a47f2f" />
        </linearGradient>
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbeab3" /><stop offset="1" stopColor="#c39a43" /></linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#16345f" /><stop offset="1" stopColor="#08162b" /></linearGradient>
        <radialGradient id={`${id}w`} cx="0.28" cy="0.2" r="0.8"><stop offset="0" stopColor="#ffffff" stopOpacity="0.14" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${id}b)`} />
      <rect width="512" height="512" rx="112" fill={`url(#${id}w)`} />
      <rect x="10" y="10" width="492" height="492" rx="104" fill="none" stroke="#d4af5a" strokeOpacity="0.35" strokeWidth="3" />
      <g transform="translate(234,256) translate(-256,-256)">
        <g fill="none" stroke={`url(#${id}g)`} strokeWidth="46" strokeLinecap="round" strokeLinejoin="round">
          <path d="M186 142 V372" />
          <path d="M186 142 H284 a86 86 0 0 1 0 172 H186" />
        </g>
        <circle cx="288" cy="228" r="31" fill={`url(#${id}v)`} />
        <circle cx="288" cy="228" r="21" fill="none" stroke="#0b1f3a" strokeOpacity="0.35" strokeWidth="3" />
        <path d="M288 213 Q290.5 225.5 303 228 Q290.5 230.5 288 243 Q285.5 230.5 273 228 Q285.5 225.5 288 213 Z" fill="#0b1f3a" fillOpacity="0.6" />
      </g>
    </svg>
  );
}
