import * as React from "react"
import { cn } from "cn"

function Tabs({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="tabs" className={cn("bg-card text-card-foreground rounded-lg border", className)} {...props} />
}

export { Tabs }
