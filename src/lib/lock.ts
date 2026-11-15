// Kunci aplikasi di perangkat ini: tanpa kunci, PIN, atau biometrik (sidik jari / pengenalan wajah).
// Biometrik memakai WebAuthn (verifikasi bawaan HP). Ini kunci kenyamanan di perangkat, bukan pengganti kata sandi akun.
export type LockMode = "none" | "pin" | "bio";

export function getMode(): LockMode {
  const m = localStorage.getItem("lockMode");
  if (m === "none") return "none";
  if (m === "bio") return localStorage.getItem("bioCred") ? "bio" : localStorage.getItem("pin") ? "pin" : "none";
  return localStorage.getItem("pin") ? "pin" : "none";
}
export const setMode = (m: LockMode) => localStorage.setItem("lockMode", m);

export function clearLock() {
  localStorage.removeItem("pin");
  localStorage.removeItem("bioCred");
  localStorage.setItem("lockMode", "none");
}

const toB64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export async function bioSupported(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

// Mendaftarkan biometrik perangkat. HP menampilkan layar sidik jari / wajah miliknya sendiri.
export async function registerBio(label: string): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "DOMPET ANAM" },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: label || "pengguna", displayName: label || "Pengguna" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem("bioCred", toB64(cred.rawId));
    return true;
  } catch {
    return false;
  }
}

export async function verifyBio(): Promise<boolean> {
  const id = localStorage.getItem("bioCred");
  if (!id) return false;
  try {
    const r = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: fromB64(id), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!r;
  } catch {
    return false;
  }
}
