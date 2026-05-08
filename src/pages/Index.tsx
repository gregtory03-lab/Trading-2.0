import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { TrustIndicators } from "@/components/TrustIndicators";
import { Pricing } from "@/components/Pricing";
import { CallToAction } from "@/components/CallToAction";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Features />
      <TrustIndicators />
      <Pricing />
      <CallToAction />
      <Footer />
    </div>
  );
};

export default Index;
