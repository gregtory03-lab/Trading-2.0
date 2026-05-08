import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { TrendingDown, Bitcoin, DollarSign, Wallet } from 'lucide-react';
import CryptoDashboardLayout from '@/components/CryptoDashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const SellCrypto = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [sellAmount, setSellAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank');
  const [walletBalances, setWalletBalances] = useState<{[key: string]: number}>({});

  const cryptoPrices = {
    BTC: 43250.00,
    ETH: 2850.75,
    LTC: 72.45,
    ADA: 0.48
  };

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

  const portfolio = [
    { symbol: 'BTC', name: 'Bitcoin', amount: walletBalances['BTC'] || 0, value: (walletBalances['BTC'] || 0) * cryptoPrices.BTC, change: 2.5 },
    { symbol: 'ETH', name: 'Ethereum', amount: walletBalances['ETH'] || 0, value: (walletBalances['ETH'] || 0) * cryptoPrices.ETH, change: -1.2 },
    { symbol: 'LTC', name: 'Litecoin', amount: walletBalances['LTC'] || 0, value: (walletBalances['LTC'] || 0) * cryptoPrices.LTC, change: 1.8 },
    { symbol: 'ADA', name: 'Cardano', amount: walletBalances['ADA'] || 0, value: (walletBalances['ADA'] || 0) * cryptoPrices.ADA, change: -0.5 }
  ];

  const getCurrentPrice = () => {
    return cryptoPrices[selectedCrypto as keyof typeof cryptoPrices] || 0;
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
      }
    } catch (error) {
      console.error('Error updating wallet balance:', error);
      throw error;
    }
  };

  const createTransaction = async (type: string, symbol: string, amount: number, totalValue: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: type,
          crypto_symbol: symbol,
          amount: amount,
          price: cryptoPrices[symbol as keyof typeof cryptoPrices],
          total_value: totalValue,
          status: 'completed',
          details: {
            payment_method: paymentMethod,
            crypto_price: cryptoPrices[symbol as keyof typeof cryptoPrices]
          }
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating transaction:', error);
    }
  };

  const handleSell = async () => {
    const amount = parseFloat(sellAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    const currentBalance = walletBalances[selectedCrypto] || 0;
    if (amount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough cryptocurrency to sell.",
        variant: "destructive",
      });
      return;
    }

    try {
      const saleValue = amount * cryptoPrices[selectedCrypto as keyof typeof cryptoPrices];
      const newBalance = currentBalance - amount;

      // Update wallet balance
      await updateWalletBalance(selectedCrypto, newBalance);

      // Create transaction record
      await createTransaction('sell', selectedCrypto, amount, saleValue);

      // Update local state
      setWalletBalances(prev => ({
        ...prev,
        [selectedCrypto]: newBalance
      }));

      toast({
        title: "Sale Completed! 💰",
        description: `Sold ${amount} ${selectedCrypto} for $${saleValue.toLocaleString()}`,
      });
      setSellAmount('');
    } catch (error) {
      toast({
        title: "Sale Failed",
        description: "Failed to complete the sale. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <CryptoDashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingDown className="h-6 w-6 text-red-500" />
          <h1 className="text-3xl font-bold">Sell Cryptocurrency</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Portfolio</CardTitle>
              <CardDescription>Available cryptocurrency holdings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {portfolio.map((crypto) => (
                  <div key={crypto.symbol} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Bitcoin className="h-6 w-6 text-orange-500" />
                      <div>
                        <p className="font-semibold">{crypto.name}</p>
                        <p className="text-sm text-muted-foreground">{crypto.amount} {crypto.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${crypto.value.toLocaleString()}</p>
                      <Badge variant={crypto.change >= 0 ? "default" : "destructive"} 
                             className={crypto.change >= 0 ? "bg-green-100 text-green-800" : ""}>
                        {crypto.change >= 0 ? '+' : ''}{crypto.change}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sell Crypto</CardTitle>
              <CardDescription>Convert your cryptocurrency to USD</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select Cryptocurrency to Sell</Label>
                <select 
                  className="w-full mt-1 p-2 border border-border rounded-md bg-background"
                  value={selectedCrypto}
                  onChange={(e) => setSelectedCrypto(e.target.value)}
                >
                  {portfolio.map((crypto) => (
                    <option key={crypto.symbol} value={crypto.symbol}>
                      {crypto.name} ({crypto.symbol}) - {crypto.amount} available
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Amount to Sell</Label>
                <Input
                  type="number"
                  placeholder="0.001"
                  step="0.001"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  className="mt-1"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  You'll receive: ${sellAmount ? (parseFloat(sellAmount) * getCurrentPrice()).toLocaleString() : '0'}
                </p>
              </div>

              <div>
                <Label>Payment Method</Label>
                <select 
                  className="w-full mt-1 p-2 border border-border rounded-md bg-background"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="bank">Bank Account</option>
                  <option value="paypal">PayPal</option>
                  <option value="card">Debit Card</option>
                </select>
              </div>

              <Button 
                onClick={handleSell} 
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                disabled={!sellAmount}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Sell {selectedCrypto}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </CryptoDashboardLayout>
  );
};

export default SellCrypto;