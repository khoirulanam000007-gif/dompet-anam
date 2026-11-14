export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

// Ringkas untuk ruang sempit: Rp 3,4 jt, Rp 12 rb, Rp 1,2 M.
export const rupiahShort = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  const f = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");
  if (a >= 1e9) return `${s}Rp ${f(a / 1e9)} M`;
  if (a >= 1e6) return `${s}Rp ${f(a / 1e6)} jt`;
  if (a >= 1e4) return `${s}Rp ${f(a / 1e3)} rb`;
  return rupiah(n);
};
