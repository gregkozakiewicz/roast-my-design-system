import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { StatusPill } from "@/components/shared/StatusPill"

export default function Page() {
  return (
    <main className="p-6 text-foreground">
      <Card className="border-border">
        <h1 className="text-lg font-semibold text-slate-900">Surveys</h1>
        <p className="text-sm text-slate-500">Three open, one closed.</p>
        <StatusPill live />
        <Button className="bg-primary text-primary-foreground">New survey</Button>
      </Card>
    </main>
  )
}
