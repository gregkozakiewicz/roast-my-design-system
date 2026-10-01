import * as React from "react"
import { cn } from "@/lib/utils"
export function Dialog({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog" className={cn("rounded-lg border bg-card text-card-foreground", className)} {...props} />
}
