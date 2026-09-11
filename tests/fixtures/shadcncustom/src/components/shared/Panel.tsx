import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function Panel() {
  return (
    <Card className="bg-blue-100 text-blue-900 font-bold dark:bg-gray-900">
      <Badge className="bg-gray-200 text-gray-700">Beta</Badge>
      <p className="text-gray-500 dark:text-gray-400">Some copy in a tin grey.</p>
      <Button className="border border-gray-300 bg-white text-black hover:bg-gray-100">Cancel</Button>
    </Card>
  )
}
