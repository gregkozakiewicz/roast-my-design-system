import * as React from "react"
import { cn } from "cn"

function Badge({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="badge" className={cn("bg-card text-card-foreground rounded-lg border", className)} {...props} />
}

export { Badge }
