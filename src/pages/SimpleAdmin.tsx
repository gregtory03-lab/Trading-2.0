import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, MessageSquare, Users, Wallet, FileText, Eye, Activity, Trash2, AlertTriangle, Star, Settings as SettingsIcon } from 'lucide-react';
import AdminChatInitiator from '@/components/AdminChatInitiator';
import AdminLiveChatView from '@/components/AdminLiveChatView';
import AdminPlatformSettings from '@/components/AdminPlatformSettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  address: string | null;
  verified: boolean;
  created_at: string;
}

interface SupportMessage {
  id: string;
  user_id: string;
  message: string;
  admin_reply: string | null;
  status: string;
  created_at: string;
  profiles: {
    first_name: string;
    last_name: string;
  } | null;
}

interface WalletBalance {
  id: string;
  user_id: string;
  symbol: string;
  balance: number;
  profiles: {
    first_name: string;
    last_name: string;
  } | null;
}

interface KYCSubmission {
  id: string;
  user_id: string;
  document_type: string;
  status: string;
  front_document_url: string | null;
  back_document_url: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  profiles: {
    first_name: string;
    last_name: string;
  } | null;
}

interface UserSession {
  id: string;
  user_id: string;
  logged_in_at: string;
  last_active_at: string;
  is_active: boolean;
  profiles: {
    first_name: string;
    last_name: string;
  } | null;
}

