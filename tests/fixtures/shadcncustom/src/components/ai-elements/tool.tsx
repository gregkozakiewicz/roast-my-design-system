"use client";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function Tool({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-md border text-yellow-600 bg-yellow-50", className)} {...props}><Badge>tool</Badge></div>;
}
