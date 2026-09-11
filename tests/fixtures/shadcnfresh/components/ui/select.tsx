import * as React from "react"
import { cn } from "cn"

function Select({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="select" className={cn("bg-card text-card-foreground rounded-lg border", className)} {...props} />
}

export { Select }