export default function SimpleAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>([]);
  const [kycSubmissions, setKycSubmissions] = useState<KYCSubmission[]>([]);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [replyTexts, setReplyTexts] = useState<{ [key: string]: string }>({});
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [selectedUserForBalance, setSelectedUserForBalance] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState<{ [key: string]: string }>({});
  const [adjustmentSymbol, setAdjustmentSymbol] = useState<{ [key: string]: string }>({});
  const [liveChatUnread, setLiveChatUnread] = useState(0);
  const [vipMemberships, setVipMemberships] = useState<any[]>([]);
  const [vipUserId, setVipUserId] = useState('');
  const [vipPackage, setVipPackage] = useState('');

  const VIP_PACKAGES = [
    { name: 'Bronze ($999)', deposit: 999, bonus: 200 },
    { name: 'Silver ($3,000)', deposit: 3000, bonus: 500 },
    { name: 'Gold ($5,000)', deposit: 5000, bonus: 700 },
    { name: 'Platinum ($10,000)', deposit: 10000, bonus: 1200 },
    { name: 'Diamond ($20,000)', deposit: 20000, bonus: 2400 },
  ];

  useEffect(() => {
    fetchData();

    // Set up realtime subscription for user sessions
    const channel = supabase
      .channel('admin-user-sessions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_sessions'
        },
        async (payload) => {
          console.log('New login:', payload);
          
          // Get user profile for the notification
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', payload.new.user_id)
            .single();
          
          const userName = profile 
            ? `${profile.first_name} ${profile.last_name}` 
            : 'A user';
          
          // Show toast notification
          toast({
            title: "🟢 New Login",
            description: `${userName} just logged in`,
          });
          
          // Play notification sound
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleR0LTKnX2K5kEwM9ptHZ');
          audio.volume = 0.3;
          audio.play().catch(() => {});
          
          fetchSessions();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_sessions'
        },
        async (payload) => {
          console.log('Session update:', payload);
          
          // Check if user logged out (is_active changed to false)
          if (payload.old.is_active === true && payload.new.is_active === false) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('user_id', payload.new.user_id)
              .single();
            
            const userName = profile 
              ? `${profile.first_name} ${profile.last_name}` 
              : 'A user';
            
            toast({
              title: "⚫ User Logged Out",
              description: `${userName} has signed out`,
            });
          }
          
          fetchSessions();
        }
      )
      .subscribe();

    // Real-time subscription for new user profiles
    const profilesChannel = supabase
      .channel('admin-new-profiles')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          const newProfile = payload.new as Profile;
          setProfiles(prev => [newProfile, ...prev]);
          toast({
            title: "👤 New User",
            description: `${newProfile.first_name} ${newProfile.last_name} just joined`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          const deletedProfile = payload.old as Profile;
          setProfiles(prev => prev.filter(p => p.user_id !== deletedProfile.user_id));
          toast({
            title: "🗑️ User Removed",
            description: `A user account has been deleted`,
          });
          fetchData();
        }
      )
      .subscribe();

    // Real-time subscription for KYC submissions
    const kycChannel = supabase
      .channel('admin-kyc-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kyc_submissions' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('user_id', (payload.new as any).user_id)
              .single();
            toast({
              title: "📄 New KYC Submission",
              description: `${profile?.first_name || 'A user'} ${profile?.last_name || ''} submitted KYC documents`,
            });
          }
          // Re-fetch KYC data for any change
          const { data: kycData } = await supabase
            .from('kyc_submissions')
            .select('*')
            .order('submitted_at', { ascending: false });
          const enrichedKyc = await Promise.all(
            (kycData || []).map(async (kyc) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', kyc.user_id)
                .single();
              return { ...kyc, profiles: profile };
            })
          );
          setKycSubmissions(enrichedKyc);
        }
      )
      .subscribe();

    // Real-time subscription for support messages
    const supportChannel = supabase
      .channel('admin-support-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('user_id', (payload.new as any).user_id)
              .single();
            toast({
              title: "💬 New Support Message",
              description: `${profile?.first_name || 'A user'} sent a support message`,
            });
          }
          const { data: messagesData } = await supabase
            .from('support_messages')
            .select('*')
            .order('created_at', { ascending: false });
          const enrichedMessages = await Promise.all(
            (messagesData || []).map(async (message) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', message.user_id)
                .single();
              return { ...message, profiles: profile };
            })
          );
          setMessages(enrichedMessages);
        }
      )
      .subscribe();

    // Real-time subscription for wallet balance changes
    const walletChannel = supabase
      .channel('admin-wallet-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_balances' },
        async () => {
          const { data: balancesData } = await supabase
            .from('wallet_balances')
            .select('*')
            .order('created_at', { ascending: false });
          const enrichedBalances = await Promise.all(
            (balancesData || []).map(async (balance) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', balance.user_id)
                .single();
              return { ...balance, profiles: profile };
            })
          );
          setWalletBalances(enrichedBalances);
        }
      )
      .subscribe();

    // Real-time subscription for transactions
    const txChannel = supabase
      .channel('admin-transactions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('user_id', (payload.new as any).user_id)
              .single();
            toast({
              title: "💰 New Transaction",
              description: `${profile?.first_name || 'A user'} made a ${(payload.new as any).type} transaction`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(kycChannel);
      supabase.removeChannel(supportChannel);
      supabase.removeChannel(walletChannel);
      supabase.removeChannel(txChannel);
    };
  }, []);

  const fetchSessions = async () => {
    const { data: sessionsData } = await supabase
      .from('user_sessions')
      .select('*')
      .order('logged_in_at', { ascending: false });

    const enrichedSessions = await Promise.all(
      (sessionsData || []).map(async (session) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', session.user_id)
          .single();
        
        return {
          ...session,
          profiles: profile
        };
      })
    );

    setUserSessions(enrichedSessions || []);
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all users
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch support messages with user names  
    const { data: messagesData } = await supabase
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch profile names separately for messages
    const enrichedMessages = await Promise.all(
      (messagesData || []).map(async (message) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', message.user_id)
          .single();
        
        return {
          ...message,
          profiles: profile
        };
      })
    );

    // Fetch wallet balances
    const { data: balancesData } = await supabase
      .from('wallet_balances')
      .select('*')
      .order('created_at', { ascending: false });

    const enrichedBalances = await Promise.all(
      (balancesData || []).map(async (balance) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', balance.user_id)
          .single();
        
        return {
          ...balance,
          profiles: profile
        };
      })
    );

    // Fetch KYC submissions
    const { data: kycData } = await supabase
      .from('kyc_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    const enrichedKyc = await Promise.all(
      (kycData || []).map(async (kyc) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', kyc.user_id)
          .single();
        
        return {
          ...kyc,
          profiles: profile
        };
      })
    );

    // Fetch user sessions
    const { data: sessionsData } = await supabase
      .from('user_sessions')
      .select('*')
      .order('logged_in_at', { ascending: false });

    const enrichedSessions = await Promise.all(
      (sessionsData || []).map(async (session) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', session.user_id)
          .single();
        
        return {
          ...session,
          profiles: profile
        };
      })
    );

    // Fetch VIP memberships
    const { data: vipData } = await supabase
      .from('vip_memberships')
      .select('*')
      .order('created_at', { ascending: false });

    setProfiles(profilesData || []);
    setMessages(enrichedMessages || []);
    setWalletBalances(enrichedBalances || []);
    setKycSubmissions(enrichedKyc || []);
    setUserSessions(enrichedSessions || []);
    setVipMemberships(vipData || []);
    setLoading(false);
  };

  const assignVip = async () => {
    if (!vipUserId || !vipPackage) {
      toast({ title: "Error", description: "Select a user and VIP package", variant: "destructive" });
      return;
    }
    const pkg = VIP_PACKAGES.find(p => p.name === vipPackage);
    if (!pkg) return;

    const { error } = await supabase
      .from('vip_memberships')
      .upsert({
        user_id: vipUserId,
        package_name: pkg.name,
        deposit_amount: pkg.deposit,
        bonus_amount: pkg.bonus,
        status: 'active',
        assigned_by: user?.id,
      }, { onConflict: 'user_id' });

    if (error) {
      // If upsert fails due to no unique constraint on user_id, try insert
      const { error: insertErr } = await supabase
        .from('vip_memberships')
        .insert({
          user_id: vipUserId,
          package_name: pkg.name,
          deposit_amount: pkg.deposit,
          bonus_amount: pkg.bonus,
          status: 'active',
          assigned_by: user?.id,
        });
      if (insertErr) {
        toast({ title: "Error", description: "Failed to assign VIP", variant: "destructive" });
        return;
      }
    }

    toast({ title: "VIP Assigned! ⭐", description: `${pkg.name} package assigned successfully` });
    setVipUserId('');
    setVipPackage('');
    fetchData();
  };

  const removeVip = async (vipId: string) => {
    await supabase.from('vip_memberships').delete().eq('id', vipId);
    toast({ title: "VIP Removed", description: "VIP membership has been removed" });
    fetchData();
  };

  const verifyUser = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ verified: true })
      .eq('user_id', userId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to verify user",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "User verified successfully"
      });
      fetchData();
    }
  };

  const replyToMessage = async (messageId: string) => {
    const reply = replyTexts[messageId];
    if (!reply?.trim()) return;

    const { error } = await supabase
      .from('support_messages')
      .update({ 
        admin_reply: reply,
        status: 'replied',
        replied_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (error) {
      toast({
        title: "Error", 
        description: "Failed to send reply",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Reply sent successfully"
      });
      setReplyTexts({ ...replyTexts, [messageId]: '' });
      fetchData();
    }
  };

  const updateWalletBalance = async () => {
    if (!selectedUserForBalance || !newBalance || !selectedSymbol) return;

    const balance = parseFloat(newBalance);
    if (isNaN(balance) || balance < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid balance amount",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from('wallet_balances')
      .upsert({
        user_id: selectedUserForBalance,
        symbol: selectedSymbol,
        balance: balance
      }, {
        onConflict: 'user_id,symbol'
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update wallet balance",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Wallet balance updated successfully"
      });
      setSelectedUserForBalance('');
      setNewBalance('');
      setSelectedSymbol('BTC');
      fetchData();
    }
  };

  const approveKyc = async (kycId: string, userId: string) => {
    const { error: kycError } = await supabase
      .from('kyc_submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', kycId);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ verified: true })
      .eq('user_id', userId);

    if (kycError || profileError) {
      toast({
        title: "Error",
        description: "Failed to approve KYC",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "KYC approved successfully"
      });
      fetchData();
    }
  };

  const rejectKyc = async (kycId: string) => {
    const rejectionReason = prompt('Please enter the reason for rejection:');
    if (!rejectionReason || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Rejection reason is required",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from('kyc_submissions')
      .update({ 
        status: 'rejected', 
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason.trim()
      })
      .eq('id', kycId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reject KYC",
        variant: "destructive"
      });
    } else {
      toast({
        title: "KYC Rejected",
        description: "KYC has been rejected with reason provided"
      });
      fetchData();
    }
  };

  const deleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    
    try {
      // Delete all related data in order (respecting foreign key constraints)
      await supabase.from('wallet_balances').delete().eq('user_id', userId);
      await supabase.from('transactions').delete().eq('user_id', userId);
      await supabase.from('kyc_submissions').delete().eq('user_id', userId);
      await supabase.from('support_messages').delete().eq('user_id', userId);
      await supabase.from('user_sessions').delete().eq('user_id', userId);
      await supabase.from('verification_questions').delete().eq('user_id', userId);
      await supabase.from('user_roles').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('user_id', userId);
      
      toast({
        title: "User Deleted",
        description: "User and all associated data have been removed",
      });
      
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const adjustWalletBalance = async (userId: string, symbol: string, adjustment: number) => {
    // Find current balance
    const currentBalance = walletBalances.find(
      b => b.user_id === userId && b.symbol === symbol
    );
    
    const newBalance = (currentBalance?.balance || 0) + adjustment;
    
    if (newBalance < 0) {
      toast({
        title: "Error",
        description: "Balance cannot go below zero",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from('wallet_balances')
      .upsert({
        user_id: userId,
        symbol: symbol,
        balance: newBalance
      }, {
        onConflict: 'user_id,symbol'
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to adjust wallet balance",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: `${adjustment >= 0 ? 'Added' : 'Subtracted'} ${Math.abs(adjustment)} ${symbol}. New balance: ${newBalance.toFixed(8)}`,
      });
      setAdjustmentAmount({});
      setAdjustmentSymbol({});
      fetchData();
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Simple Admin Panel</h1>
      
      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Users ({profiles.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity ({userSessions.filter(s => s.is_active).length})
          </TabsTrigger>
          <TabsTrigger value="livechat" className="flex items-center gap-2 relative">
            <MessageSquare className="h-4 w-4" />
            Live Chat
            {liveChatUnread > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs animate-pulse">
                {liveChatUnread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="support" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Support ({messages.filter(m => m.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="wallets" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Wallets ({walletBalances.length})
          </TabsTrigger>
          <TabsTrigger value="kyc" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            KYC ({kycSubmissions.filter(k => k.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="vip" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            VIP ({vipMemberships.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <div className="grid gap-4">
            {profiles.map((profile) => {
              const userBalances = walletBalances.filter(b => b.user_id === profile.user_id);
              const userKyc = kycSubmissions.find(k => k.user_id === profile.user_id);
              
              return (
                <Card key={profile.id}>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {profile.first_name} {profile.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Joined: {new Date(profile.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Phone: {profile.phone_number || 'Not provided'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Address: {profile.address || 'Not provided'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {profile.verified ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Unverified</Badge>
                          )}
                          <AdminChatInitiator 
                            userId={profile.user_id} 
                            userName={`${profile.first_name} ${profile.last_name}`}
                            adminId={user?.id || ''}
                          />
                          {userKyc && (
                            <Badge variant={userKyc.status === 'pending' ? 'destructive' : 'default'}>
                              KYC: {userKyc.status}
                            </Badge>
                          )}
                          
                          {/* Delete User Button */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                className="mt-2"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete User
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                  Delete User Permanently?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete <strong>{profile.first_name} {profile.last_name}</strong> and all their data including:
                                  <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>Profile information</li>
                                    <li>Wallet balances</li>
                                    <li>Transactions</li>
                                    <li>KYC submissions</li>
                                    <li>Support messages</li>
                                    <li>Session history</li>
                                  </ul>
                                  <p className="mt-3 font-semibold text-destructive">This action cannot be undone.</p>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser(profile.user_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  disabled={deletingUserId === profile.user_id}
                                >
                                  {deletingUserId === profile.user_id ? 'Deleting...' : 'Delete User'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      
                      {/* Wallet Balances */}
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Wallet Balances</h4>
                        {userBalances.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {userBalances.map((balance) => (
                              <div key={balance.id} className="text-sm">
                                <span className="font-medium">{balance.symbol}:</span> {parseFloat(balance.balance.toString()).toFixed(8)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No balances set</p>
                        )}
                      </div>

                      {/* Quick Balance Adjustment */}
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Adjust Balance (+/-)</h4>
                        <div className="grid grid-cols-4 gap-2">
                          <select
                            value={adjustmentSymbol[profile.user_id] || 'BTC'}
                            onChange={(e) => setAdjustmentSymbol({
                              ...adjustmentSymbol,
                              [profile.user_id]: e.target.value
                            })}
                            className="p-2 border border-border rounded text-sm bg-background"
                          >
                            <option value="BTC">BTC</option>
                            <option value="ETH">ETH</option>
                            <option value="USDT">USDT</option>
                            <option value="USDC">USDC</option>
                          </select>
                          <Input
                            type="number"
                            step="0.00000001"
                            placeholder="+/- Amount"
                            value={adjustmentAmount[profile.user_id] || ''}
                            onChange={(e) => setAdjustmentAmount({
                              ...adjustmentAmount,
                              [profile.user_id]: e.target.value
                            })}
                            className="text-sm col-span-2"
                          />
                          <div className="flex gap-1">
                            <Button 
                              onClick={() => {
                                const amount = parseFloat(adjustmentAmount[profile.user_id] || '0');
                                const symbol = adjustmentSymbol[profile.user_id] || 'BTC';
                                if (amount !== 0) {
                                  adjustWalletBalance(profile.user_id, symbol, Math.abs(amount));
                                }
                              }}
                              disabled={!adjustmentAmount[profile.user_id] || parseFloat(adjustmentAmount[profile.user_id]) === 0}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              +
                            </Button>
                            <Button 
                              onClick={() => {
                                const amount = parseFloat(adjustmentAmount[profile.user_id] || '0');
                                const symbol = adjustmentSymbol[profile.user_id] || 'BTC';
                                if (amount !== 0) {
                                  adjustWalletBalance(profile.user_id, symbol, -Math.abs(amount));
                                }
                              }}
                              disabled={!adjustmentAmount[profile.user_id] || parseFloat(adjustmentAmount[profile.user_id]) === 0}
                              size="sm"
                              variant="destructive"
                            >
                              −
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Use + to add funds, − to subtract from balance
                        </p>
                      </div>

                      {/* Set Exact Balance */}
                      <div className="bg-amber-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Set Exact Balance</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={selectedUserId === profile.user_id ? selectedSymbol : ''}
                            onChange={(e) => {
                              setSelectedUserId(profile.user_id);
                              setSelectedSymbol(e.target.value);
                            }}
                            className="p-2 border border-border rounded text-sm bg-background"
                          >
                            <option value="">Select crypto</option>
                            <option value="BTC">Bitcoin (BTC)</option>
                            <option value="ETH">Ethereum (ETH)</option>
                            <option value="USDT">Tether (USDT)</option>
                            <option value="USDC">USD Coin (USDC)</option>
                          </select>
                          <Input
                            type="number"
                            step="0.00000001"
                            placeholder="Exact amount"
                            value={selectedUserId === profile.user_id ? newBalance : ''}
                            onChange={(e) => {
                              setSelectedUserId(profile.user_id);
                              setNewBalance(e.target.value);
                            }}
                            className="text-sm"
                          />
                          <Button 
                            onClick={() => {
                              setSelectedUserForBalance(profile.user_id);
                              updateWalletBalance();
                            }}
                            disabled={selectedUserId !== profile.user_id || !newBalance || !selectedSymbol}
                            size="sm"
                          >
                            Set
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="space-y-6">
            {/* Active Users Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  User Activity Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {userSessions.filter(s => s.is_active).length}
                    </p>
                    <p className="text-sm text-green-700">Active Now</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {userSessions.length}
                    </p>
                    <p className="text-sm text-blue-700">Total Logins</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-gray-600">
                      {new Set(userSessions.map(s => s.user_id)).size}
                    </p>
                    <p className="text-sm text-gray-700">Unique Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Session List */}
            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">Login Sessions</h3>
              {userSessions.map((session) => (
                <Card key={session.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${session.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        <div>
                          <h4 className="font-semibold">
                            {session.profiles?.first_name} {session.profiles?.last_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Logged in: {new Date(session.logged_in_at).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last active: {new Date(session.last_active_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={session.is_active ? 'default' : 'secondary'} className={session.is_active ? 'bg-green-100 text-green-800' : ''}>
                        {session.is_active ? '🟢 Active' : '⚫ Inactive'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {userSessions.length === 0 && (
                <Card>
                  <CardContent className="p-4 text-center text-muted-foreground">
                    No login sessions recorded yet.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="livechat">
          <AdminLiveChatView adminId={user?.id || ''} onUnreadCountChange={setLiveChatUnread} />
        </TabsContent>

        <TabsContent value="support">
          <div className="grid gap-4">
            {messages.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No support messages yet.
                </CardContent>
              </Card>
            )}
            {messages.map((message) => (
              <Card key={message.id} className="border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {message.profiles?.first_name} {message.profiles?.last_name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={message.status === 'pending' ? 'destructive' : 'default'}>
                      {message.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* User Message - Clearly readable */}
                    <div className="bg-muted/50 p-4 rounded-lg border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">User Message:</p>
                      <p className="text-foreground whitespace-pre-wrap">{message.message}</p>
                    </div>
                    
                    {/* Admin Reply if exists */}
                    {message.admin_reply && (
                      <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Admin Reply:</p>
                        <p className="text-green-900 dark:text-green-100 whitespace-pre-wrap">{message.admin_reply}</p>
                      </div>
                    )}
                    
                    {/* Reply Form - Always visible for pending messages */}
                    {message.status === 'pending' && (
                      <div className="space-y-3 pt-2 border-t">
                        <Label htmlFor={`reply-${message.id}`} className="font-medium">
                          Reply to this message:
                        </Label>
                        <Textarea
                          id={`reply-${message.id}`}
                          placeholder="Type your reply here..."
                          value={replyTexts[message.id] || ''}
                          onChange={(e) => setReplyTexts({
                            ...replyTexts,
                            [message.id]: e.target.value
                          })}
                          className="min-h-[100px]"
                        />
                        <Button 
                          onClick={() => replyToMessage(message.id)}
                          disabled={!replyTexts[message.id]?.trim()}
                          className="w-full sm:w-auto"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Send Reply
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="wallets">
          <div className="space-y-6">
            {/* Add/Update Balance Form */}
            <Card>
              <CardHeader>
                <CardTitle>Update Wallet Balance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="user-select">Select User</Label>
                  <select
                    id="user-select"
                    value={selectedUserForBalance}
                    onChange={(e) => setSelectedUserForBalance(e.target.value)}
                    className="w-full mt-1 p-2 border border-border rounded-md bg-background"
                  >
                    <option value="">Select a user...</option>
                    {profiles.map((profile) => (
                      <option key={profile.user_id} value={profile.user_id}>
                        {profile.first_name} {profile.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="symbol-select">Cryptocurrency</Label>
                  <select
                    id="symbol-select"
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="w-full mt-1 p-2 border border-border rounded-md bg-background"
                  >
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="USDT">Tether (USDT)</option>
                    <option value="USDC">USD Coin (USDC)</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="balance-input">Balance Amount</Label>
                  <Input
                    id="balance-input"
                    type="number"
                    step="0.00000001"
                    placeholder="Enter balance amount"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={updateWalletBalance}
                  disabled={!selectedUserForBalance || !newBalance || !selectedSymbol}
                >
                  Update Balance
                </Button>
              </CardContent>
            </Card>

            {/* Current Balances */}
            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">Current Wallet Balances</h3>
              {walletBalances.map((balance) => (
                <Card key={balance.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">
                          {balance.profiles?.first_name} {balance.profiles?.last_name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {balance.symbol}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">
                          {parseFloat(balance.balance.toString()).toFixed(8)} {balance.symbol}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {walletBalances.length === 0 && (
                <Card>
                  <CardContent className="p-4 text-center text-muted-foreground">
                    No wallet balances found. Add some balances using the form above.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="kyc">
          <div className="grid gap-4">
            <h3 className="text-lg font-semibold">KYC Submissions</h3>
            {kycSubmissions.map((kyc) => (
              <Card key={kyc.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {kyc.profiles?.first_name} {kyc.profiles?.last_name}
                    </CardTitle>
                    <Badge variant={kyc.status === 'pending' ? 'destructive' : kyc.status === 'approved' ? 'default' : 'secondary'}>
                      {kyc.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold">Document Type:</p>
                      <p className="text-muted-foreground">{kyc.document_type}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted: {new Date(kyc.submitted_at).toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {kyc.front_document_url && (
                        <div>
                          <Label>Front Document</Label>
                          <Button
                            variant="outline"
                            className="w-full mt-1"
                            onClick={async () => {
                              const { data, error } = await supabase.storage
                                .from('kyc-documents')
                                .createSignedUrl(kyc.front_document_url!, 3600);
                              if (data?.signedUrl) {
                                window.open(data.signedUrl, '_blank');
                              } else {
                                toast({ title: "Error", description: "Could not load document", variant: "destructive" });
                              }
                            }}
                          >
                            📄 View Front Document
                          </Button>
                        </div>
                      )}
                      {kyc.back_document_url && (
                        <div>
                          <Label>Back Document</Label>
                          <Button
                            variant="outline"
                            className="w-full mt-1"
                            onClick={async () => {
                              const { data, error } = await supabase.storage
                                .from('kyc-documents')
                                .createSignedUrl(kyc.back_document_url!, 3600);
                              if (data?.signedUrl) {
                                window.open(data.signedUrl, '_blank');
                              } else {
                                toast({ title: "Error", description: "Could not load document", variant: "destructive" });
                              }
                            }}
                          >
                            📄 View Back Document
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {kyc.status === 'pending' && (
                      <div className="space-y-3">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-yellow-800">⚠️ Action Required</p>
                          <p className="text-xs text-yellow-700">Please review the documents carefully before making a decision.</p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => approveKyc(kyc.id, kyc.user_id)}
                            className="bg-green-600 hover:bg-green-700 flex-1"
                          >
                            ✅ Approve KYC
                          </Button>
                          <Button 
                            onClick={() => rejectKyc(kyc.id)}
                            variant="destructive"
                            className="flex-1"
                          >
                            ❌ Reject KYC
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {kyc.status === 'approved' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-green-800">✅ Approved</p>
                        <p className="text-xs text-green-700">
                          Reviewed on {new Date(kyc.reviewed_at || '').toLocaleString()}
                        </p>
                      </div>
                    )}
                    
                    {kyc.status === 'rejected' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-red-800">❌ Rejected</p>
                        <p className="text-xs text-red-700">
                          Reviewed on {new Date(kyc.reviewed_at || '').toLocaleString()}
                        </p>
                        {kyc.rejection_reason && (
                          <div className="mt-2 p-2 bg-red-100 rounded">
                            <p className="text-xs font-medium text-red-800">Reason:</p>
                            <p className="text-xs text-red-700">{kyc.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {kycSubmissions.length === 0 && (
              <Card>
                <CardContent className="p-4 text-center text-muted-foreground">
                  No KYC submissions found.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="vip">
          <div className="space-y-6">
            {/* Assign VIP */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Assign VIP Package
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Select User</Label>
                    <select
                      value={vipUserId}
                      onChange={(e) => setVipUserId(e.target.value)}
                      className="w-full p-2 border border-border rounded-md bg-background text-sm"
                    >
                      <option value="">Select user...</option>
                      {profiles.map(p => (
                        <option key={p.user_id} value={p.user_id}>
                          {p.first_name} {p.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>VIP Package</Label>
                    <select
                      value={vipPackage}
                      onChange={(e) => setVipPackage(e.target.value)}
                      className="w-full p-2 border border-border rounded-md bg-background text-sm"
                    >
                      <option value="">Select package...</option>
                      {VIP_PACKAGES.map(pkg => (
                        <option key={pkg.name} value={pkg.name}>
                          {pkg.name} → ${pkg.bonus} bonus
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={assignVip} disabled={!vipUserId || !vipPackage} className="w-full">
                      <Star className="h-4 w-4 mr-2" />
                      Assign VIP
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current VIP Members */}
            <div className="grid gap-4">
              {vipMemberships.map((vip) => {
                const profile = profiles.find(p => p.user_id === vip.user_id);
                return (
                  <Card key={vip.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                            {profile ? `${profile.first_name} ${profile.last_name}` : vip.user_id}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Package: <Badge variant="default">{vip.package_name}</Badge>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Deposit: ${vip.deposit_amount} | Bonus: ${vip.bonus_amount}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Assigned: {new Date(vip.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={vip.status === 'active' ? 'default' : 'secondary'}>
                            {vip.status}
                          </Badge>
                          <Button variant="destructive" size="sm" onClick={() => removeVip(vip.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {vipMemberships.length === 0 && (
                <Card>
                  <CardContent className="p-4 text-center text-muted-foreground">
                    No VIP members yet. Assign a VIP package above.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <AdminPlatformSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}