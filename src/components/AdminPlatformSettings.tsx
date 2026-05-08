import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Settings as SettingsIcon, Wallet } from 'lucide-react';

const MIN_KEY = 'min_trading_balance_usd';
const WALLET_KEYS = {
  BTC: 'wallet_address_btc',
  ETH: 'wallet_address_eth',
  USDT: 'wallet_address_usdt',
  USDC: 'wallet_address_usdc',
} as const;

type WalletCoin = keyof typeof WALLET_KEYS;

const AdminPlatformSettings = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [minValue, setMinValue] = useState<string>('500');
  const [wallets, setWallets] = useState<Record<WalletCoin, string>>({
    BTC: '', ETH: '', USDT: '', USDC: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCoin, setSavingCoin] = useState<WalletCoin | null>(null);

  useEffect(() => {
    const load = async () => {
      const keys = [MIN_KEY, ...Object.values(WALLET_KEYS)];
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', keys);
      if (data) {
        for (const row of data) {
          if (row.key === MIN_KEY && row.value != null) {
            setMinValue(String(row.value));
          } else {
            const coin = (Object.entries(WALLET_KEYS).find(([, k]) => k === row.key)?.[0]) as WalletCoin | undefined;
            if (coin && row.value != null) {
              setWallets((prev) => ({ ...prev, [coin]: String(row.value) }));
            }
          }
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const upsert = async (key: string, value: unknown) => {
    return supabase
      .from('platform_settings')
      .upsert(
        [{ key, value: value as never, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }],
        { onConflict: 'key' }
      );
  };

  const saveMin = async () => {
    const num = Number(minValue);
    if (!Number.isFinite(num) || num < 0) {
      toast({ title: 'Invalid value', description: 'Enter a non-negative number.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await upsert(MIN_KEY, num);
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved', description: `Minimum trading balance set to $${num}.` });
  };

  const saveWallet = async (coin: WalletCoin) => {
    const addr = wallets[coin].trim();
    if (!addr) {
      toast({ title: 'Invalid address', description: 'Address cannot be empty.', variant: 'destructive' });
      return;
    }
    setSavingCoin(coin);
    const { error } = await upsert(WALLET_KEYS[coin], addr);
    setSavingCoin(null);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved', description: `${coin} deposit address updated.` });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Platform Settings
          </CardTitle>
          <CardDescription>
            Configure platform-wide trading rules. Changes apply in real time for all users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="min-trading">Minimum trading balance (USD)</Label>
            <Input
              id="min-trading"
              type="number"
              min={0}
              step="1"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Users need at least this USD value of the selected coin to start a trading session.
            </p>
          </div>
          <Button onClick={saveMin} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Deposit Wallet Addresses
          </CardTitle>
          <CardDescription>
            Update the receiving wallet addresses shown to users for each crypto. USDT and USDC use the ERC-20 (Ethereum) network.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-2xl">
          {(Object.keys(WALLET_KEYS) as WalletCoin[]).map((coin) => (
            <div key={coin} className="space-y-2">
              <Label htmlFor={`wallet-${coin}`}>{coin} deposit address</Label>
              <div className="flex gap-2">
                <Input
                  id={`wallet-${coin}`}
                  value={wallets[coin]}
                  onChange={(e) => setWallets((prev) => ({ ...prev, [coin]: e.target.value }))}
                  disabled={loading}
                  placeholder={`Enter ${coin} address`}
                  className="font-mono text-xs"
                />
                <Button
                  onClick={() => saveWallet(coin)}
                  disabled={loading || savingCoin === coin}
                  variant="secondary"
                >
                  {savingCoin === coin ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPlatformSettings;
