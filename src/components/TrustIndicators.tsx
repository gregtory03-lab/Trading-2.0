import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, Lock, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export const TrustIndicators = () => {
  const { language, translations } = useLanguage();
  const t = (key: string) => translations[language]?.[key] || key;

  return (
    <section id="platform" className="py-16 px-6 bg-muted/20 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h3 className="text-2xl md:text-3xl font-bold mb-4">
            {t('trustedBy')}
          </h3>
          <p className="text-muted-foreground">
            {t('trustDescription')}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h4 className="font-semibold mb-2">{t('secRegisteredTitle')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('secRegisteredText')}
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-accent" />
            </div>
            <h4 className="font-semibold mb-2">{t('sipcProtected')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('sipcProtectedText')}
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h4 className="font-semibold mb-2">{t('finraMember')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('finraMemberText')}
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="h-8 w-8 text-accent" />
            </div>
            <h4 className="font-semibold mb-2">{t('awardWinning')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('awardWinningText')}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-4 mt-12">
          <Badge variant="outline" className="px-4 py-2 text-sm border-primary/30">
            {t('sslEncryption')}
          </Badge>
          <Badge variant="outline" className="px-4 py-2 text-sm border-accent/30">
            {t('tfaAuthentication')}
          </Badge>
          <Badge variant="outline" className="px-4 py-2 text-sm border-primary/30">
            {t('coldStorage')}
          </Badge>
          <Badge variant="outline" className="px-4 py-2 text-sm border-accent/30">
            {t('securityMonitoring')}
          </Badge>
        </div>
      </div>
    </section>
  );
};