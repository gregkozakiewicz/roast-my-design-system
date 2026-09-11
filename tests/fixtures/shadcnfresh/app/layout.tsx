import "./globals.css"
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body className="bg-background text-foreground">{children}</body></html>
}
