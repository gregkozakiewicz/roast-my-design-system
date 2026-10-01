import { Button } from "@/modules/ui/components/button";

export default function Page() {
  return (
    <main className="p-6">
      <h1 className="text-slate-900 text-2xl">Surveys</h1>
      <p className="text-slate-500">Create a survey and share it.</p>
      <p className="text-slate-500">Responses arrive here.</p>
      <p className="text-slate-500 dark:text-slate-400">Nothing yet.</p>
      <section className="border border-slate-200 bg-slate-50 rounded-lg">
        <h2 className="text-brand-dark">Your first survey</h2>
        <span className="bg-brand text-primary-foreground">New</span>
        <span className="text-info">Draft</span>
        <a className="underline" style={{ color: "var(--app-brand)" }}>Preview</a>
        <span className="text-ghost-ink">Archived</span>
        <div className="bg-white dark:bg-black" style={{ borderColor: "#e2e8f0", color: "var(--app-label)" }}>
          <Button>Create survey</Button>
        </div>
      </section>
    </main>
  );
}
