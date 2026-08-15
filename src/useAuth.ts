import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  onAuthStateChanged 
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

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
  myCommunities?: string[];
  ignoredCommunities?: string[];
  ignoredPosts?: string[];
  hasCompletedOnboarding?: boolean;
  bio?: string;
  createdAt?: number;
  pushEnabled?: boolean;
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

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      setLoading(false);
    }
  };

  const checkEmailExists = async (email: string) => {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    return !snap.empty;
  };

  const registerWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const exists = await checkEmailExists(email);
      if (exists) {
        throw new Error('email_exists');
      }
      await createUserWithEmailAndPassword(auth, email, password);
      // Wait for onAuthStateChanged to pick this up. The profile will be created in App.tsx
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const registerProfile = async (profileData: Partial<UserProfile>) => {
    if (!user) return;
    const newProfile: UserProfile = {
      uid: user.uid,
      alias: profileData.alias || 'Anonymous',
      email: user.email || '',
      phone: profileData.phone || '',
      city: profileData.city || '',
      intent: profileData.intent || 'both',
      age: profileData.age || 0,
      interests: profileData.interests || '',
      language: profileData.language || 'he',
      role: 'user',
      trustScore: 0,
      subscribedCategories: profileData.subscribedCategories || [],
      myCommunities: [],
      ignoredCommunities: [],
      ignoredPosts: profileData.ignoredPosts || [],
      hasCompletedOnboarding: false,
      createdAt: Date.now(),
      bio: '',
      pushEnabled: false
    };
    await setDoc(doc(db, 'users', user.uid), newProfile);
    setProfile(newProfile);
  };

  const updateProfile = async (profileData: Partial<UserProfile>) => {
    if (!user || !profile) return;
    const updatedProfile = { ...profile, ...profileData };
    await updateDoc(doc(db, 'users', user.uid), profileData);
    setProfile(updatedProfile);
  };

  const completeOnboarding = async () => {
    if (!user || !profile) return;
    await updateDoc(doc(db, 'users', user.uid), {
      hasCompletedOnboarding: true
    });
    setProfile({ ...profile, hasCompletedOnboarding: true });
  };

  const requestNotificationPermission = async () => {
    if (!user || !profile) return false;
    try {
      if (!('Notification' in window)) {
        alert('הדפדפן שלך אינו תומך בהתראות פוש. (באייפון יש להוסיף את האתר למסך הבית קודם).');
        return false;
      }

      const { messaging } = await import('./firebase');
      if (!messaging) {
        console.log('Messaging not supported.');
        return false;
      }
      const { getToken } = await import('firebase/messaging');
      
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const currentToken = await getToken(messaging, { vapidKey: 'BHvDyJu6RngbsmJ7VhkynSdC_w6Ei7OxOSOwltEfBEKnFu6jNmARl2ssdnAKqpnaPSg0ruHLWCFlEIYWKg0L4pQ' });
        if (currentToken) {
          await updateDoc(doc(db, 'users', user.uid), {
            fcmToken: currentToken,
            pushEnabled: true
          });
          setProfile({ ...profile, fcmToken: currentToken, pushEnabled: true } as any);
          return true;
        }
      } else {
        alert('לא ניתן אישור לקבלת התראות מהדפדפן.');
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      alert('שגיאה בבקשת התראות. ודא שהוספת את האתר למסך הבית (Add to Home Screen).');
      return false;
    }
  };

  const logout = () => auth.signOut();

  return { user, profile, loading, loginWithEmail, registerWithEmail, resetPassword, registerProfile, updateProfile, completeOnboarding, requestNotificationPermission, logout };
}
