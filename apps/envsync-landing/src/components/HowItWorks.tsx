import { Terminal, Upload, RefreshCw, ArrowRight } from "lucide-react";

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

const HowItWorks = () => {
  return (
    <section className="py-24 bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Get started in{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              three steps
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            From installation to syncing secrets across your team in under a
            minute.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start relative">
          {steps.map((step, index) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              {/* Arrow between steps - hidden on mobile */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 -right-4 translate-x-1/2 z-10">
                  <ArrowRight className="h-6 w-6 text-slate-600" />
                </div>
              )}

              {/* Numbered circle */}
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-6">
                <step.icon className="h-8 w-8 text-emerald-400" />
              </div>

              {/* Step number badge */}
              <span className="text-sm font-semibold text-emerald-400 mb-2">
                Step {step.number}
              </span>

              {/* Title */}
              <h3 className="text-xl font-semibold text-white mb-4">
                {step.title}
              </h3>

              {/* Code mockup */}
              <div className="w-full bg-slate-800 border border-slate-700 rounded-lg p-4">
                <code className="text-emerald-400 text-sm font-mono">
                  $ {step.code}
                </code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
