import { Check, X, Minus } from "lucide-react";
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
      return <Check className="h-5 w-5 text-emerald-400 mx-auto" />;
    case "x":
      return <X className="h-5 w-5 text-red-400 mx-auto" />;
    case "minus":
      return <Minus className="h-5 w-5 text-yellow-400 mx-auto" />;
  }
};

const Compare = () => {
  return (
    <section className="py-24 bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            See how EnvSync{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              compares
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            The best of open source and enterprise, without the trade-offs.
          </p>
        </div>

        <div className="max-w-4xl mx-auto overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-300 w-[200px]">Feature</TableHead>
                <TableHead className="text-center bg-emerald-500/5">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-white font-semibold">EnvSync</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                      Recommended
                    </Badge>
                  </div>
                </TableHead>
                <TableHead className="text-center text-slate-300">Doppler</TableHead>
                <TableHead className="text-center text-slate-300">Vault</TableHead>
                <TableHead className="text-center text-slate-300">.env files</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.feature} className="border-slate-800 hover:bg-slate-800/50">
                  <TableCell className="text-slate-300 font-medium">
                    {row.feature}
                  </TableCell>
                  <TableCell className="text-center bg-emerald-500/5">
                    <CellIcon value={row.envsync} />
                  </TableCell>
                  <TableCell className="text-center">
                    <CellIcon value={row.doppler} />
                  </TableCell>
                  <TableCell className="text-center">
                    <CellIcon value={row.vault} />
                  </TableCell>
                  <TableCell className="text-center">
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
