import * as React from "react"
import { cn } from "cn"

function Dialog({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog" className={cn("bg-card text-card-foreground rounded-lg border", className)} {...props} />
}

export { Dialog }
