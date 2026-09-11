import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" />
        <Button type="submit" className="w-full">Login</Button>
      </Card>
    </div>
  )
}
