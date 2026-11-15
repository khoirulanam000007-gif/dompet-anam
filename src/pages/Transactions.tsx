import { Fragment, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { confirmBox, toast } from "../lib/ui";
import { rupiah } from "../lib/format";
import { catIcon } from "../lib/icons";
import type { Account, Category, Tx } from "../lib/types";
import { getReceipt, receiptIds } from "../lib/receipts";
import ReceiptViewer from "../components/ReceiptViewer";

type Props = {
  txs: Tx[];
  accounts: Account[];
  categories: Category[];
  onEdit: (t: Tx) => void;
  onChanged: () => void;
  searchable?: boolean;
};

const NAMES: Record<string, string> = {
  transfer: "Transfer", saving_deposit: "Setoran tabungan", saving_withdraw: "Penarikan tabungan",
  debt_borrow: "Pinjaman diterima", loan_give: "Pinjaman diberikan", debt_repay: "Pembayaran utang", loan_receive: "Penerimaan piutang",
};
const PLUS = ["income", "saving_withdraw", "debt_borrow", "loan_receive"];

const PAGE = 200;
const COLS = "id,type,amount,account_id,to_account_id,category_id,occurred_at,source,note";

const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
function dayLabel(iso: string) {
  const d = new Date(iso), n = new Date();
  const diff = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
}

export default function Transactions({ txs, accounts, categories, onEdit, onChanged, searchable }: Props) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "income" | "expense">("all");
  const [older, setOlder] = useState<Tx[]>([]);
  const [end, setEnd] = useState(txs.length < PAGE);
  const [busy, setBusy] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  // Transaksi yang punya foto struk (hanya id-nya, bukan fotonya)
  const [withReceipt, setWithReceipt] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<{ src: string | null } | null>(null);
  useEffect(() => { let alive = true; receiptIds().then((s) => { if (alive) setWithReceipt(s); }); return () => { alive = false; }; }, [txs]);
  async function openReceipt(id: string) {
    setViewing({ src: null });
    const src = await getReceipt(id);
    if (!src) { setViewing(null); return toast("Foto struk tidak ditemukan.", "error"); }
    setViewing({ src });
  }
  const searching = !!searchable && (!!q.trim() || f !== "all");
  // Data baru dari induk (mis. setelah simpan/hapus) = mulai lagi dari halaman pertama.
  useEffect(() => { setOlder([]); setEnd(txs.length < PAGE); }, [txs]);
  const all = older.length ? [...txs, ...older] : txs;

  // Memuat transaksi yang lebih lama bertahap (200 per kali). everything=true: muat semuanya (untuk pencarian).
  async function loadMore(everything = false) {
    if (busy || end) return;
    setBusy(true);
    let acc = older;
    let cursor = (acc.length ? acc[acc.length - 1] : txs[txs.length - 1])?.occurred_at;
    let done = false;
    for (let i = 0; i < (everything ? 30 : 1) && cursor && !done; i++) {
      const { data, error } = await supabase.from("transactions").select(COLS).lte("occurred_at", cursor).order("occurred_at", { ascending: false }).limit(PAGE);
      if (error) { toast("Riwayat lama belum bisa dimuat. Periksa internet Anda.", "error"); break; }
      const seen = new Set([...txs, ...acc].map((x) => x.id));
      const fresh = (data ?? []).filter((x) => !seen.has(x.id)).map((x) => ({ ...x, amount: Number(x.amount) })) as Tx[];
      acc = [...acc, ...fresh];
      if ((data ?? []).length < PAGE || fresh.length === 0) done = true;
      cursor = acc.length ? acc[acc.length - 1].occurred_at : cursor;
    }
    setOlder(acc);
    if (done) setEnd(true);
    setBusy(false);
  }

  // Mencari/memfilter = cari di seluruh riwayat, jadi muat semuanya dulu.
  useEffect(() => { if (searching && !end && !busy) loadMore(true); }, [searching, end]); // eslint-disable-line react-hooks/exhaustive-deps
  // Gulir sampai bawah = muat otomatis halaman berikutnya.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || end || searching || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && !busy) loadMore(); }, { rootMargin: "240px" });
    io.observe(el);
    return () => io.disconnect();
  });

  const acc = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "-";
  const cat = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Tanpa kategori";

  async function remove(t: Tx) {
    if (!(await confirmBox("Hapus transaksi ini? Saldo akan dihitung ulang.", { okLabel: "Hapus" }))) return;
    const { error } = await supabase.from("transactions").delete().eq("id", t.id);
    if (error) toast("Gagal menghapus. Coba lagi.", "error");
    else onChanged();
  }

  const needle = q.trim().toLowerCase();
  const shown = !searchable ? txs : all.filter((t) =>
    (f === "all" || t.type === f) &&
    (!needle || [cat(t.category_id), acc(t.account_id), t.note ?? "", t.source ?? ""].join(" ").toLowerCase().includes(needle))
  );

  if (txs.length === 0)
    return (
      <div className="px-5 pt-8 text-center">
        <p className="text-5xl">🧾</p>
        <p className="mt-2 font-semibold text-navy">Belum ada transaksi</p>
        <p className="text-sm text-charcoal/60">Tekan tombol + untuk mencatat yang pertama.</p>
      </div>
    );

  let last = "";
  return (
    <>
      {searchable && (
        <div className="px-5 pt-4">
          <input
            className="w-full rounded-2xl border border-charcoal/15 bg-white px-4 py-3 outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30"
            placeholder="🔍  Cari kategori, catatan, atau rekening"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="mt-2 flex gap-2 text-sm">
            {([["all", "Semua"], ["income", "Masuk"], ["expense", "Keluar"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setF(k)} className={`rounded-full px-4 py-1.5 font-medium ${f === k ? "bg-navy text-white" : "bg-charcoal/10"}`}>{l}</button>
            ))}
          </div>
        </div>
      )}
      <ul className="space-y-2 px-5 pt-4">
        {shown.length === 0 && <li className="text-charcoal/60">Tidak ada transaksi yang cocok.</li>}
        {shown.map((t) => {
          const plus = PLUS.includes(t.type);
          const editable = t.type === "income" || t.type === "expense";
          const isTransfer = t.type === "transfer";
          const label = NAMES[t.type] ?? cat(t.category_id);
          const icon = editable ? catIcon(cat(t.category_id)) : isTransfer ? "🔁" : t.type.startsWith("saving") ? "🐖" : "🤝";
          const dk = dayKey(t.occurred_at);
          const head = searchable && dk !== last;
          last = dk;
          return (
            <Fragment key={t.id}>
              {head && <li className="pt-2 text-xs font-semibold uppercase tracking-wide text-charcoal/50">{dayLabel(t.occurred_at)}</li>}
              <li className="rise rounded-2xl bg-white px-3 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: plus ? "rgba(15,157,107,.14)" : "rgba(201,169,97,.22)" }}>{icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{label}</p>
                    <p className="truncate text-xs text-charcoal/60">
                      {isTransfer ? `${acc(t.account_id)} → ${acc(t.to_account_id)}` : acc(t.account_id)} · {new Date(t.occurred_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {(t.source || t.note) && <p className="truncate text-xs text-charcoal/70">{[t.source, t.note].filter(Boolean).join(" · ")}</p>}
                  </div>
                  <span className={`shrink-0 font-bold ${plus ? "text-emerald" : ""}`}>{isTransfer ? "" : plus ? "+" : "-"}{rupiah(t.amount)}</span>
                </div>
                <div className="ml-14 mt-1 flex gap-4 text-xs">
                  {editable && <button onClick={() => onEdit(t)} className="text-navy underline">Ubah</button>}
                  {withReceipt.has(t.id) && <button onClick={() => openReceipt(t.id)} className="text-navy underline">📎 Struk</button>}
                  <button onClick={() => remove(t)} className="text-red-700 underline">Hapus</button>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ul>
      {searchable && (
        <div ref={sentinel} className="px-5 pb-6 pt-4 text-center text-sm">
          {!end ? (
            <button onClick={() => loadMore()} disabled={busy} className="rounded-full border border-charcoal/15 bg-white px-5 py-2 font-medium disabled:opacity-60">
              {busy ? (searching ? "Mencari di seluruh riwayat…" : "Memuat…") : "Muat transaksi lebih lama"}
            </button>
          ) : all.length > PAGE ? (
            <p className="text-charcoal/50">Semua {all.length} transaksi sudah dimuat.</p>
          ) : null}
        </div>
      )}
      {viewing && <ReceiptViewer src={viewing.src} onClose={() => setViewing(null)} />}
    </>
  );
}
