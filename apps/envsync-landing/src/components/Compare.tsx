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
    <section className="py-32 bg-slate-950 border-t border-white/[0.05] relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            See how EnvSync{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              compares
            </span>
          </h2>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto font-light">
            The best of open source and enterprise, without the trade-offs.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="max-w-5xl mx-auto overflow-x-auto rounded-2xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm"
        >
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.05] hover:bg-transparent">
                <TableHead className="text-slate-300 w-[250px] font-semibold text-base py-6 pl-8">Feature</TableHead>
                <TableHead className="text-center bg-emerald-500/10 py-6 border-l border-r border-emerald-500/20">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-white font-bold text-lg">EnvSync</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-xs font-semibold px-2 py-0.5">
                      Recommended
                    </Badge>
                  </div>
                </TableHead>
                <TableHead className="text-center text-slate-300 py-6 font-semibold">Doppler</TableHead>
                <TableHead className="text-center text-slate-300 py-6 font-semibold">Vault</TableHead>
                <TableHead className="text-center text-slate-300 py-6 font-semibold border-r border-transparent">.env files</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.feature} className="border-white/[0.05] hover:bg-white/[0.02] transition-colors">
                  <TableCell className="text-neutral-300 font-medium pl-8 py-5">
                    {row.feature}
                  </TableCell>
                  <TableCell className="text-center bg-emerald-500/[0.03] border-l border-r border-emerald-500/10 py-5">
                    <CellIcon value={row.envsync} />
                  </TableCell>
                  <TableCell className="text-center py-5">
                    <CellIcon value={row.doppler} />
                  </TableCell>
                  <TableCell className="text-center py-5">
                    <CellIcon value={row.vault} />
                  </TableCell>
                  <TableCell className="text-center py-5">
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
