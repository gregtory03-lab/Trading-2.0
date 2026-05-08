import { 
  Wallet, 
  RefreshCcw, 
  History, 
  Shield, 
  CreditCard,
  Home,
  Settings,
  Star,
  MessageCircle,
  Crown
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { useLanguage } from "@/contexts/LanguageContext"
import { useUnreadSupportMessages } from "@/hooks/useUnreadSupportMessages"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/integrations/supabase/client"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  const { state } = useSidebar()
  const collapsed = state === "collapsed"
  const location = useLocation()
  const currentPath = location.pathname
  const { language, translations } = useLanguage()
  const t = (key: string) => translations[language]?.[key] || key
  const { unreadCount } = useUnreadSupportMessages()
  const { user } = useAuth()
  const [vipPackage, setVipPackage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const fetchVip = async () => {
      const { data } = await supabase
        .from('vip_memberships')
        .select('package_name')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setVipPackage(data?.package_name || null)
    }
    fetchVip()
    const channel = supabase
      .channel('vip-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_memberships', filter: `user_id=eq.${user.id}` }, () => fetchVip())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  const menuItems = [
    { titleKey: "overview", url: "/dashboard", icon: Home },
    { titleKey: "exchange", url: "/dashboard/exchange", icon: RefreshCcw },
    { titleKey: "withdraw", url: "/dashboard/withdraw", icon: CreditCard },
    { titleKey: "transactions", url: "/dashboard/transactions", icon: History },
    { titleKey: "walletAddress", url: "/dashboard/wallet", icon: Wallet },
    { titleKey: "vipTradingOffers", url: "/dashboard/vip-offers", icon: Star },
    { titleKey: "supportInbox", url: "/dashboard/support", icon: MessageCircle, showBadge: true },
    { titleKey: "kycVerification", url: "/dashboard/kyc", icon: Shield },
    { titleKey: "settings", url: "/dashboard/settings", icon: Settings },
  ]

  const isActiveRoute = (path: string) => {
    if (path === "/dashboard") {
      return currentPath === "/dashboard"
    }
    return currentPath.startsWith(path)
  }

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-primary/10 text-primary font-medium border-r-2 border-primary" : "hover:bg-muted/50"

  return (
    <Sidebar
      className={collapsed ? "w-14" : "w-64"}
      collapsible="icon"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold px-4 py-4">
            {!collapsed ? (
              <span className="flex items-center gap-2">
                EdgeTrade Pro
                {vipPackage && (
                  <Crown className="h-4 w-4 text-yellow-500 animate-pulse" />
                )}
              </span>
            ) : vipPackage ? (
              <Crown className="h-4 w-4 text-yellow-500 animate-pulse" />
            ) : null}
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/dashboard"}
                      className={({ isActive }) => getNavCls({ isActive: isActive || isActiveRoute(item.url) })}
                    >
                      <div className="relative">
                        <item.icon className="h-5 w-5" />
                        {item.showBadge && unreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </div>
                      {!collapsed && (
                        <span className="ml-3 flex items-center gap-2">
                          {t(item.titleKey)}
                          {item.showBadge && unreadCount > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-xs animate-pulse">
                              {unreadCount}
                            </Badge>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}