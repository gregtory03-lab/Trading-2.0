import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, ArrowLeftRight, Bitcoin } from 'lucide-react';
import CryptoDashboardLayout from '@/components/CryptoDashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveCryptoPrices } from '@/hooks/useLiveCryptoPrices';

const Exchange = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [fromCrypto, setFromCrypto] = useState('BTC');
  const [toCrypto, setToCrypto] = useState('ETH');
  const [fromAmount, setFromAmount] = useState('');
  const [walletBalances, setWalletBalances] = useState<{[key: string]: number}>({});

  const { getCurrentPrice, isLoading: pricesLoading, refetch: refetchPrices } = useLiveCryptoPrices(['bitcoin', 'ethereum']);

  const cryptoPrices = {
    BTC: getCurrentPrice('BTC'),
    ETH: getCurrentPrice('ETH'),
    USDT: getCurrentPrice('USDT'),
    USDC: getCurrentPrice('USDC'),
  } as Record<string, number>;

  const exchangeRates = {
    'BTC/ETH': cryptoPrices.ETH ? cryptoPrices.BTC / cryptoPrices.ETH : 0,
    'ETH/BTC': cryptoPrices.BTC ? cryptoPrices.ETH / cryptoPrices.BTC : 0,
    'BTC/USDT': cryptoPrices.USDT ? cryptoPrices.BTC / cryptoPrices.USDT : 0,
    'BTC/USDC': cryptoPrices.USDC ? cryptoPrices.BTC / cryptoPrices.USDC : 0,
    'ETH/USDT': cryptoPrices.USDT ? cryptoPrices.ETH / cryptoPrices.USDT : 0,
    'ETH/USDC': cryptoPrices.USDC ? cryptoPrices.ETH / cryptoPrices.USDC : 0,
    'USDT/USDC': 1,
  };

  const calculateExchange = () => {
    if (!fromAmount) return '0';
    const fromPrice = cryptoPrices[fromCrypto] || 0;
    const toPrice = cryptoPrices[toCrypto] || 0;
    if (!toPrice) return '0';
    const fromValue = parseFloat(fromAmount) * fromPrice;
    const toAmount = fromValue / toPrice;
    return toAmount.toFixed(6);
  };

  const getExchangeRate = () => {
    const fromValue = cryptoPrices[fromCrypto] || 0;
    const toValue = cryptoPrices[toCrypto] || 0;
    if (!toValue) return 0;
    return fromValue / toValue;
  };

  const toAmount = calculateExchange();

  useEffect(() => {
    fetchWalletBalances();
  }, [user]);

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
    if (!user) return;

    try {
      const { data: existingBalance } = await supabase
        .from('wallet_balances')
        .select('id')
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .single();

      if (existingBalance) {
        const { error } = await supabase
          .from('wallet_balances')
          .update({ balance: newBalance })
          .eq('user_id', user.id)
          .eq('symbol', symbol);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wallet_balances')
          .insert({
            user_id: user.id,
            symbol: symbol,
            balance: newBalance
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating wallet balance:', error);
      throw error;
    }
  };

  const createTransaction = async (type: string, fromSymbol: string, toSymbol: string, fromAmount: number, toAmount: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: type,
          crypto_symbol: `${fromSymbol}/${toSymbol}`,
          amount: fromAmount,
          total_value: toAmount,
          status: 'completed',
          details: {
            from_crypto: fromSymbol,
            to_crypto: toSymbol,
            from_amount: fromAmount,
            to_amount: toAmount,
            exchange_rate: (cryptoPrices[fromSymbol] || 0) / (cryptoPrices[toSymbol] || 1)
          }
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating transaction:', error);
    }
  };

  const handleExchange = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount to exchange.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(fromAmount);
    const fromBalance = walletBalances[fromCrypto] || 0;
    
    if (amount > fromBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You don't have enough ${fromCrypto} to exchange.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const toAmountNum = parseFloat(toAmount);
      const newFromBalance = fromBalance - amount;
      const currentToBalance = walletBalances[toCrypto] || 0;
      const newToBalance = currentToBalance + toAmountNum;

      // Update wallet balances
      await updateWalletBalance(fromCrypto, newFromBalance);
      await updateWalletBalance(toCrypto, newToBalance);

      // Create transaction record
      await createTransaction('exchange', fromCrypto, toCrypto, amount, toAmountNum);

      // Update local state
      setWalletBalances(prev => ({
        ...prev,
        [fromCrypto]: newFromBalance,
        [toCrypto]: newToBalance
      }));

      toast({
        title: "Exchange Completed! ⚡",
        description: `Converted ${fromAmount} ${fromCrypto} to ${toAmount} ${toCrypto}`,
      });
      setFromAmount('');
    } catch (error) {
      toast({
        title: "Exchange Failed",
        description: "Failed to complete the exchange. Please try again.",
        variant: "destructive",
      });
    }
  };

  const swapCryptos = () => {
    const prevTo = toAmount;
    setFromCrypto(toCrypto);
    setToCrypto(fromCrypto);
    // Use the previously calculated "to" amount as the new "from" amount for instant recalculation
    if (prevTo && parseFloat(prevTo) > 0) {
      setFromAmount(prevTo);
    }
  };

  return (
    <CryptoDashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2 mb-6">
          <ArrowLeftRight className="h-6 w-6 text-blue-500" />
          <h1 className="text-3xl font-bold">Exchange Cryptocurrency</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Crypto Exchange</CardTitle>
              <CardDescription>Swap between different cryptocurrencies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>From</Label>
                <div className="flex gap-2 mt-1">
                  <select 
                    className="flex-1 p-2 border border-border rounded-md bg-background"
                    value={fromCrypto}
                    onChange={(e) => setFromCrypto(e.target.value)}
                  >
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="USDT">Tether (USDT)</option>
                    <option value="USDC">USD Coin (USDC)</option>
                  </select>
                  <Input
                    type="number"
                    placeholder="0.001"
                    step="0.001"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={swapCryptos}
                  className="rounded-full gap-2"
                  title="Quick swap From/To"
                  aria-label="Quick swap From and To currencies"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Quick Swap
                </Button>
              </div>

              <div>
                <Label>To</Label>
                <div className="flex gap-2 mt-1">
                  <select 
                    className="flex-1 p-2 border border-border rounded-md bg-background"
                    value={toCrypto}
                    onChange={(e) => setToCrypto(e.target.value)}
                  >
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="USDT">Tether (USDT)</option>
                    <option value="USDC">USD Coin (USDC)</option>
                  </select>
                  <Input
                    type="text"
                    value={toAmount}
                    readOnly
                    className="flex-1 bg-muted"
                  />
                </div>
              </div>

              <div className="bg-muted p-3 rounded-md space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Exchange Rate</p>
                  <p className="font-semibold">1 {fromCrypto} = {getExchangeRate().toFixed(6)} {toCrypto}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="font-semibold">{walletBalances[fromCrypto] || 0} {fromCrypto}</p>
                </div>
              </div>

              <Button 
                onClick={handleExchange} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!fromAmount}
              >
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Exchange {fromCrypto} to {toCrypto}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Exchange Rates</CardTitle>
                  <CardDescription>Live market rates (auto-refresh 30s)</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchPrices()} disabled={pricesLoading}>
                  <RefreshCw className={`h-4 w-4 ${pricesLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(exchangeRates).map(([pair, rate]) => (
                  <div key={pair} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Bitcoin className="h-6 w-6 text-orange-500" />
                      <div>
                        <p className="font-semibold">{pair}</p>
                        <p className="text-sm text-muted-foreground">Market Rate</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{rate.toFixed(6)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CryptoDashboardLayout>
  );
};

export default Exchange;