import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { useAuth } from './useAuth';

export interface Location {
  lat: number;
  lng: number;
}

export function useFeed(radiusKm: number = 150, communityId?: string) {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [fetchLimit, setFetchLimit] = useState(15);
  const [hasMore, setHasMore] = useState(true);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationError(null);
        },
        (error) => {
          console.error("Error getting location: ", error);
          let errMsg = 'לא ניתן לקבל מיקום';
          if (error.code === 1) errMsg = 'אין הרשאת גישה למיקום';
          if (error.code === 3) errMsg = 'תם הזמן להמתנה למיקום (Timeout)';
          setLocationError(errMsg);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setLocationError('הדפדפן אינו תומך במיקום');
    }
  }, []);

  const fetchPosts = async () => {
    // For global feed, we need location or fallbackMode.
    if (!location && !communityId && !fallbackMode) return;

    setLoading(true);
    try {
      const matchingDocs: any[] = [];
      const now = new Date().toISOString();

      if (communityId) {
        // COMMUNITY FEED: Ignore geographical bounds. Fetch all active posts for this community.
        const q = query(
          collection(db, 'posts'),
          where('communityId', '==', communityId),
          where('status', 'in', ['active', 'tender']),
          limit(fetchLimit)
        );
        const snap = await getDocs(q);
        
        for (const doc of snap.docs) {
          const data = doc.data();
          if (data.expiresAt && data.expiresAt < now) continue;
          if (profile?.ignoredPosts?.includes(doc.id)) continue;
          
          matchingDocs.push({ id: doc.id, ...data });
        }
        
        setHasMore(snap.docs.length === fetchLimit);
      } else {
        if (!location) {
          if (fallbackMode) {
            // FALLBACK MODE: Fetch newest global posts without location
            const q = query(
              collection(db, 'posts'),
              where('communityId', '==', 'global'),
              where('status', 'in', ['active', 'tender']),
              limit(fetchLimit * 2)
            );
            const snap = await getDocs(q);
            for (const doc of snap.docs) {
              const data = doc.data();
              if (data.expiresAt && data.expiresAt < now) continue;
              if (profile?.ignoredPosts?.includes(doc.id)) continue;
              matchingDocs.push({ id: doc.id, ...data, distance: 0 }); // distance 0 as fallback
            }
            setHasMore(snap.docs.length >= fetchLimit);
          } else {
            setLoading(false);
            return;
          }
        } else {


        const radiusInM = radiusKm * 1000;
        const center = [location.lat, location.lng] as [number, number];
        const bounds = geohashQueryBounds(center, radiusInM);
        const promises = [];

        for (const b of bounds) {
          let q = query(
            collection(db, 'posts'),
            where('location.geohash', '>=', b[0]),
            where('location.geohash', '<=', b[1]),
            where('status', 'in', ['active', 'tender']),
            limit(fetchLimit)
          );
          promises.push(getDocs(q));
        }

        const snapshots = await Promise.all(promises);
        
        for (const snap of snapshots) {
          for (const doc of snap.docs) {
            const data = doc.data();
            
            if (data.expiresAt && data.expiresAt < now) continue;
            if (profile?.ignoredPosts?.includes(doc.id)) continue;
            
            // Filter out community posts if we are in the global feed
            if (data.communityId && data.communityId !== 'global') continue;

            const lat = data.location.lat;
            const lng = data.location.lng;
            const distanceInKm = distanceBetween([lat, lng], center);
            
            if (distanceInKm <= data.radius) {
              matchingDocs.push({ id: doc.id, ...data, distance: distanceInKm });
            }
          }
        }
        setHasMore(snapshots.some(snap => snap.docs.length === fetchLimit));
        } // close location else
      } // close communityId else

      // Sort results
      matchingDocs.sort((a, b) => {
        if (a.isPopup && !b.isPopup) return -1;
        if (!a.isPopup && b.isPopup) return 1;
        const dateA = a.createdAt?.toMillis?.() || a.createdAt || 0;
        const dateB = b.createdAt?.toMillis?.() || b.createdAt || 0;
        return dateB - dateA;
      });
      
      setPosts(matchingDocs);
    } catch (err) {
      console.error("Error fetching feed: ", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, radiusKm, communityId, fetchLimit]);

  const loadMore = () => {
    setFetchLimit(prev => prev + 15);
  };

  // Exposing fetchPosts so it can be called manually if needed (e.g. after connection/bid)
  return { posts, setPosts, loading, location, locationError, fallbackMode, setFallbackMode, fetchPosts, loadMore, hasMore };
}
