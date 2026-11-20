import { createPortal } from "react-dom";
import type { ReactNode } from "react";

// Menampilkan jendela/formulir di lapisan paling atas halaman (di luar bungkus halaman),
// supaya tidak tertutup menu bawah atau tombol "+".
export default function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
