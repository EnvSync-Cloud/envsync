const NewTestimonial = () => {
  return (
    <section className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <blockquote className="text-2xl font-medium leading-relaxed text-foreground md:text-3xl">
            "EnvSync eliminated our .env file chaos overnight. We went from 3-hour config debugging sessions to zero incidents. The approval gates alone saved us from two production outages."
          </blockquote>
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              SK
            </div>
            <div className="text-left">
              <div className="font-semibold text-foreground">Sarah Kim</div>
              <div className="text-sm text-muted-foreground">Platform Lead, Streamline</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewTestimonial;
