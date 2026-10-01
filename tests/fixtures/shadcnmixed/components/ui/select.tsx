import * as React from "react"
import { cn } from "@/lib/utils"
export function Select({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="select" className={cn("rounded-lg border bg-card text-card-foreground", className)} {...props} />
}
