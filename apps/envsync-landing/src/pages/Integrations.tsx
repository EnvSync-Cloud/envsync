
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Shield, Cloud, Zap, Disc } from "lucide-react";

const Integrations = () => {
  const notificationIntegrations = [
    {
      name: "Slack",
      description: "Get real-time notifications about environment changes and security alerts directly in your Slack channels.",
      icon: "/images/Slack.svg",
      status: "coming-soon",
      color: "text-slate-300",
      bgColor: "bg-slate-800"
    },
    {
      name: "Discord",
      description: "Receive instant updates and alerts about your environment variables in your Discord server.",
      icon: "https://raw.githubusercontent.com/tandpfun/skill-icons/refs/heads/main/icons/Discord.svg",
      status: "coming-soon", 
      color: "text-slate-300",
      bgColor: "bg-slate-800"
    }
  ];

  const kmsIntegrations = [
    {
      name: "Vercel",
      description: "Seamlessly sync your environment variables with Vercel deployments.",
      icon: "https://raw.githubusercontent.com/tandpfun/skill-icons/refs/heads/main/icons/Vercel-Dark.svg",
      status: "coming-soon",
      color: "text-slate-300",
      bgColor: "bg-slate-800"
    },
    {
      name: "CloudFlare",
      description: "Integrate with CloudFlare Workers and Pages for secure environment management.",
      icon: "https://raw.githubusercontent.com/tandpfun/skill-icons/refs/heads/main/icons/Cloudflare-Dark.svg",
      status: "coming-soon",
      color: "text-slate-300",
      bgColor: "bg-slate-800"
    },
    {
      name: "AWS",
      description: "Connect with AWS services for enterprise-grade secret management.",
      icon: "https://raw.githubusercontent.com/tandpfun/skill-icons/refs/heads/main/icons/AWS-Dark.svg",
      status: "coming-soon",
      color: "text-slate-300",
      bgColor: "bg-slate-800"
    },
    {
      name: "Github Actions",
      description: "Automate your CI/CD workflows with secure environment variable management.",
      icon: "https://raw.githubusercontent.com/tandpfun/skill-icons/refs/heads/main/icons/GithubActions-Dark.svg",
      status: "coming-soon",
      color: "text-slate-300",
      bgColor: "bg-slate-800"
    },
    {
      name: "Vercel",
      description: "Seamlessly sync your environment variables with Vercel deployments.",
      icon: "https://raw.githubusercontent.com/tandpfun/skill-icons/refs/heads/main/icons/Vercel-Dark.svg",
      status: "coming-soon",
      color: "text-slate-300",
      bgColor: "bg-slate-800"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Integrations
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Connect EnvSync with your favorite tools and services to streamline your development workflow.
            </p>
          </div>

          {/* Notifications Section */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-slate-800 rounded-lg">
                <MessageCircle className="h-6 w-6 text-slate-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Notifications</h2>
                <p className="text-slate-300">Stay informed with real-time alerts</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {notificationIntegrations.map((integration) => (
                <Card key={integration.name} className="bg-slate-800 border-slate-700 hover:shadow-lg transition-shadow opacity-75">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${integration.bgColor}`}>
                          <img src={integration.icon} alt={`${integration.name} icon`} className={`h-6 w-6 ${integration.color}`} />
                        </div>
                        <CardTitle className="text-xl text-white">{integration.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-slate-400 border-slate-600">
                        Coming Soon
                      </Badge>
                    </div>
                    <CardDescription className="text-base text-slate-300">
                      {integration.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>

          {/* KMS Section */}
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-slate-800 rounded-lg">
                <Shield className="h-6 w-6 text-slate-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Key Management Systems</h2>
                <p className="text-slate-300">Enterprise-grade security integrations</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {kmsIntegrations.map((integration) => (
                <Card key={integration.name} className="bg-slate-800 border-slate-700 hover:shadow-lg transition-shadow opacity-75">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${integration.bgColor}`}>
                          <img src={integration.icon} alt={`${integration.name} icon`} className={`h-6 w-6 ${integration.color}`} />
                        </div>
                        <CardTitle className="text-xl text-white">{integration.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-slate-400 border-slate-600">
                        Coming Soon
                      </Badge>
                    </div>
                    <CardDescription className="text-base text-slate-300">
                      {integration.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <section className="mt-20 text-center">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12">
              <h3 className="text-3xl font-bold text-white mb-4">
                Need a custom integration?
              </h3>
              <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
                We're always looking to expand our integration ecosystem. Let us know what tools you'd like to see connected with EnvSync.
              </p>
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Request Integration
              </Button>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Integrations;
