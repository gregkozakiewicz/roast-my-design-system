import { Card } from "@/components/ui/card"
import { Tabs } from "@/components/ui/tabs"

export default function Dashboard() {
  return (
    <div className="grid gap-4">
      <Card className="max-w-md">
        <Tabs />
        <span className="text-green-500">+20.1%</span>
        <span className="text-red-600">-3.2%</span>
      </Card>
    </div>
  )
}
