// The package's own component: its classes read the package's own config,
// never the app's @theme (bg-primary here is oklch(0.205 0 0), not #0f172a)
export function SurveyCard({ title, error }: { title: string; error?: string }) {
  return (
    <div className="bg-background border border-border rounded-md p-4">
      <h3 className="text-foreground">{title}</h3>
      <p className="text-muted-foreground">Tap to answer</p>
      <button className="bg-primary text-primary-foreground">Next</button>
      {error ? <p className="text-destructive">{error}</p> : null}
    </div>
  );
}
