import { Check, Minus, X } from "lucide-react";

const features = [
  { name: "Environment promotion", envsync: true, dotenv: false, vault: "partial" },
  { name: "Approval gates", envsync: true, dotenv: false, vault: "partial" },
  { name: "Version history", envsync: true, dotenv: false, vault: true },
  { name: "CLI-first workflow", envsync: true, dotenv: true, vault: true },
  { name: "Self-host option", envsync: true, dotenv: true, vault: true },
  { name: "Zero-knowledge encryption", envsync: true, dotenv: false, vault: true },
];

const StatusIcon = ({ value }: { value: boolean | string }) => {
  if (value === true) return <Check className="h-5 w-5 text-primary" />;
  if (value === "partial") return <Minus className="h-5 w-5 text-yellow-500" />;
  return <X className="h-5 w-5 text-muted-foreground/50" />;
};

const NewCompare = () => {
  return (
    <section className="border-b border-border bg-[#0a0f15]">
      <div className="container mx-auto px-4 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            How EnvSync compares
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built for teams who need more than a secret store.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl overflow-hidden rounded-xl border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Feature</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-primary">EnvSync</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">.env files</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Vault</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr key={feature.name} className="border-b border-border last:border-0">
                  <td className="px-6 py-4 text-sm text-foreground">{feature.name}</td>
                  <td className="px-6 py-4 text-center"><StatusIcon value={feature.envsync} /></td>
                  <td className="px-6 py-4 text-center"><StatusIcon value={feature.dotenv} /></td>
                  <td className="px-6 py-4 text-center"><StatusIcon value={feature.vault} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default NewCompare;
