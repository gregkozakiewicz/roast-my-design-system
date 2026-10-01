import * as React from "react"
export function DataList({ items }: { items: string[] }) {
  return <ul className="divide-y border-border text-muted-foreground">{items.map((i) => <li key={i} className="py-2">{i}</li>)}</ul>
}
