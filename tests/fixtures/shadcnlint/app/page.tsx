import { Button } from "@/components/ui/button"
export default function Page() {
  return (
    <main className="p-6">
      <p className="text-slate-500">Muted by palette, not by the theme.</p>
      <span className="bg-amber-100 text-amber-800">Allowed by the lint config.</span>
      <Button>Save</Button>
    </main>
  )
}
