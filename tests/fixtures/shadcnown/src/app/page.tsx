import { Button } from "@/components/ui/button"
import { Panel } from "@/components/shared/Panel"
import { Notice } from "@/components/shared/Notice"

export default function Page() {
  return (
    <main className="bg-surface text-ink p-6">
      <Panel title="Connections">
        <Button className="bg-brand text-surface">Add</Button>
        <Notice tone="danger">Two syncs failed.</Notice>
        <span className="text-ink-quiet border-edge">Last run an hour ago</span>
        <span className="text-ink bg-surface-raised">All quiet</span>
      </Panel>
    </main>
  )
}
