import * as React from "react"
import { cn } from "cn"

function Button({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="button" className={cn("bg-card text-card-foreground rounded-lg border", className)} {...props} />
}

export { Button }
