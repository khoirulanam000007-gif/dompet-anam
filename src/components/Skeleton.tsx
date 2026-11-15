export default function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat" className="space-y-3 px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="skeleton h-60 rounded-3xl" />
      <div className="skeleton h-12" />
      <div className="skeleton h-28" />
      <div className="skeleton h-24" />
    </div>
  );
}
