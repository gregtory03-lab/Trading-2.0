import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";

export const Pricing = () => {
  const { language, translations } = useLanguage();
  const t = (key: string) => translations[language]?.[key] || key;
  const navigate = useNavigate();

  const plans = [
    {
      name: "Starter",
      price: "$0",
      period: t('perMonth') || "/month",
      description: t('starterDesc') || "Perfect for beginners exploring crypto trading",
      features: [
        t('basicTrading') || "Basic trading features",
        t('limitedCryptos') || "Access to 10 cryptocurrencies",
        t('standardSupport') || "Standard support",
        t('basicCharts') || "Basic charting tools",
      ],
      buttonText: t('getStartedFree') || "Get Started Free",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "$29",
      period: t('perMonth') || "/month",
      description: t('proDesc') || "For active traders who need advanced tools",
      features: [
        t('advancedTrading') || "Advanced trading features",
        t('unlimitedCryptos') || "Access to 50+ cryptocurrencies",
        t('prioritySupport') || "Priority 24/7 support",
        t('advancedCharts') || "Advanced charting & analytics",
        t('lowerFees') || "Lower trading fees",
        t('apiAccess') || "API access",
      ],
      buttonText: t('startProTrial') || "Start Pro Trial",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: t('custom') || "Custom",
      period: "",
      description: t('enterpriseDesc') || "For institutions and high-volume traders",
      features: [
        t('allProFeatures') || "All Pro features",
        t('dedicatedManager') || "Dedicated account manager",
        t('customLiquidity') || "Custom liquidity solutions",
        t('whiteLabel') || "White-label options",
        t('sla') || "SLA guarantees",
        t('customIntegrations') || "Custom integrations",
      ],
      buttonText: t('contactSales') || "Contact Sales",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 px-6 bg-muted/10 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {t('simplePricing') || "Simple, Transparent Pricing"}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('pricingDescription') || "Choose the plan that fits your trading needs. No hidden fees."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative bg-gradient-card border-border/50 transition-all duration-300 hover:shadow-glow ${
                plan.highlighted
                  ? "border-primary shadow-lg scale-105"
                  : "hover:border-primary/30"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    {t('mostPopular') || "Most Popular"}
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full mt-6 ${
                    plan.highlighted
                      ? "bg-gradient-primary hover:animate-pulse-glow"
                      : ""
                  }`}
                  variant={plan.highlighted ? "default" : "outline"}
                  onClick={() => navigate('/signup')}
                >
                  {plan.buttonText}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
