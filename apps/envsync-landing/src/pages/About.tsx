
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Shield, Users, Target, Award, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const About = () => {
  // const stats = [
  //   { value: "50K+", label: "Developers Trust Us" },
  //   { value: "99.9%", label: "Uptime Guarantee" },
  //   { value: "500+", label: "Enterprise Customers" },
  //   { value: "24/7", label: "Expert Support" }
  // ];

  const values = [
    {
      icon: Shield,
      title: "Security First",
      description: "Every decision we make prioritizes the security and privacy of your sensitive data."
    },
    {
      icon: Users,
      title: "Developer Experience",
      description: "We build tools that developers love to use, with intuitive interfaces and powerful features."
    },
    {
      icon: Target,
      title: "Reliability",
      description: "Your applications depend on us, so we've built our infrastructure for maximum reliability."
    },
    {
      icon: Award,
      title: "Innovation",
      description: "We're constantly pushing the boundaries of what's possible in environment management."
    }
  ];

  const team = [
    {
      name: "Jyotirmoy Bandyopadhayaya",
      role: "Founder",
      github: "BRAVO68WEB",
      profile_image: "https://safe.b68dev.xyz/XH5ClBR3.jpg",
      bio: "A seasoned software engineer with over 4 years of experience in building scalable systems and developer tools.",
    },
    {
      name: "Kostav Mondal",
      role: "Co-Founder",
      github: "XxThunderBlastxX",
      profile_image: "https://safe.b68dev.xyz/24ty6LRi.jpg",
      bio: "Go Developer | Passionate about creating efficient and secure backend systems.",
    },
    {
      name: "Siddharth Biswas",
      role: "Full Stack Developer",
      github: "Atlas2002",
      profile_image: "https://safe.b68dev.xyz/UsJUCLfH.jpg",
      bio: "Full Stack Developer | Experienced in building modern web applications with a focus on user experience.",
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px]" />
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              About <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">EnvSync</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              We're on a mission to make environment variable management secure, simple, and scalable for development teams worldwide.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-emerald-400 mb-2">
                  {stat.value}
                </div>
                <div className="text-slate-300">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* Mission Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-6">Our Mission</h2>
              <p className="text-xl text-slate-300">
                To eliminate the complexity and security risks associated with managing environment variables and secrets across modern development workflows.
              </p>
            </div>
            
            <div className="bg-slate-800 rounded-2xl p-8 md:p-12 mb-16">
              <h3 className="text-2xl font-bold text-white mb-6">The Problem We're Solving</h3>
              <p className="text-slate-300 mb-6">
                Traditional approaches to managing environment variables are fragmented, insecure, and don't scale with modern development practices. Developers waste countless hours dealing with configuration drift, security vulnerabilities, and deployment failures caused by misconfigured environments.
              </p>
              <p className="text-slate-300">
                EnvSync provides a unified, secure, and developer-friendly solution that integrates seamlessly into existing workflows while providing enterprise-grade security and reliability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-slate-800/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-6">Our Values</h2>
              <p className="text-xl text-slate-300">
                These principles guide everything we do at EnvSync.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {values.map((value, index) => (
                <div key={index} className="bg-slate-800 rounded-xl p-8">
                  <div className="flex items-center mb-4">
                    <div className="bg-emerald-600/20 p-3 rounded-lg mr-4">
                      <value.icon className="h-6 w-6 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">{value.title}</h3>
                  </div>
                  <p className="text-slate-300">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-6">Meet Our Team</h2>
              <p className="text-xl text-slate-300">
                Experienced engineers and product leaders dedicated to solving developer problems.
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-8">
              {team.map((member, index) => (
                <div key={index} className="bg-slate-800 rounded-xl p-8 text-center max-w-sm">
                  <div className="mb-4">
                    <img 
                      src={member.profile_image}
                      alt={`${member.name}'s avatar`}
                      className="w-24 h-24 rounded-full mx-auto mb-4"
                    />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{member.name}</h3>
                  <p className="text-emerald-400 mb-4">{member.role}</p>
                  <p className="text-slate-300 text-sm">{member.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to join thousands of developers?
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Experience the future of environment variable management today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/onboarding">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4">
                  Start Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
