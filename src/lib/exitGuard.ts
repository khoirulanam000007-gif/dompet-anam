import { useEffect, useRef } from "react";
import { confirmBox, toast } from "./ui";

// Tombol "kembali" di HP:
//  1) ada jendela/formulir terbuka  -> tutup jendela itu saja
//  2) sedang di menu selain Beranda -> kembali ke Beranda
//  3) sedang di Beranda             -> tanya dulu sebelum menutup aplikasi
// Catatan: Chrome mengabaikan entri riwayat yang dibuat sebelum pengguna menyentuh layar,
// jadi pengaman dipasang pada sentuhan/tombol pertama, bukan saat aplikasi dibuka.
export function useExitGuard(tab: string, goHome: () => void) {
  const cur = useRef({ tab, goHome });
  cur.current = { tab, goHome };

  useEffect(() => {
    const guard = () => { if (!history.state?.dompetGuard) history.pushState({ dompetGuard: true }, ""); };
    let armed = false;
    const arm = () => { if (armed) return; armed = true; guard(); };
    let asking = false;
    let leaving = false;

    const onPop = async () => {
      if (leaving) return; // sedang proses keluar: abaikan perpindahan riwayat
      // dialog konfirmasi lain sedang terbuka (mis. "Hapus transaksi ini?") -> kembali = Batal
      const dlg = document.querySelector<HTMLElement>('[role="alertdialog"]');
      if (dlg) {
        [...dlg.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Batal")?.click();
        guard();
        return;
      }
      // jendela/formulir terbuka -> tutup itu saja
      const overlays = [...document.querySelectorAll<HTMLElement>(".fixed.inset-0")].filter((e) => !e.className.includes("pointer-events-none"));
      const top = overlays[overlays.length - 1];
      if (top) {
        [...top.querySelectorAll("button")].find((b) => /^(tutup|batal)$/i.test(b.textContent?.trim() ?? ""))?.click();
        guard();
        return;
      }
      // bukan di Beranda -> ke Beranda
      if (cur.current.tab !== "beranda") { cur.current.goHome(); guard(); return; }
      // di Beranda -> tanya dulu. Pengaman dipasang LAGI sebelum bertanya, supaya menekan
      // "kembali" saat dialog terbuka hanya berarti Batal, bukan langsung menutup aplikasi.
      guard();
      if (asking) return;
      asking = true;
      const ok = await confirmBox("Tutup Dompet Pro sekarang?", { okLabel: "Ya, tutup", danger: false, icon: "logOut" });
      asking = false;
      if (!ok) return;
      leaving = true;
      history.back();                                   // dari entri pengaman ke entri dasar (diabaikan)
      window.setTimeout(() => history.back(), 120);     // peramban biasa: keluar dari situs
      window.setTimeout(() => window.close(), 300);     // aplikasi terpasang: coba tutup langsung
      window.setTimeout(() => {
        toast("Tekan tombol kembali sekali lagi untuk menutup aplikasi.", "info");
        leaving = false;
        window.setTimeout(guard, 4000);                 // bila tetap dipakai, pengaman aktif lagi
      }, 800);
    };

    window.addEventListener("popstate", onPop);
    window.addEventListener("pointerdown", arm, { once: true, passive: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);
}
