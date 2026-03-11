import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Stat {
  label: string;
  value: number;
  suffix: string;
}

const stats: Stat[] = [
  { label: "GitHub Stars", value: 10, suffix: "+" },
  { label: "Contributors", value: 15, suffix: "+" },
  { label: "Secrets Synced", value: 1500, suffix: "+" },
  { label: "Teams", value: 75, suffix: "+" },
];

const useCountUp = (target: number, isVisible: boolean, duration = 2000) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target, isVisible, duration]);

  return count;
};

const formatNumber = (n: number): string => {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  }
  return n.toString();
};

const StatCard = ({ stat, isVisible }: { stat: Stat; isVisible: boolean }) => {
  const count = useCountUp(stat.value, isVisible);
  return (
    <div className="py-6 md:py-16 border border-border bg-[hsl(var(--surface-1))] p-6 text-center transition-colors hover:border-primary/40">
      <div className="mb-2 text-4xl font-bold tabular-nums text-foreground md:text-6xl">
        {formatNumber(count)}
        {stat.suffix}
      </div>
      <div className="text-sm md:text-lg font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</div>
    </div>
  );
};

const SocialProof = () => {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="container mx-auto border-x border-t border-border p-0"
    >
      <div className="relative container mx-auto px-0 z-10">
        {/* <motion.div */}
        {/*   initial={{ opacity: 0, y: 20 }} */}
        {/*   whileInView={{ opacity: 1, y: 0 }} */}
        {/*   viewport={{ once: true }} */}
        {/*   transition={{ duration: 0.35 }} */}
        {/*   className="mb-10 text-center" */}
        {/* > */}
        {/*   <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl"> */}
        {/*     Trusted by engineering teams */}
        {/*   </h2> */}
        {/* </motion.div> */}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="grid w-full grid-cols-2 gap-0 md:grid-cols-4"
        >
          {stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} isVisible={isVisible} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default SocialProof;
