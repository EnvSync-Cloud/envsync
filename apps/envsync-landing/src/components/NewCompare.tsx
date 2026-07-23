import { SectionHeading } from "@/components/primitives/SectionHeading"
import { CropMarkFrame } from "@/components/primitives/CropMarkFrame"

const features = [
  { name: "Environment promotion", envsync: true, dotenv: false, vault: "partial" as const },
  { name: "Approval gates", envsync: true, dotenv: false, vault: "partial" as const },
  { name: "Version history", envsync: true, dotenv: false, vault: true },
  { name: "CLI-first workflow", envsync: true, dotenv: true, vault: true },
  { name: "Self-host option", envsync: true, dotenv: true, vault: true },
  { name: "Zero-knowledge encryption", envsync: true, dotenv: false, vault: true },
]

function StatusGlyph({ value }: { value: boolean | "partial" }) {
  if (value === true) return <span className="font-mono text-sm text-accent-ink">&#10003;</span>
  if (value === "partial") return <span className="font-mono text-sm text-status-warning">~</span>
  return <span className="font-mono text-sm text-muted-foreground/60">&mdash;</span>
}

const NewCompare = () => {
  return (
    <section className="border-t border-border bg-background bg-grid-box">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 md:py-24">
        <SectionHeading
          align="center"
          eyebrow="COMPARE"
          title="How EnvSync compares"
          description="Built for teams who need more than a secret store."
        />

        <div className="mt-16 mx-auto max-w-3xl">
          <CropMarkFrame>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-6 py-3 text-left font-mono text-mono-label text-muted-foreground">
                      Feature
                    </th>
                    <th className="px-6 py-3 text-center font-mono text-mono-label text-accent-ink">
                      EnvSync
                    </th>
                    <th className="px-6 py-3 text-center font-mono text-mono-label text-muted-foreground">
                      .env files
                    </th>
                    <th className="px-6 py-3 text-center font-mono text-mono-label text-muted-foreground">
                      Vault
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) => (
                    <tr
                      key={feature.name}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-6 py-3.5 text-sm text-foreground">
                        {feature.name}
                      </td>
                      <td className="bg-accent-surface px-6 py-3.5 text-center">
                        <StatusGlyph value={feature.envsync} />
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <StatusGlyph value={feature.dotenv} />
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <StatusGlyph value={feature.vault} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CropMarkFrame>
        </div>
      </div>
    </section>
  )
}

export default NewCompare
