import * as React from "react"
import { cn } from "@/lib/utils"
export function Label({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="label" className={cn("rounded-lg border bg-card text-card-foreground", className)} {...props} />
}
