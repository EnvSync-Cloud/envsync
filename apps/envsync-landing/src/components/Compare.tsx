import { Check, X, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
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
  { feature: "End-to-end encryption", envsync: "check", doppler: "check", vault: "check", dotenv: "x" },
  { feature: "Open source", envsync: "check", doppler: "x", vault: "check", dotenv: "check" },
  { feature: "CLI support", envsync: "check", doppler: "check", vault: "check", dotenv: "minus" },
  { feature: "Team management", envsync: "check", doppler: "check", vault: "check", dotenv: "x" },
  { feature: "GPG key management", envsync: "check", doppler: "x", vault: "minus", dotenv: "x" },
  { feature: "Secret versioning", envsync: "check", doppler: "check", vault: "check", dotenv: "x" },
  { feature: "Self-hosted option", envsync: "check", doppler: "x", vault: "check", dotenv: "check" },
  { feature: "Audit logging", envsync: "check", doppler: "check", vault: "check", dotenv: "x" },
  { feature: "Free to start", envsync: "check", doppler: "minus", vault: "check", dotenv: "check" },
  { feature: "Zero-Trust architecture", envsync: "check", doppler: "x", vault: "x", dotenv: "x" },
];

const CellIcon = ({ value }: { value: CellValue }) => {
  switch (value) {
    case "check":
      return <Check className="h-5 w-5 text-emerald-500 mx-auto" />;
    case "x":
      return <X className="h-5 w-5 text-red-500/80 mx-auto" />;
    case "minus":
      return <Minus className="h-5 w-5 text-yellow-500/80 mx-auto" />;
  }
};

const Compare = () => {
  return (
    <section className="container mx-auto border-x border-t border-border p-0">
      <div className="relative container mx-auto px-0 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 text-left md:p-8 md:py-12"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border) / 0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.7) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
          <div className="relative z-10">
            <h2 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
              See how EnvSync compares
            </h2>
            <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
              Compare operational depth and security coverage at a glance.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="w-full overflow-x-auto border border-border bg-[hsl(var(--surface-1))]"
        >
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[250px] py-5 pl-8 text-base font-semibold text-foreground">Feature</TableHead>
                <TableHead className="border-x border-primary/30 bg-primary/10 py-5 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-lg font-bold text-foreground">EnvSync</span>
                    <Badge className="rounded-none border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10">
                      Recommended
                    </Badge>
                  </div>
                </TableHead>
                <TableHead className="py-5 text-center font-semibold text-foreground">Doppler</TableHead>
                <TableHead className="py-5 text-center font-semibold text-foreground">Vault</TableHead>
                <TableHead className="py-5 text-center font-semibold text-foreground">.env files</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.feature} className="border-border transition-colors hover:bg-[hsl(var(--surface-2))]">
                  <TableCell className="py-4 pl-8 font-medium text-foreground">
                    {row.feature}
                  </TableCell>
                  <TableCell className="border-x border-primary/20 bg-primary/[0.06] py-4 text-center">
                    <CellIcon value={row.envsync} />
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    <CellIcon value={row.doppler} />
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    <CellIcon value={row.vault} />
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    <CellIcon value={row.dotenv} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      </div>
    </section>
  );
};

export default Compare;
