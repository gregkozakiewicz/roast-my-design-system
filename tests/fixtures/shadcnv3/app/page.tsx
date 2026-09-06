import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Page() {
  return (
    <main className="p-8 bg-background">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-foreground">Fixture</h1>
        <p className="text-muted-foreground">shadcn on Tailwind v3: tokens are bare HSL triplets.</p>
        <Button>Primary</Button>
        <Button variant="destructive">Delete</Button>
      </Card>
    </main>
  );
}
