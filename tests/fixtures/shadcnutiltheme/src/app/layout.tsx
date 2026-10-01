import "./globals.css"
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="bg-white text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">{children}</body></html>
}
