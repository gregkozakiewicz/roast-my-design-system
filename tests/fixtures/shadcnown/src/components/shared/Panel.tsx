import { Card } from "@/components/ui/card"
export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="bg-surface text-ink border-edge"><h2 className="text-ink font-medium">{title}</h2><div className="text-ink-quiet">{children}</div></Card>
}
