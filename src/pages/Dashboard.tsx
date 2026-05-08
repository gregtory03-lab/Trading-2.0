import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, t } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import CryptoDashboardLayout from '@/components/CryptoDashboardLayout';
import CryptoTicker from '@/components/CryptoTicker';
import { useLiveCryptoPrices } from '@/hooks/useLiveCryptoPrices';

import TradingInterface from '@/components/TradingInterface';
import { 
  TrendingUp, 
  LogOut,
  User,
  Bitcoin,
  Shield,
  ChevronDown,
  ChevronRight,
  RefreshCcw,
  CreditCard,
  History,
  Wallet,
  Settings,
  MessageCircle,
  DollarSign
} from 'lucide-react';

const Dashboard = () => {
  const { user, signOut, isDemoMode, exitDemoMode } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [walletBalances, setWalletBalances] = useState<{[key: string]: number}>({});
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});
  const [kycStatus, setKycStatus] = useState('pending');
  const [showDashboardSections, setShowDashboardSections] = useState(false);
  
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const { getCurrentPrice, isLoading: pricesLoading } = useLiveCryptoPrices(['bitcoin', 'ethereum']);

  const totalPortfolioUSD = Object.entries(walletBalances).reduce((sum, [symbol, balance]) => {
    return sum + (balance * getCurrentPrice(symbol));
  }, 0);

  useEffect(() => {
    if (isDemoMode) {
      setWalletBalances({
        BTC: 0.1,
        ETH: 2.0
      });
      setKycStatus('demo');
    } else if (user) {
      checkAdminStatus();
      fetchWalletBalances();
      fetchKycStatus();

      // Real-time wallet balance updates
      const walletChannel = supabase
        .channel('user-wallet-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'wallet_balances', filter: `user_id=eq.${user.id}` },
          () => { fetchWalletBalances(); }
        )
        .subscribe();

      // Real-time KYC status updates
      const kycChannel = supabase
        .channel('user-kyc-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'kyc_submissions', filter: `user_id=eq.${user.id}` },
          () => { fetchKycStatus(); }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(walletChannel);
        supabase.removeChannel(kycChannel);
      };
    }
  }, [user, isDemoMode]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!error && data?.role === 'admin') {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchWalletBalances = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('wallet_balances')
        .select('symbol, balance')
        .eq('user_id', user.id);

      if (!error && data) {
        const balances: {[key: string]: number} = {};
        data.forEach(item => {
          balances[item.symbol] = parseFloat(item.balance.toString());
        });
        setWalletBalances(balances);
      }
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
    }
  };

  const updateWalletBalance = async (symbol: string, newBalance: number) => {
    if (isDemoMode) {
      // In demo mode, just update local state
      setWalletBalances(prev => ({
        ...prev,
        [symbol]: newBalance
      }));
      return;
    }

    if (!user) return;

    try {
      const { data: existingBalance } = await supabase
        .from('wallet_balances')
        .select('id')
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .maybeSingle();

      if (existingBalance) {
        const { error } = await supabase
          .from('wallet_balances')
          .update({ balance: newBalance })
          .eq('user_id', user.id)
          .eq('symbol', symbol);

        if (error) throw error;
      } else {
        // User doesn't have a wallet row for this symbol yet
        // Try to insert - may fail if user doesn't have insert permission
        try {
          const { error } = await supabase
            .from('wallet_balances')
            .insert({
              user_id: user.id,
              symbol: symbol,
              balance: newBalance
            });

          if (error) {
            console.warn('Could not create wallet balance row:', error.message);
          }
        } catch (insertErr) {
          console.warn('Insert wallet balance failed:', insertErr);
        }
      }

      // Update local state
      setWalletBalances(prev => ({
        ...prev,
        [symbol]: newBalance
      }));
    } catch (error) {
      console.error('Error updating wallet balance:', error);
    }
  };

  const fetchKycStatus = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('kyc_submissions')
        .select('status')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setKycStatus(data[0].status);
      }
    } catch (error) {
      console.error('Error fetching KYC status:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      if (isDemoMode) {
        exitDemoMode();
        toast({
          title: "Exited demo mode",
          description: "You have exited the demo account.",
        });
      } else {
        await signOut();
        toast({
          title: "Signed out",
          description: "You have been successfully signed out.",
        });
      }
      navigate('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleCoinClick = (coin: string) => {
    setSelectedCoin(coin);
  };

  const menuSections = [
    {
      id: 'overview',
      title: 'Overview',
      icon: TrendingUp,
      items: [
        { title: 'Portfolio Summary', onClick: () => {}, description: 'View your asset overview' },
        { title: 'Recent Activity', onClick: () => {}, description: 'Check latest transactions' }
      ]
    },
    {
      id: 'trading',
      title: 'Trading',
      icon: RefreshCcw,
      items: [
        { title: 'Exchange', onClick: () => navigate('/dashboard/exchange'), description: 'Trade cryptocurrencies' }
      ]
    },
    {
      id: 'wallet',
      title: 'Wallet Management',
      icon: Wallet,
      items: [
        { title: 'Withdraw Funds', onClick: () => navigate('/dashboard/withdraw'), description: 'Withdraw to external wallet' },
        { title: 'Wallet Addresses', onClick: () => navigate('/dashboard/wallet'), description: 'View deposit addresses' },
        { title: 'Transaction History', onClick: () => navigate('/dashboard/transactions'), description: 'View all transactions' }
      ]
    },
    {
      id: 'security',
      title: 'Security & Verification',
      icon: Shield,
      items: [
        { title: 'KYC Verification', onClick: () => navigate('/dashboard/kyc'), description: 'Complete identity verification' },
        { title: 'Account Settings', onClick: () => navigate('/dashboard/settings'), description: 'Security and preferences' }
      ]
    }
  ];

  return (
    <CryptoDashboardLayout>
      <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 max-w-full overflow-hidden">
        {/* Crypto Ticker */}
        <div className="w-full overflow-hidden">
          <CryptoTicker />
        </div>

        {/* Welcome Header */}
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate">
              {isDemoMode ? 'Demo Account' : t('welcomeBack', language)}
            </h1>
            <p className="text-muted-foreground text-sm truncate">
              {isDemoMode ? 'Practice trading with $10,000 virtual balance' : user?.email}
            </p>
          </div>
          
          {/* Action Buttons - Mobile Optimized */}
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <div className="flex flex-wrap gap-2 flex-1">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowDashboardSections(!showDashboardSections)}
                className="flex items-center gap-1 text-xs sm:text-sm"
              >
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">{t('dashboard', language)}</span>
                {showDashboardSections ? <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" /> : <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/dashboard/support')}
                className="flex items-center gap-1 text-xs sm:text-sm"
              >
                <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">{t('support', language)}</span>
              </Button>
              
              {/* Language Selector */}
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
                <option value="ja">🇯🇵 日本語</option>
                <option value="ko">🇰🇷 한국어</option>
                <option value="ar">🇸🇦 العربية</option>
                <option value="ru">🇷🇺 Русский</option>
                <option value="pt">🇧🇷 PT</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              {isAdmin && (
                <div className="flex gap-1">
                  <Button 
                    onClick={() => navigate('/simple-admin')}
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Simple</span>
                  </Button>
                  <Button 
                    onClick={() => navigate('/admin')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Full</span>
                  </Button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={handleSignOut} className="text-xs">
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">{t('signOut', language)}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Total Portfolio Value */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-background" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                    {t('totalPortfolioValue', language) === 'totalPortfolioValue' ? 'Total Portfolio Value' : t('totalPortfolioValue', language)}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold tabular-nums truncate">
                    {pricesLoading && totalPortfolioUSD === 0 ? (
                      <span className="text-muted-foreground text-lg">Loading...</span>
                    ) : (
                      <>${totalPortfolioUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                <TrendingUp className="h-3 w-3" />
                <span>Live</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demo Mode Notice */}
        {isDemoMode && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-1 h-8 sm:h-12 bg-amber-500 rounded-full flex-shrink-0 mt-1"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-amber-900 dark:text-amber-100 font-medium text-sm sm:text-base">
                    You're in demo mode with $10,000 virtual balance. Create a free account to start real trading.
                  </p>
                  <Button 
                    variant="link" 
                    className="p-0 h-auto text-amber-600 dark:text-amber-400 font-medium text-sm"
                    onClick={() => navigate('/signup')}
                  >
                    Create Free Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KYC Notice - Only show if no documents submitted and not in demo mode */}
        {!isDemoMode && kycStatus !== 'approved' && kycStatus !== 'pending' && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-1 h-8 sm:h-12 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-blue-900 dark:text-blue-100 font-medium text-sm sm:text-base">
                    Please verify your KYC information before any transactional action.
                  </p>
                  <Button 
                    variant="link" 
                    className="p-0 h-auto text-blue-600 dark:text-blue-400 font-medium text-sm"
                    onClick={() => navigate('/dashboard/kyc')}
                  >
                    Verify Now.
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dashboard Navigation - Only show when expanded */}
        {showDashboardSections && (
          <div className="grid grid-cols-1 gap-4">
            {menuSections.map((section) => (
              <Card key={section.id} className="transition-all duration-200 hover:shadow-md">
                <CardHeader 
                  className="cursor-pointer p-3 sm:p-4"
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                        <section.icon className="h-4 w-4 sm:h-5 sm:w-5 text-background" />
                      </div>
                      <CardTitle className="text-sm sm:text-lg truncate">{section.title}</CardTitle>
                    </div>
                    {expandedSections[section.id] ? (
                      <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                </CardHeader>
                {expandedSections[section.id] && (
                  <CardContent className="pt-0 p-3 sm:p-4">
                    <div className="space-y-2 sm:space-y-3">
                      {section.items.map((item, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                          onClick={item.onClick}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm sm:text-base truncate">{item.title}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{item.description}</p>
                          </div>
                          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0 ml-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}


        {/* Show Trading Interface or Wallet Overview */}
        {selectedCoin ? (
          <TradingInterface 
            coin={selectedCoin}
            balance={walletBalances[selectedCoin] || 0}
            onBack={() => setSelectedCoin(null)}
            onBalanceUpdateDB={(newBalance) => updateWalletBalance(selectedCoin, newBalance)}
          />
        ) : (
          <Card>
            <CardHeader className="p-3 sm:p-4">
              <CardTitle className="text-base sm:text-xl">{t('myWallets', language)}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{t('yourCryptoBalances', language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 p-2 sm:p-4 pt-0">
              <div 
                className="flex items-center justify-between gap-2 p-3 sm:p-4 rounded-lg bg-muted/50 border border-border cursor-pointer hover:bg-muted/70 active:scale-[0.99] transition-all touch-manipulation min-h-[64px]"
                onClick={() => handleCoinClick('BTC')}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bitcoin className="h-5 w-5 sm:h-6 sm:w-6 text-background" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-lg truncate">Bitcoin</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">BTC</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 min-w-0">
                  <p className="text-xs sm:text-lg font-bold tabular-nums break-all">
                    {(walletBalances.BTC || 0).toFixed(8)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">BTC</p>
                </div>
              </div>
              
              <div 
                className="flex items-center justify-between gap-2 p-3 sm:p-4 rounded-lg bg-muted/50 border border-border cursor-pointer hover:bg-muted/70 active:scale-[0.99] transition-all touch-manipulation min-h-[64px]"
                onClick={() => handleCoinClick('ETH')}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-background" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0L1.608 6L12 12l10.392-6L12 0zM1.608 18L12 24l10.392-6L12 18l-10.392-6z"/>
                      <path d="M1.608 12L12 18l10.392-6L12 6L1.608 12z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-lg truncate">Ethereum</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">ETH</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 min-w-0">
                  <p className="text-xs sm:text-lg font-bold tabular-nums break-all">
                    {(walletBalances.ETH || 0).toFixed(8)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">ETH</p>
                </div>
              </div>

              <div 
                className="flex items-center justify-between gap-2 p-3 sm:p-4 rounded-lg bg-muted/50 border border-border cursor-pointer hover:bg-muted/70 active:scale-[0.99] transition-all touch-manipulation min-h-[64px]"
                onClick={() => handleCoinClick('USDT')}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-background" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.374 0 0 5.374 0 12s5.374 12 12 12 12-5.374 12-12S18.629 0 12 0zm5.894 8.221l-1.97-.001v1.498h1.97c-.097 1.728-2.495 2.267-5.894 2.267-3.399 0-5.797-.539-5.894-2.267h1.97V8.22l-1.97.001C6.27 6.942 8.72 6.3 12 6.3s5.73.642 5.894 1.921zM12 14.985c-3.399 0-5.797-.539-5.894-2.267h2.97v-1.5H6.106c.097-1.728 2.495-2.267 5.894-2.267s5.797.539 5.894 2.267h-2.97v1.5h2.97c-.097 1.728-2.495 2.267-5.894 2.267z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-lg truncate">Tether</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">USDT</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 min-w-0">
                  <p className="text-sm sm:text-lg font-bold tabular-nums">
                    {(walletBalances.USDT || 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">USDT</p>
                </div>
              </div>

              <div 
                className="flex items-center justify-between gap-2 p-3 sm:p-4 rounded-lg bg-muted/50 border border-border cursor-pointer hover:bg-muted/70 active:scale-[0.99] transition-all touch-manipulation min-h-[64px]"
                onClick={() => handleCoinClick('USDC')}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6 text-background" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 3.6c4.636 0 8.4 3.764 8.4 8.4s-3.764 8.4-8.4 8.4S3.6 16.636 3.6 12 7.364 3.6 12 3.6zm-1.2 4.8v1.26c-1.38.3-2.4 1.26-2.4 2.54 0 1.5 1.14 2.28 2.82 2.7 1.26.36 1.58.66 1.58 1.14 0 .54-.54.9-1.38.9-.96 0-1.56-.42-1.74-1.08l-1.38.48c.3 1.02 1.14 1.74 2.1 1.92V19.2h1.2v-1.26c1.44-.3 2.4-1.32 2.4-2.58 0-1.62-1.14-2.34-2.82-2.76-1.2-.3-1.58-.6-1.58-1.08 0-.48.42-.84 1.2-.84.84 0 1.38.36 1.62.96l1.32-.54c-.36-.9-1.08-1.5-2.14-1.74V8.4h-1.2z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-lg truncate">USD Coin</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">USDC</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 min-w-0">
                  <p className="text-sm sm:text-lg font-bold tabular-nums">
                    {(walletBalances.USDC || 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">USDC</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </CryptoDashboardLayout>
  );
};

export default Dashboard;