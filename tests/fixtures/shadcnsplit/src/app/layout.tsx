import "@/styles/globals.css"
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="bg-background text-foreground">{children}</body></html>
}
