export default function LoadingClasses() {
  return <div role="status" aria-label="Loading classes" className="space-y-5 animate-pulse">
    <div className="h-10 w-56 rounded bg-black/10" />
    <div className="grid gap-4 sm:grid-cols-2"><div className="h-36 rounded-2xl bg-black/5" /><div className="h-36 rounded-2xl bg-black/5" /></div>
  </div>;
}
