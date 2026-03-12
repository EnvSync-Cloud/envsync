import { Terminal, Upload, RefreshCw, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    number: 1,
    icon: Terminal,
    title: "Install the CLI",
    code: "npm install -g @envsync/cli",
  },
  {
    number: 2,
    icon: Upload,
    title: "Push your .env",
    code: "envsync push --env .env",
  },
  {
    number: 3,
    icon: RefreshCw,
    title: "Sync environments",
    code: "envsync pull --env production",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const stepVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5 }
  }
};

const HowItWorks = () => {
  return (
    <section className="container mx-auto border-x border-t border-border py-0 px-0">
      <div className="container mx-auto px-0">
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
              Get started in three steps
            </h2>
            <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
              From install to production sync in three repeatable commands.
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative grid w-full grid-cols-1 gap-0 md:grid-cols-3"
        >
          {steps.map((step, index) => (
            <motion.div
              variants={stepVariants}
              key={step.number}
              className="group relative border border-border bg-[hsl(var(--surface-1))] p-6"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center border border-border bg-[hsl(var(--surface-2))] transition-colors group-hover:border-primary/50">
                <step.icon className="h-6 w-6 text-primary" />
              </div>

              <span className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Step {step.number}
              </span>

              <h3 className="mb-5 text-2xl font-semibold text-foreground">{step.title}</h3>

              <div className="border border-border bg-[hsl(var(--surface-2))] p-4 text-left">
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Command</p>
                <code className="block font-mono text-xs text-foreground sm:text-sm">
                  <span className="text-primary">$</span> {step.code}
                </code>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
