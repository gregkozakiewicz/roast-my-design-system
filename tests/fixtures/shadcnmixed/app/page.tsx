import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar } from "@/components/ui/Avatar"
import { StatusBanner } from "@/components/ui/status-banner"
import { DataList } from "@/components/ui/data-list"

export default function Page() {
  return (
    <main className="p-6 text-foreground">
      <Card className="border-border">
        <Avatar />
        <StatusBanner tone="paused">Two syncs paused.</StatusBanner>
        <DataList items={["one", "two"]} />
        <Button>Resume</Button>
      </Card>
    </main>
  )
}
