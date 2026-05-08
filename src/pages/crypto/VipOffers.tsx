import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Gift, CheckCircle, Crown, Copy, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import CryptoDashboardLayout from '@/components/CryptoDashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const WALLET_ADDRESSES: Record<string, string> = {
  BTC: 'bc1q56qxqrchf20qra4a0962fg7fqm54rvp9r7xhrl',
  ETH: '0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB',
  'USDT (ERC-20)': '0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB',
  'USDC (ERC-20)': '0xc2930d27a31cB1C25Cd6Bd96F858f0190CFdA5cB',
};

const VipOffers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vipMembership, setVipMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [depositDialog, setDepositDialog] = useState<{ tier: string; deposit: string; bonus: string } | null>(null);
  const [networkFilter, setNetworkFilter] = useState<string>('ALL');

  const copyAddress = (address: string, label: string) => {
    navigator.clipboard.writeText(address);
    toast({ title: 'Address Copied! 📋', description: `${label} address copied to clipboard` });
  };

  useEffect(() => {
    if (!user) return;
    const fetchVip = async () => {
      const { data } = await supabase
        .from('vip_memberships')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setVipMembership(data);
      setLoading(false);
    };
    fetchVip();

    const channel = supabase
      .channel('vip-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vip_memberships', filter: `user_id=eq.${user.id}` }, () => {
        fetchVip();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const tierColors: Record<string, string> = {
    Bronze: 'from-amber-700 to-amber-500',
    Silver: 'from-gray-400 to-gray-300',
    Gold: 'from-yellow-500 to-amber-400',
    Platinum: 'from-blue-400 to-indigo-500',
    Diamond: 'from-cyan-400 to-blue-500',
  };

  const tierGradient = vipMembership ? (tierColors[vipMembership.package_name] || 'from-primary to-accent') : '';

  return (
    <CryptoDashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Star className="h-6 w-6 text-yellow-500" />
          <h1 className="text-3xl font-bold">VIP Trading Offers</h1>
        </div>

        {/* Active VIP Banner */}
        {!loading && vipMembership && (
          <Card className={`bg-gradient-to-br ${tierGradient} border-0 shadow-2xl text-white relative overflow-hidden`}>
            <div className="absolute inset-0 bg-white/10 animate-pulse" />
            <CardContent className="p-8 relative z-10">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                  <Crown className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold">You are a VIP Member! 👑</h2>
                  <p className="text-white/90 text-lg">
                    {vipMembership.package_name} Package
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                  <p className="text-white/80 text-sm">Package</p>
                  <p className="text-2xl font-bold">{vipMembership.package_name}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                  <p className="text-white/80 text-sm">Deposit</p>
                  <p className="text-2xl font-bold">${Number(vipMembership.deposit_amount).toLocaleString()}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                  <p className="text-white/80 text-sm">Bonus</p>
                  <p className="text-2xl font-bold text-green-200">${Number(vipMembership.bonus_amount).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center mb-8 p-8 bg-gradient-to-br from-primary/20 via-accent/10 to-gold/20 rounded-xl border border-primary/30 shadow-glow">
          <div className="inline-block p-3 bg-gradient-to-r from-primary to-accent rounded-full mb-4">
            <Star className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            🌟 VIP Trading Offers
          </h2>
          <p className="text-foreground text-xl font-medium">
            Unlock exclusive benefits by joining our VIP program today!
          </p>
        </div>

        <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-primary/20 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-gradient-to-r from-success to-accent rounded-lg">
                <Gift className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="bg-gradient-to-r from-success to-accent bg-clip-text text-transparent font-bold">
                💰 Deposit & Get Bonus Rewards
              </span>
            </CardTitle>
            <CardDescription className="text-base">Get instant bonus on your deposits - Limited time offer!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {[
                { name: 'Bronze', deposit: '$999', bonus: '$200', gradient: 'from-success/20 to-accent/10', border: 'border-success/30', badgeGrad: 'from-success to-accent' },
                { name: 'Silver', deposit: '$3,000', bonus: '$500', gradient: 'from-primary/20 to-accent/15', border: 'border-primary/40', badgeGrad: 'from-primary to-accent' },
                { name: 'Gold', deposit: '$5,000', bonus: '$700', gradient: 'from-gold/20 to-warning/15', border: 'border-gold/40', badgeGrad: 'from-gold to-warning' },
                { name: 'Platinum', deposit: '$10,000', bonus: '$1,200', gradient: 'from-primary/25 to-gold/20', border: 'border-primary/50', badgeGrad: 'from-primary to-gold' },
                { name: 'Diamond', deposit: '$20,000', bonus: '$2,400', gradient: 'from-gold/30 to-primary/25', border: 'border-gold/60 border-2', badgeGrad: 'from-gold to-primary' },
              ].map((tier, i) => {
                const active = vipMembership?.package_name === tier.name;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDepositDialog({ tier: tier.name, deposit: tier.deposit, bonus: tier.bonus })}
                    className={`w-full text-left flex justify-between items-center p-6 bg-gradient-to-r ${tier.gradient} rounded-xl ${tier.border} shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative cursor-pointer`}
                  >
                    {active && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-green-500 text-white text-xs px-2 py-1">✓ Your Plan</Badge>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className={`p-3 bg-gradient-to-r ${tier.badgeGrad} rounded-full`}>
                        <div className="text-2xl">💰</div>
                      </div>
                      <span className="font-bold text-lg text-foreground">Deposit {tier.deposit}</span>
                    </div>
                    <Badge className={`bg-gradient-to-r ${tier.badgeGrad} text-primary-foreground text-lg px-6 py-3 font-bold`}>
                      Get {tier.bonus} Bonus
                    </Badge>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card via-primary/5 to-accent/10 border-primary/30 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-gradient-to-r from-primary to-accent rounded-lg animate-pulse">
                <Gift className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-bold">
                🎁 VIP Exclusive Benefits
              </span>
            </CardTitle>
            <CardDescription className="text-base font-medium">Premium benefits for VIP members - Join the elite!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-6 bg-gradient-to-r from-success/20 to-accent/10 rounded-xl border border-success/30 shadow-md hover:shadow-lg transition-all duration-300">
                <div className="p-2 bg-gradient-to-r from-success to-accent rounded-full">
                  <CheckCircle className="h-6 w-6 text-primary-foreground flex-shrink-0" />
                </div>
                <div>
                  <h4 className="font-bold text-xl text-foreground mb-2">24/7 Priority Customer Support</h4>
                  <p className="text-muted-foreground text-base">No delays, always here for you with dedicated support team</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-6 bg-gradient-to-r from-primary/20 to-accent/15 rounded-xl border border-primary/40 shadow-md hover:shadow-lg transition-all duration-300">
                <div className="p-2 bg-gradient-to-r from-primary to-accent rounded-full">
                  <CheckCircle className="h-6 w-6 text-primary-foreground flex-shrink-0" />
                </div>
                <div>
                  <h4 className="font-bold text-xl text-foreground mb-2">Earn 10% Interest Every 2 Months</h4>
                  <p className="text-muted-foreground text-base">Passive income on your funds with guaranteed returns</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-6 bg-gradient-to-r from-gold/25 to-primary/20 rounded-xl border border-gold/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="p-2 bg-gradient-to-r from-gold to-primary rounded-full animate-pulse">
                  <CheckCircle className="h-6 w-6 text-primary-foreground flex-shrink-0" />
                </div>
                <div>
                  <h4 className="font-bold text-xl text-foreground mb-2">Instant Withdrawals</h4>
                  <p className="text-muted-foreground text-base">Fast, smooth, and hassle-free withdrawal process</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!depositDialog} onOpenChange={(o) => !o && setDepositDialog(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-gold" />
                {depositDialog?.tier} Package — Deposit {depositDialog?.deposit}
              </DialogTitle>
              <DialogDescription>
                Send exactly {depositDialog?.deposit} (or equivalent) to one of the wallet addresses below to claim your {depositDialog?.bonus} bonus.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap gap-2">
                {['ALL', ...Object.keys(WALLET_ADDRESSES)].map((net) => (
                  <Button
                    key={net}
                    type="button"
                    size="sm"
                    variant={networkFilter === net ? 'default' : 'outline'}
                    onClick={() => setNetworkFilter(net)}
                  >
                    {net === 'ALL' ? 'All Networks' : net}
                  </Button>
                ))}
              </div>
              {Object.entries(WALLET_ADDRESSES)
                .filter(([label]) => networkFilter === 'ALL' || label === networkFilter)
                .map(([label, address]) => (
                <div key={label} className="space-y-2 p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{label}</span>
                    <Button variant="outline" size="sm" onClick={() => copyAddress(address, label)}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="bg-white p-2 rounded">
                      <QRCodeSVG value={address} size={80} level="H" />
                    </div>
                    <code className="text-xs break-all flex-1">{address}</code>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground text-center">
                After sending, contact support with your transaction hash to activate your VIP package.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </CryptoDashboardLayout>
  );
};

export default VipOffers;
