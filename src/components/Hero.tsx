import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Shield, Zap, Play } from "lucide-react";
import heroImage from "@/assets/hero-trading.jpg";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const Hero = () => {
  const { language, translations } = useLanguage();
  const t = (key: string) => translations[language]?.[key] || key;
  const navigate = useNavigate();
  const { enterDemoMode } = useAuth();

  const handleDemoClick = () => {
    enterDemoMode();
    navigate('/dashboard');
  };
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-hero overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <img 
          src={heroImage} 
          alt="Trading Platform" 
          className="w-full h-full object-cover"
        />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center animate-fade-in">
        <div className="mb-8">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="text-foreground">{t('powerYourEdge')}</span>
          </h1>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="text-foreground">{t('tradeSmarter')}</span>
            <span className="text-foreground">.</span>{" "}
            <span className="text-primary">{t('winDaily')}</span>
            <span className="text-foreground">.</span>
          </h2>
        </div>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
          {t('heroDescription')}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Button 
            size="lg" 
            className="bg-gradient-primary hover:animate-pulse-glow text-lg px-8 py-4 h-auto"
            onClick={() => navigate('/signup')}
          >
            {t('startTradingNow')}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            className="text-lg px-8 py-4 h-auto border-primary/30 hover:border-primary hover:bg-primary/10"
            onClick={handleDemoClick}
          >
            <Play className="mr-2 h-5 w-5" />
            {t('watchDemo')}
          </Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Zap className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{t('realtimeData')}</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <TrendingUp className="h-5 w-5 text-accent" />
            <span className="text-sm font-medium">{t('advancedCharts')}</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <ArrowRight className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{t('fastExecution')}</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Shield className="h-5 w-5 text-accent" />
            <span className="text-sm font-medium">{t('secProtected')}</span>
          </div>
        </div>
      </div>
    </section>
  );
};