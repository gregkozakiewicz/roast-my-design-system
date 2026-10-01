import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SiteRow } from "@/components/shared/SiteRow"
import { Usage } from "@/components/shared/Usage"

export default function Page() {
  return (
    <main className="p-6 text-neutral-900 dark:text-neutral-100">
      <Card className="border-neutral-200">
        <SiteRow name="shop" down />
        <SiteRow name="blog" down={false} />
        <Usage pct={93} />
        <Button>Add site</Button>
      </Card>
    </main>
  )
}
