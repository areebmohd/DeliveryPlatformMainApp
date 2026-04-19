import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../api/supabase';
import { Session, User } from '@supabase/supabase-js';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  isResettingPassword: boolean;
  setIsResettingPassword: (val: boolean) => void;
  signOut: () => Promise<void>;
  updateProfile: (updates: { full_name?: string; phone?: string }) => Promise<{ success: boolean; error?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // PGRST116 is the error code for 0 rows returned by .single()
        if (error.code === 'PGRST116') {
          // Profile record not found - likely a new sign-up
          // Re-fetch user to get latest metadata
          const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
          
          if (currentUser) {
            console.log('Profile missing for:', currentUser.email, '- Attempting manual creation fallback');
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: currentUser.id,
                email: currentUser.email,
                full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || 'New User',
                role: currentUser.user_metadata?.role || 'customer',
              })
              .select()
              .single();

            if (!insertError) {
              setProfile(newProfile);
              return;
            }
            // If we get an RLS error (42501), it confirms the user needs to run the SQL trigger/policy
            if (insertError.code === '42501') {
              console.warn('Profile creation failed due to RLS. Please ensure you have run the provided SQL in Supabase.');
            } else {
              console.error('Error creating profile manually:', insertError);
            }
          }
          
          setProfile(null);
          return;
        }
        throw error;
      }
      setProfile(data);
    } catch (e) {
      console.error('Error fetching profile:', e);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.log('Google Sign-Out Error:', error);
    }
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: { full_name?: string; phone?: string }) => {
    try {
      if (!user) throw new Error('No user logged in');
      
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      return { success: true };
    } catch (e) {
      console.error('Error updating profile:', e);
      return { success: false, error: e };
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, isResettingPassword, setIsResettingPassword, signOut, updateProfile }}>
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
