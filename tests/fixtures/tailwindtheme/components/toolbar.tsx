export function Toolbar() {
  return (
    <div className="bg-surface border-edge flex gap-2 border-b p-2">
      <button className="text-ink-quiet hover:text-ink">Filter</button>
      <button className="text-ink-quiet hover:text-ink">Sort</button>
      <span className="text-emerald-600">Saved</span>
    </div>
  )
}
