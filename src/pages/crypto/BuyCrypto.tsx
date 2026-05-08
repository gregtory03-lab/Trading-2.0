import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/hooks/useWallet';
import { TrendingUp, Bitcoin, DollarSign, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from 'recharts';
import CryptoDashboardLayout from '@/components/CryptoDashboardLayout';

const BuyCrypto = () => {
  const { toast } = useToast();
  const { wallet } = useWallet();
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [buyAmount, setBuyAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [chartData, setChartData] = useState<{ time: string, price: number, volume: number }[]>([]);

  const cryptoPrices = {
    BTC: 43250.00,
    ETH: 2850.75,
    LTC: 72.45,
    ADA: 0.48
  };

  // Generate realistic chart data
  useEffect(() => {
    const generateChartData = () => {
      const data = [];
      const basePrice = cryptoPrices[selectedCrypto as keyof typeof cryptoPrices];
      const now = new Date();
      
      for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        const variance = (Math.random() - 0.5) * 0.1; // 10% variance
        const price = basePrice * (1 + variance);
        const volume = Math.random() * 1000000;
        
        data.push({
          time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          price: Math.round(price * 100) / 100,
          volume: Math.round(volume)
        });
      }
      return data;
    };

    setChartData(generateChartData());
  }, [selectedCrypto]);

  const handleBuy = () => {
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Purchase Initiated! 🎉",
      description: `Buying ${amount} ${selectedCrypto} for $${(amount * cryptoPrices[selectedCrypto as keyof typeof cryptoPrices]).toLocaleString()}`,
    });
    setBuyAmount('');
  };

  return (
    <CryptoDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-6 w-6 text-green-500" />
          <h1 className="text-2xl md:text-3xl font-bold">Buy Cryptocurrency</h1>
        </div>

        {/* Price Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {selectedCrypto} Price Chart - 24H
            </CardTitle>
            <CardDescription>Real-time price movements over the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="time" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPrice)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Crypto</CardTitle>
              <CardDescription>Buy cryptocurrency with your preferred payment method</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select Cryptocurrency</Label>
                <select 
                  className="w-full mt-1 p-2 border border-border rounded-md bg-background"
                  value={selectedCrypto}
                  onChange={(e) => setSelectedCrypto(e.target.value)}
                >
                  <option value="BTC">Bitcoin (BTC) - ${cryptoPrices.BTC.toLocaleString()}</option>
                  <option value="ETH">Ethereum (ETH) - ${cryptoPrices.ETH.toLocaleString()}</option>
                  <option value="LTC">Litecoin (LTC) - ${cryptoPrices.LTC.toLocaleString()}</option>
                  <option value="ADA">Cardano (ADA) - ${cryptoPrices.ADA.toLocaleString()}</option>
                </select>
              </div>

              <div>
                <Label>Amount to Buy</Label>
                <Input
                  type="number"
                  placeholder="0.001"
                  step="0.001"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  className="mt-1"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Total: ${buyAmount ? (parseFloat(buyAmount) * cryptoPrices[selectedCrypto as keyof typeof cryptoPrices]).toLocaleString() : '0'}
                </p>
              </div>

              <div>
                <Label>Payment Method</Label>
                <select 
                  className="w-full mt-1 p-2 border border-border rounded-md bg-background"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="card">Credit/Debit Card</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="wallet">Connected Wallet</option>
                </select>
              </div>

              <Button 
                onClick={handleBuy} 
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={!buyAmount}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Buy {selectedCrypto}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Market Overview</CardTitle>
              <CardDescription>Current cryptocurrency prices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(cryptoPrices).map(([crypto, price]) => (
                  <div key={crypto} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Bitcoin className="h-6 w-6 text-orange-500" />
                      <div>
                        <p className="font-semibold">{crypto}</p>
                        <p className="text-sm text-muted-foreground">
                          {crypto === 'BTC' ? 'Bitcoin' : 
                           crypto === 'ETH' ? 'Ethereum' : 
                           crypto === 'LTC' ? 'Litecoin' : 'Cardano'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${price.toLocaleString()}</p>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        +2.5%
                      </Badge>
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

export default BuyCrypto;