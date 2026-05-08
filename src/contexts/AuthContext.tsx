import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    
    // Track user session on successful login
    if (result.data?.user && !result.error) {
      await supabase.from('user_sessions').insert({
        user_id: result.data.user.id,
        logged_in_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        is_active: true
      });
    }
    
    return result;
  };

  const signUp = async (email: string, password: string) => {
    // Input validation
    if (!email || !email.includes('@')) {
      throw new Error('Valid email is required');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    try {
      const redirectUrl = `${window.location.origin}/`;
      const result = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });
      
      if (result.error) {
        console.error('Signup error:', result.error);
        throw result.error;
      }
      
      return result;
    } catch (error: any) {
      console.error('Signup exception:', {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error
      });
      
      // Provide more helpful error message
      if (error.status === 404 || error.code === 'NOT_FOUND') {
        throw new Error('Signup service unavailable. Please check your internet connection or try again later. If the problem persists, please contact support.');
      }
      
      throw error;
    }
  };

  const signOut = async () => {
    // Mark session as inactive before signing out
    if (user) {
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);
    }
    await supabase.auth.signOut();
    setIsDemoMode(false);
  };

  const enterDemoMode = () => {
    setIsDemoMode(true);
    setLoading(false);
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);
  };

  const value = {
    user,
    loading,
    isDemoMode,
    signIn,
    signUp,
    signOut,
    enterDemoMode,
    exitDemoMode,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};