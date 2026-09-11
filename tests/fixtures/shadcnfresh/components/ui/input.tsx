import * as React from "react"
import { cn } from "cn"

function Input({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="input" className={cn("bg-card text-card-foreground rounded-lg border", className)} {...props} />
}

export { Input }
