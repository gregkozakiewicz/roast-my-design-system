import * as React from "react"
import { cn } from "@/lib/utils"
export function Input({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="input" className={cn("rounded-lg border bg-card text-card-foreground", className)} {...props} />
}
