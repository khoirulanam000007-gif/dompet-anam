import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { confirmBox, toast } from "../lib/ui";
import { rupiah } from "../lib/format";
import type { Account, Category } from "../lib/types";
import {
  FIELD_LABEL, MAX_ROWS, buildRows, detectMapping, parseDate, readFile, templateCsv,
  type ExistingTx, type Field, type ImportRow, type Mapping, type Table,
} from "../lib/csvImport";

type Props = { accounts: Account[]; categories: Category[]; onClose: () => void; onDone: () => void };
type Filter = "all" | "ok" | "dup" | "error";

const sel = "w-full rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30";
const BADGE: Record<string, string> = {
  ok: "bg-emerald/15 text-emerald", duplicate: "bg-gold/30 text-navy", dupfile: "bg-gold/30 text-navy", error: "bg-red-500/10 text-red-700",
};
const BADGE_TEXT: Record<string, string> = { ok: "Siap", duplicate: "Sudah ada", dupfile: "Ganda di file", error: "Error" };
const fmtDay = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-");

export default function ImportWizard({ accounts, categories, onClose, onDone }: Props) {
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<Table | null>(null);
  const [map, setMap] = useState<Mapping | null>(null);
  const [defAcc, setDefAcc] = useState(accounts[0]?.id ?? "");
  const [mkCat, setMkCat] = useState(true);
  const [mkAcc, setMkAcc] = useState(false);
  const [existing, setExisting] = useState<ExistingTx[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [override, setOverride] = useState<Record<number, boolean>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(60);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<{ saved: number; skipped: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setMsg("");
    if (f.size > 5 * 1024 * 1024) return setMsg("Ukuran file maksimal 5 MB.");
    try {
      const t = await readFile(f);
      if (t.rows.length === 0) return setMsg("File kosong atau tidak ada baris data di bawah judul kolom.");
      setFileName(f.name);
      setTable(t);
      setMap(detectMapping(t.headers));
      setOverride({});
      setFilter("all");
      setLimit(60);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "File tidak bisa dibaca. Pastikan formatnya CSV atau .xlsx.");
    }
  }

  // Ambil transaksi yang sudah ada pada rentang tanggal file untuk deteksi duplikat.
  useEffect(() => {
    if (!table || !map || map.date < 0) { setExisting([]); return; }
    const ds = table.rows.slice(0, MAX_ROWS).map((r) => parseDate(r[map.date] ?? "")).filter((d): d is Date => !!d);
    if (ds.length === 0) { setExisting([]); return; }
    const min = new Date(Math.min(...ds.map((d) => d.getTime())) - 86400000).toISOString();
    let cursor = new Date(Math.max(...ds.map((d) => d.getTime())) + 2 * 86400000).toISOString();
    let alive = true;
    setLoadingEx(true);
    (async () => {
      const all: (ExistingTx & { id: string })[] = [];
      const seen = new Set<string>();
      for (let page = 0; page < 20; page++) {
        const { data, error } = await supabase.from("transactions").select("id,account_id,type,amount,occurred_at,note")
          .gte("occurred_at", min).lte("occurred_at", cursor).order("occurred_at", { ascending: false }).limit(1000);
        if (error || !data || data.length === 0) break;
        let fresh = 0;
        for (const x of data as (ExistingTx & { id: string })[]) if (!seen.has(x.id)) { seen.add(x.id); all.push(x); fresh++; }
        if (data.length < 1000 || fresh === 0) break;
        cursor = data[data.length - 1].occurred_at;
      }
      if (alive) { setExisting(all); setLoadingEx(false); }
    })();
    return () => { alive = false; };
  }, [table, map?.date]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: ImportRow[] = useMemo(() => {
    if (!table || !map) return [];
    return buildRows(table, map, { accounts, categories, defaultAccountId: defAcc, createCategories: mkCat, createAccounts: mkAcc }, existing);
  }, [table, map, accounts, categories, defAcc, mkCat, mkAcc, existing]);

  const included = (r: ImportRow) => r.status !== "error" && (override[r.line] ?? r.include);
  const picked = rows.filter(included);
  const cnt = {
    ok: rows.filter((r) => r.status === "ok").length,
    dup: rows.filter((r) => r.status === "duplicate" || r.status === "dupfile").length,
    error: rows.filter((r) => r.status === "error").length,
  };
  const shown = rows.filter((r) => filter === "all" || (filter === "ok" && r.status === "ok") || (filter === "dup" && (r.status === "duplicate" || r.status === "dupfile")) || (filter === "error" && r.status === "error"));
  const mapOk = !!map && map.date >= 0 && map.amount >= 0;
  const truncated = table ? table.rows.length > MAX_ROWS : false;

  function download() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([templateCsv()], { type: "text/csv;charset=utf-8" }));
    a.download = "template-impor-dompet-anam.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  async function run() {
    if (picked.length === 0) return;
    const newCats = new Set(picked.filter((r) => r.newCategory && r.type).map((r) => `${r.type}|${r.categoryName.trim()}`));
    const newAccs = new Set(picked.filter((r) => !r.accountId && r.accountName).map((r) => r.accountName.trim()));
    const lines = [`${picked.length} transaksi akan disimpan.`];
    if (cnt.dup) lines.push(`${rows.filter((r) => r.status !== "error" && r.status !== "ok" && !included(r)).length} baris ganda dilewati.`);
    if (cnt.error) lines.push(`${cnt.error} baris error dilewati.`);
    if (newCats.size) lines.push(`${newCats.size} kategori baru akan dibuat.`);
    if (newAccs.size) lines.push(`${newAccs.size} rekening baru akan dibuat.`);
    if (!(await confirmBox(lines.join(" "), { danger: false, okLabel: "Impor sekarang" }))) return;

    setBusy(true);
    setMsg("");
    let saved = 0;
    try {
      const catId = new Map<string, string>();
      if (newCats.size) {
        const payload = [...newCats].map((k) => { const [kind, ...n] = k.split("|"); return { name: n.join("|"), kind }; });
        const { data, error } = await supabase.from("categories").insert(payload).select("id,name,kind");
        if (error) throw new Error("Gagal membuat kategori baru. Tidak ada transaksi yang disimpan.");
        (data ?? []).forEach((c: { id: string; name: string; kind: string }) => catId.set(`${c.kind}|${c.name}`, c.id));
      }
      const accId = new Map<string, string>();
      if (newAccs.size) {
        const payload = [...newAccs].map((name) => ({ name, type: "bank", initial_balance: 0 }));
        const { data, error } = await supabase.from("accounts").insert(payload).select("id,name");
        if (error) throw new Error("Gagal membuat rekening baru. Tidak ada transaksi yang disimpan.");
        (data ?? []).forEach((a: { id: string; name: string }) => accId.set(a.name, a.id));
      }
      const payload = picked.map((r) => ({
        type: r.type!,
        amount: r.amount,
        account_id: r.accountId ?? accId.get(r.accountName.trim()) ?? "",
        category_id: r.categoryId ?? (r.newCategory ? catId.get(`${r.type}|${r.categoryName.trim()}`) ?? null : null),
        occurred_at: r.date!.toISOString(),
        source: null,
        note: r.note || null,
      }));
      if (payload.some((p) => !p.account_id)) throw new Error("Ada baris tanpa rekening yang valid.");
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await supabase.from("transactions").insert(payload.slice(i, i + 200));
        if (error) {
          setResult({ saved, skipped: rows.length - picked.length, failed: payload.length - saved });
          setBusy(false);
          setMsg(`Berhenti di tengah jalan: ${saved} transaksi sudah tersimpan. Aman diulang, baris yang sudah masuk akan terdeteksi sebagai ganda.`);
          return;
        }
        saved += Math.min(200, payload.length - i);
      }
      setResult({ saved, skipped: rows.length - picked.length, failed: 0 });
      toast(`${saved} transaksi berhasil diimpor`, "ok");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Impor gagal. Coba lagi.");
    }
    setBusy(false);
  }

  const setField = (f: Field, v: number) => { setMap((m) => (m ? { ...m, [f]: v } : m)); setOverride({}); };

  return createPortal(
    <div className="fade-in fixed inset-0 z-[58] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={() => !busy && !result && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Impor transaksi" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div>
            <h3 className="text-lg font-bold text-navy">Impor transaksi</h3>
            <p className="text-xs text-charcoal/60">{result ? "Selesai" : table ? `${fileName} · ${table.rows.length} baris` : "CSV atau Excel (.xlsx)"}</p>
          </div>
          <button onClick={result ? onDone : onClose} disabled={busy} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal/10 text-lg leading-none">×</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3">
          {result ? (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald/15 text-3xl">{result.failed ? "⚠️" : "✅"}</div>
              <p className="mt-3 text-xl font-bold text-navy">{result.saved} transaksi tersimpan</p>
              <p className="mt-1 text-sm text-charcoal/70">{result.skipped} baris dilewati (ganda atau error){result.failed ? `, ${result.failed} gagal disimpan` : ""}.</p>
              {msg && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">{msg}</p>}
            </div>
          ) : !table ? (
            <div className="space-y-3 pt-2">
              <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-charcoal/25 bg-white px-4 py-8 text-center">
                <span className="text-3xl">📂</span>
                <span className="font-semibold text-navy">Pilih file CSV / Excel</span>
                <span className="text-xs text-charcoal/60">Maksimal 5 MB dan {MAX_ROWS.toLocaleString("id-ID")} baris</span>
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={pickFile} />
              <button onClick={download} className="w-full rounded-xl border border-charcoal/15 bg-white py-2.5 text-sm font-medium">⬇️ Unduh template (CSV)</button>
              <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
                <p className="font-semibold">Format kolom</p>
                <p className="mt-1 text-charcoal/70">Baris pertama berisi judul kolom:</p>
                <p className="mt-1 font-mono text-xs">Tanggal · Jenis · Kategori · Rekening · Nominal · Catatan</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-charcoal/70">
                  <li><b>Jenis</b>: Pemasukan atau Pengeluaran. Kalau kolom Jenis tidak ada, nominal negatif dianggap pengeluaran.</li>
                  <li><b>Tanggal</b>: 2026-11-15, 15/11/2026, atau 15 Nov 2026 (jam boleh ditambahkan).</li>
                  <li><b>Nominal</b>: boleh memakai titik, koma, atau awalan Rp.</li>
                  <li>File cadangan CSV dari menu Laporan juga bisa diimpor kembali.</li>
                </ul>
              </div>
              {msg && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">{msg}</p>}
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <details open={!mapOk} className="rounded-2xl bg-white p-3 shadow-sm">
                <summary className="cursor-pointer text-sm font-semibold">Cocokkan kolom {mapOk ? "✓" : "(perlu dilengkapi)"}</summary>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(Object.keys(FIELD_LABEL) as Field[]).map((f) => (
                    <label key={f} className="block text-xs text-charcoal/70">
                      {FIELD_LABEL[f]}{f === "date" || f === "amount" ? " *" : ""}
                      <select className={`${sel} mt-1`} value={map![f]} onChange={(e) => setField(f, Number(e.target.value))}>
                        <option value={-1}>— tidak ada —</option>
                        {table.headers.map((h, i) => <option key={i} value={i}>{h || `Kolom ${i + 1}`}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <label className="mt-3 block text-xs text-charcoal/70">
                  Rekening untuk baris tanpa nama rekening
                  <select className={`${sel} mt-1`} value={defAcc} onChange={(e) => setDefAcc(e.target.value)}>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={mkCat} onChange={(e) => setMkCat(e.target.checked)} className="h-4 w-4 accent-[#0f9d6b]" /> Buat kategori baru yang belum ada</label>
                <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={mkAcc} onChange={(e) => setMkAcc(e.target.checked)} className="h-4 w-4 accent-[#0f9d6b]" /> Buat rekening baru yang belum ada</label>
              </details>

              {!mapOk && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">Kolom Tanggal dan Nominal wajib dipilih.</p>}
              {truncated && <p className="rounded-xl bg-gold/20 px-3 py-2 text-xs">File punya lebih dari {MAX_ROWS.toLocaleString("id-ID")} baris. Hanya {MAX_ROWS.toLocaleString("id-ID")} baris pertama yang diproses.</p>}

              {mapOk && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl bg-white p-2.5 shadow-sm"><p className="text-lg font-bold text-emerald">{cnt.ok}</p><p className="text-[11px] text-charcoal/60">Siap</p></div>
                    <div className="rounded-2xl bg-white p-2.5 shadow-sm"><p className="text-lg font-bold text-navy">{cnt.dup}</p><p className="text-[11px] text-charcoal/60">Kemungkinan ganda</p></div>
                    <div className="rounded-2xl bg-white p-2.5 shadow-sm"><p className="text-lg font-bold text-red-700">{cnt.error}</p><p className="text-[11px] text-charcoal/60">Error</p></div>
                  </div>
                  {loadingEx && <p className="text-xs text-charcoal/60">Memeriksa duplikat dengan data Anda…</p>}

                  <div className="flex gap-2 text-xs">
                    {([["all", "Semua"], ["ok", "Siap"], ["dup", "Ganda"], ["error", "Error"]] as const).map(([k, l]) => (
                      <button key={k} onClick={() => { setFilter(k); setLimit(60); }} className={`rounded-full px-3 py-1.5 font-medium ${filter === k ? "bg-navy text-white" : "bg-charcoal/10"}`}>{l}</button>
                    ))}
                  </div>

                  <ul className="space-y-2">
                    {shown.length === 0 && <li className="py-3 text-center text-sm text-charcoal/60">Tidak ada baris.</li>}
                    {shown.slice(0, limit).map((r) => (
                      <li key={r.line} className={`rounded-2xl bg-white p-3 shadow-sm ${r.status === "error" ? "opacity-90" : ""}`}>
                        <div className="flex items-start gap-3">
                          <input type="checkbox" aria-label={`Sertakan baris ${r.line}`} className="mt-1 h-5 w-5 shrink-0 accent-[#0f9d6b]" disabled={r.status === "error"} checked={included(r)} onChange={(e) => setOverride((o) => ({ ...o, [r.line]: e.target.checked }))} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-semibold">{r.type === "income" ? "Pemasukan" : r.type === "expense" ? "Pengeluaran" : "?"} · {fmtDay(r.date)}</span>
                              <span className={`shrink-0 text-sm font-bold ${r.type === "income" ? "text-emerald" : ""}`}>{r.amount ? `${r.type === "income" ? "+" : "-"}${rupiah(r.amount)}` : "-"}</span>
                            </div>
                            <p className="truncate text-xs text-charcoal/60">
                              {[r.categoryName || "Tanpa kategori", r.accountName || accounts.find((a) => a.id === defAcc)?.name, r.note].filter(Boolean).join(" · ")}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE[r.status]}`}>{BADGE_TEXT[r.status]}</span>
                              <span className="text-[10px] text-charcoal/50">baris {r.line}</span>
                              {r.newCategory && <span className="text-[10px] text-charcoal/60">kategori baru</span>}
                              {r.errors.map((e) => <span key={e} className="text-[11px] text-red-700">{e}</span>)}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {shown.length > limit && <button onClick={() => setLimit(limit + 100)} className="w-full rounded-xl border border-charcoal/15 bg-white py-2 text-sm font-medium">Tampilkan lebih banyak ({shown.length - limit})</button>}
                </>
              )}
              {msg && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">{msg}</p>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1fr_1.7fr] gap-2 border-t border-charcoal/10 bg-paper px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {result ? (
            <button onClick={onDone} className="col-span-2 rounded-xl bg-emerald py-3 font-semibold text-white">Selesai</button>
          ) : table ? (
            <>
              <button onClick={() => { setTable(null); setMap(null); setMsg(""); }} disabled={busy} className="rounded-xl border border-charcoal/15 bg-white py-3 font-medium text-charcoal disabled:opacity-60">Ganti file</button>
              <button onClick={run} disabled={busy || !mapOk || picked.length === 0 || loadingEx} className="rounded-xl bg-emerald py-3 font-semibold text-white disabled:opacity-50">
                {busy ? "Menyimpan..." : picked.length ? `Impor ${picked.length} transaksi` : "Tidak ada yang diimpor"}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="col-span-2 rounded-xl border border-charcoal/15 bg-white py-3 font-medium text-charcoal">Batal</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
