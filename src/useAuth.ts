import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  alias: string;
  email?: string;
  phone?: string;
  city?: string;
  intent?: 'demand' | 'supply' | 'both';
  age?: number;
  interests?: string;
  language?: string;
  role?: 'user' | 'admin';
  trustScore: number;
  subscribedCategories?: string[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          setProfile(null); // Needs registration
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginAnonymously = async () => {
    try {
      setLoading(true);
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Auth error", error);
    }
  };

  const registerUser = async (profileData: Partial<UserProfile>) => {
    if (!user) return;
    const newProfile: UserProfile = {
      uid: user.uid,
      alias: profileData.alias || 'Anonymous',
      email: profileData.email || '',
      phone: profileData.phone || '',
      city: profileData.city || '',
      intent: profileData.intent || 'both',
      age: profileData.age || 0,
      interests: profileData.interests || '',
      language: profileData.language || 'he',
      role: 'user', // Default role
      trustScore: 0, // Starting trust score
      subscribedCategories: profileData.subscribedCategories || []
    };
    await setDoc(doc(db, 'users', user.uid), newProfile);
    setProfile(newProfile);
  };

  const logout = () => auth.signOut();

  return { user, profile, loading, loginAnonymously, registerUser, logout };
}
