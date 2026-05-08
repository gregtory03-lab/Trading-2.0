import { TrendingUp, MapPin, Mail } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border/50 py-12 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-background" />
            </div>
            <span className="text-xl font-bold">EdgeTrade Pro</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Professional cryptocurrency trading platform with advanced tools and real-time data.
          </p>
        </div>

        {/* Contact */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Contact Us</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <address className="not-italic">
                123 Main Street, Suite 456<br />
                New York, NY 10001<br />
                United States
              </address>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-primary" />
              <a href="mailto:support@edgetradewin" className="hover:text-foreground transition-colors">
                support@edgetradewin
              </a>
            </div>
          </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Quick Links</h3>
          <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/login" className="hover:text-foreground transition-colors">Login</a>
            <a href="/signup" className="hover:text-foreground transition-colors">Sign Up</a>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-border/50 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} EdgeTrade Pro. All rights reserved.</p>
      </div>
    </footer>
  );
};
