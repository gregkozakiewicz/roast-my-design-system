import * as React from "react"
import { cn } from "@/lib/utils"
export function StatusBanner({ tone, children }: { tone: "paused" | "live"; children: React.ReactNode }) {
  return <div className={cn("rounded-md border px-3 py-2 text-[13px]", tone === "paused" ? "bg-amber-50 text-amber-600" : "bg-background text-foreground")}>{children}</div>
}
