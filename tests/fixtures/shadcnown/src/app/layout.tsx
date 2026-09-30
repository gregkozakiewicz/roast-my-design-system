import "./globals.css"
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="bg-surface text-ink">{children}</body></html>
}
