import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default function Page() {
  return (
    <main className="bg-background text-foreground flex flex-col gap-6 p-6">
      <Card className="mx-auto max-w-md">
        <Label>Email</Label>
        <Input />
        <Badge>New</Badge>
        <p className="text-muted-foreground text-sm">Semantic colours only, straight from the sheet.</p>
        <Button>Save</Button>
      </Card>
    </main>
  )
}
