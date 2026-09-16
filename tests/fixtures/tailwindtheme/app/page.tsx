import { Panel } from "@/components/panel"
export default function Page() {
  return (
    <main className="bg-surface text-ink p-6">
      <h1 className="text-ink font-medium">Reports</h1>
      <p className="text-ink-quiet">Everything from the theme.</p>
      <Panel />
      <button className="bg-brand text-surface rounded-md px-3 py-2">Save</button>
      <button className="bg-brand-strong text-surface rounded-md px-3 py-2">Save all</button>
      <span className="border-edge border text-danger">Careful</span>
    </main>
  )
}
