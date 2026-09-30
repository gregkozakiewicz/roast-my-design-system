import { Badge } from "@/components/ui/badge"
export function StatusPill({ live }: { live: boolean }) {
  return <Badge className={live ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}>{live ? "Live" : "Draft"}</Badge>
}
