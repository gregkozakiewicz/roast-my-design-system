export function SiteRow({ name, down }: { name: string; down: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 py-2 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
      <span className="text-neutral-900 dark:text-neutral-100">{name}</span>
      <span className={down ? "text-red-500" : "text-neutral-500"}>{down ? "Down" : "Up"}</span>
    </div>
  )
}
