import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export const CallToAction = () => {
  const navigate = useNavigate();
  const { enterDemoMode } = useAuth();
  const { language, translations } = useLanguage();
  const t = (key: string) => translations[language]?.[key] || key;

  const handleDemoClick = () => {
    enterDemoMode();
    navigate('/dashboard');
  };

  return (
    <section id="support" className="py-24 px-6 bg-gradient-hero relative overflow-hidden scroll-mt-20">
      <div className="absolute inset-0 bg-gradient-primary opacity-10"></div>
      
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          {t('readyToDominate')}
        </h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          {t('ctaDescription')}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Button 
            size="lg" 
            className="bg-gradient-primary hover:animate-pulse-glow text-lg px-8 py-4 h-auto"
            onClick={() => navigate('/signup')}
          >
            {t('openFreeAccount')}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            className="text-lg px-8 py-4 h-auto border-primary/30 hover:border-primary hover:bg-primary/10"
            onClick={handleDemoClick}
          >
            <Play className="mr-2 h-5 w-5" />
            {t('platformDemo')}
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p>• {t('minDeposit')}</p>
          <p>• {t('freeRealtimeData')}</p>
          <p>• {t('customerSupport247')}</p>
        </div>
      </div>
    </section>
  );
};