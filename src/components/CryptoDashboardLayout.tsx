import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import GlobalNotificationListener from "@/components/GlobalNotificationListener";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CryptoDashboardLayoutProps {
  children: React.ReactNode;
}

const CryptoDashboardLayout = ({ children }: CryptoDashboardLayoutProps) => {
  const { user } = useAuth();
  const [vipPackage, setVipPackage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchVip = async () => {
      const { data } = await supabase
        .from('vip_memberships')
        .select('package_name')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setVipPackage(data?.package_name || null);
    };
    fetchVip();

    const channel = supabase
      .channel('vip-header')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_memberships', filter: `user_id=eq.${user.id}` }, () => {
        fetchVip();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <SidebarProvider>
      <GlobalNotificationListener />
      <div className="min-h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 sm:h-14 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-2 sm:px-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <SidebarTrigger />
              <h1 className="text-sm sm:text-lg font-semibold">Dashboard</h1>
              {vipPackage && (
                <Badge className="bg-gradient-to-r from-yellow-500 to-amber-400 text-white border-0 gap-1 px-2 py-0.5 text-xs animate-pulse">
                  <Crown className="h-3 w-3" />
                  VIP {vipPackage}
                </Badge>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default CryptoDashboardLayout;