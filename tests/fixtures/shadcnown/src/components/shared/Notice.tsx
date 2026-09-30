export function Notice({ tone, children }: { tone: "brand" | "danger"; children: React.ReactNode }) {
  return <p className={tone === "danger" ? "text-danger border-danger" : "text-brand border-brand"}>{children}</p>
}
