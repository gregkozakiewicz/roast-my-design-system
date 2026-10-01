export function Usage({ pct }: { pct: number }) {
  return (
    <div className="rounded-md bg-neutral-50 p-3 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
      <div className="h-2 rounded bg-neutral-200 dark:bg-neutral-800"><div className="h-2 rounded bg-emerald-500" style={{ width: `${pct}%` }} /></div>
      <p className="mt-2 text-neutral-500">{pct}% used</p>
      {pct > 90 && <p className="text-red-500">Almost full</p>}
      <span className="text-destructive">limit</span> <span className="text-accent-500">upgrade</span>
    </div>
  )
}
