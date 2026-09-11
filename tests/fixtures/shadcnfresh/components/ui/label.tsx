import * as React from "react"
import { cn } from "cn"

function Label({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="label" className={cn("bg-card text-card-foreground rounded-lg border", className)} {...props} />
}

export { Label }
