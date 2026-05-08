import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  Zap, 
  Shield, 
  BarChart3, 
  Clock, 
  DollarSign,
  Lock,
  Gauge
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export const Features = () => {
  const { language, translations } = useLanguage();
  const t = (key: string) => translations[language]?.[key] || key;

  const features = [
    {
      icon: Zap,
      titleKey: "realtimeMarketData",
      descKey: "realtimeMarketDataDesc",
      accent: "text-primary"
    },
    {
      icon: BarChart3,
      titleKey: "advancedCharting",
      descKey: "advancedChartingDesc",
      accent: "text-accent"
    },
    {
      icon: Gauge,
      titleKey: "directAccessRouting",
      descKey: "directAccessRoutingDesc",
      accent: "text-primary"
    },
    {
      icon: Shield,
      titleKey: "secRegistered",
      descKey: "secRegisteredDesc",
      accent: "text-accent"
    },
    {
      icon: Clock,
      titleKey: "subMillisecondExecution",
      descKey: "subMillisecondExecutionDesc",
      accent: "text-primary"
    },
    {
      icon: DollarSign,
      titleKey: "competitivePricing",
      descKey: "competitivePricingDesc",
      accent: "text-accent"
    },
    {
      icon: Lock,
      titleKey: "bankLevelSecurity",
      descKey: "bankLevelSecurityDesc",
      accent: "text-primary"
    },
    {
      icon: TrendingUp,
      titleKey: "advancedOrderTypes",
      descKey: "advancedOrderTypesDesc",
      accent: "text-accent"
    }
  ];

  return (
    <section id="features" className="py-24 px-6 bg-background scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {t('builtForProfessional')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('featuresDescription')}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={feature.titleKey}
              className="bg-gradient-card border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-glow animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader className="pb-4">
                <div className={`w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center mb-4`}>
                  <feature.icon className={`h-6 w-6 ${feature.accent}`} />
                </div>
                <CardTitle className="text-lg font-semibold text-foreground">
                  {t(feature.titleKey)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  {t(feature.descKey)}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};