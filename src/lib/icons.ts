const MAP: Record<string, string> = {
  makanan: "🍜", minuman: "☕", transportasi: "🚗", belanja: "🛍️", pendidikan: "📚", kesehatan: "💊",
  hiburan: "🎬", tagihan: "🧾", "kebutuhan pribadi": "🧴", "uang saku": "💵", gaji: "💼", freelance: "💻",
  bisnis: "🏪", hadiah: "🎁", bonus: "⭐", lainnya: "📦",
};
export const catIcon = (name?: string) => MAP[(name ?? "").toLowerCase()] ?? "🏷️";
export const ACC_ICON: Record<string, string> = { cash: "💵", bank: "🏦", ewallet: "📱", other: "💳" };
