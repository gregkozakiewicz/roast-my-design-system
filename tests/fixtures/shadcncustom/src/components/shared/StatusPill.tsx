export function StatusPill({ ok }: { ok: boolean }) {
  return <span className={ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{ok ? "Active" : "Failed"}</span>
}
