export function FootballLoader({ label = "Loading predictions" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <div className="relative flex items-center justify-center">
        <div className="football-orbit" />
        <div className="football" />
      </div>
      <p className="shimmer-text font-mono text-sm uppercase tracking-[0.25em]">{label}</p>
    </div>
  );
}
