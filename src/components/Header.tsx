import { Button } from "@/components/ui/button";
import { TrendingUp, Menu, X, Sun, Moon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";

export const Header = () => {
  const { language, setLanguage, translations } = useLanguage();
  const t = (key: string) => translations[language]?.[key] || key;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggleTheme = () => setIsDark((v) => !v);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { id: 'features', label: t('features') },
    { id: 'platform', label: t('platform') },
    { id: 'pricing', label: t('pricing') },
    { id: 'support', label: t('supportNav') },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-background" />
          </div>
          <span className="text-xl font-bold">EdgeTrade Pro</span>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a 
              key={link.id}
              href={`#${link.id}`}
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={(e) => handleNavClick(e, link.id)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        
        <div className="flex items-center gap-4">
          <select 
            className="px-2 py-1 text-xs sm:text-sm border rounded bg-background text-foreground"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en">🇺🇸 EN</option>
            <option value="es">🇪🇸 ES</option>
            <option value="fr">🇫🇷 FR</option>
            <option value="de">🇩🇪 DE</option>
            <option value="zh">🇨🇳 中文</option>
            <option value="sk">🇸🇰 SK</option>
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" className="hidden sm:inline-flex" asChild>
            <a href="/login">{t('login')}</a>
          </Button>
          <Button className="hidden sm:inline-flex bg-gradient-primary" asChild>
            <a href="/signup">{t('getStarted')}</a>
          </Button>
          
          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-background border-t border-border/50 shadow-lg">
          <nav className="flex flex-col px-6 py-4 space-y-4">
            {navLinks.map((link) => (
              <a 
                key={link.id}
                href={`#${link.id}`}
                className="text-foreground hover:text-primary transition-colors py-2"
                onClick={(e) => handleNavClick(e, link.id)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
              <Button variant="outline" className="w-full" asChild>
                <a href="/login">{t('login')}</a>
              </Button>
              <Button className="w-full bg-gradient-primary" asChild>
                <a href="/signup">{t('getStarted')}</a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
