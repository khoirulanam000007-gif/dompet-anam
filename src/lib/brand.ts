// Satu-satunya tempat nama merek di dalam aplikasi. Mengganti nama atau logo cukup mulai dari sini.
// (File statis di folder public/ seperti manifest.webmanifest, sw.js, dan index.html tidak bisa membaca file ini,
//  jadi nama di sana diganti manual. Daftarnya ada di PROJECT_CONTEXT.md.)
export const BRAND = {
  name: "DompetPro",            // nama tampilan
  upper: "DOMPETPRO",           // untuk judul PDF / label huruf besar
  short: "DP",                  // singkatan untuk tempat sempit (mis. logo teks di PDF)
  slug: "dompetpro",            // untuk nama file unduhan
  tagline: "Kelola uang dengan rapi, tenang, dan terarah.",
  backupId: "DOMPETPRO",        // penanda di file cadangan baru
  legacyBackupIds: ["DOMPET ANAM"], // cadangan lama (sebelum ganti nama) tetap bisa dipulihkan
} as const;
