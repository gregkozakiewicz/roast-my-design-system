import * as React from "react";
import { cn } from "@/lib/utils";

// Installed by `shadcn add accordion`, not used anywhere yet.
export function Accordion({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-input bg-background p-2", className)} {...props} />;
}
