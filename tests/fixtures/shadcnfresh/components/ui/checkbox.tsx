import * as React from "react"
import { cn } from "cn"

function Checkbox({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="checkbox" className={cn("bg-card text-card-foreground rounded-lg border", className)} {...props} />
}

export { Checkbox }
