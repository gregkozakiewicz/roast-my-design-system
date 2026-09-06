import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <main className="p-8 bg-white text-zinc-900">
      <h1 className="text-2xl font-bold">Utility-class shadcn</h1>
      <p className="text-zinc-500">No CSS variables by design.</p>
      <Button>Go</Button>
      <span className="text-[#e11d48]">one honest stray</span>
    </main>
  );
}
