import { Clock3 } from "lucide-react";
import { PageHeader, Card, CardBody, Badge } from "./ui";

export function ComingSoon({
  title,
  description,
  phase,
  points,
}: {
  title: string;
  description: string;
  phase: string;
  points: string[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card>
        <CardBody className="pt-6">
          <div className="flex items-center gap-2">
            <Clock3 size={16} className="text-warning" />
            <span className="text-sm font-medium">Planned</span>
            <Badge tone="accent">{phase}</Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">This module will include:</p>
          <ul className="mt-2 space-y-1.5">
            {points.map((p) => (
              <li key={p} className="flex gap-2 text-sm">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                {p}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
