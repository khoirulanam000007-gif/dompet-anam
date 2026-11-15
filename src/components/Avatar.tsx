type Props = { src?: string | null; size?: number; ring?: boolean };

// Foto profil berbentuk lingkaran. Tanpa foto: avatar bawaan dengan ikon pengguna.
export default function Avatar({ src, size = 44, ring = true }: Props) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        boxShadow: ring ? "0 0 0 2px #c9a961, 0 6px 16px -6px rgba(0,0,0,.45)" : undefined,
        background: src ? "#0b1f3a" : "linear-gradient(135deg,#14305a,#0f6b52)",
      }}
    >
      {src ? (
        <img src={src} alt="Foto profil" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="none" stroke="#f7f6f2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Avatar bawaan">
          <circle cx="12" cy="8.2" r="3.6" />
          <path d="M4.6 20c.8-3.9 3.9-6 7.4-6s6.6 2.1 7.4 6" />
        </svg>
      )}
    </span>
  );
}
