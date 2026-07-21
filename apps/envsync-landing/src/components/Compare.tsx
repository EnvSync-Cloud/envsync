import { Check, Minus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CellValue = "check" | "x" | "minus";

interface ComparisonRow {
  feature: string;
  envsync: CellValue;
  doppler: CellValue;
  vault: CellValue;
  dotenv: CellValue;
}

const rows: ComparisonRow[] = [
  { feature: "Environment promotion flow", envsync: "check", doppler: "minus", vault: "minus", dotenv: "x" },
  { feature: "Approval gates before prod", envsync: "check", doppler: "minus", vault: "minus", dotenv: "x" },
  { feature: "Versioned rollback context", envsync: "check", doppler: "check", vault: "minus", dotenv: "x" },
  { feature: "Self-host option", envsync: "check", doppler: "x", vault: "check", dotenv: "check" },
  { feature: "Audit history on changes", envsync: "check", doppler: "check", vault: "check", dotenv: "x" },
];

const CellIcon = ({ value }: { value: CellValue }) => {
  switch (value) {
    case "check":
      return <Check className="mx-auto h-5 w-5 text-emerald-500" />;
    case "x":
      return <X className="mx-auto h-5 w-5 text-red-500/80" />;
    case "minus":
      return <Minus className="mx-auto h-5 w-5 text-yellow-500/80" />;
  }
};

const Compare = () => {
  return (
    <section className="container mx-auto px-4 md:px-8 py-16 md:py-24">
      <div className="grid gap-0 lg:grid-cols-[0.74fr_1.26fr]">
        <div className="border border-border bg-[hsl(var(--surface-1))] p-6 md:p-8">
          <div className="mb-4 inline-flex items-center gap-2 border border-border bg-[hsl(var(--surface-2))] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Compare
          </div>
          <h2 className="max-w-sm text-3xl font-bold leading-tight text-foreground md:text-4xl">
            Compare the delivery workflow, not just the secret store.
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">
            The difference shows up when config moves through approvals, CI, and rollback.
          </p>
        </div>

        <div className="w-full overflow-x-auto border border-border bg-[hsl(var(--surface-1))]">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[250px] py-4 pl-6 text-sm font-semibold text-foreground">Workflow capability</TableHead>
                <TableHead className="border-x border-primary/30 bg-primary/10 py-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-base font-bold text-foreground">EnvSync</span>
                    <Badge className="rounded-none border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10">
                      Delivery-focused
                    </Badge>
                  </div>
                </TableHead>
                <TableHead className="py-4 text-center text-sm font-semibold text-foreground">Doppler</TableHead>
                <TableHead className="py-4 text-center text-sm font-semibold text-foreground">Vault</TableHead>
                <TableHead className="py-4 text-center text-sm font-semibold text-foreground">.env files</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.feature} className="border-border transition-colors hover:bg-[hsl(var(--surface-2))]">
                  <TableCell className="py-3 pl-6 text-sm font-medium text-foreground">{row.feature}</TableCell>
                  <TableCell className="border-x border-primary/20 bg-primary/[0.06] py-3 text-center">
                    <CellIcon value={row.envsync} />
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <CellIcon value={row.doppler} />
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <CellIcon value={row.vault} />
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <CellIcon value={row.dotenv} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
};

export default Compare;
