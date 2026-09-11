import * as React from "react"
import { cn } from "cn"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={cn("bg-card text-card-foreground rounded-lg border", className)} {...props} />
}

export { Card }
