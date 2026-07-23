import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';

export interface Location {
  lat: number;
  lng: number;
}

export function useFeed(radiusKm: number = 150, communityId?: string) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location: ", error);
        }
      );
    }
  }, []);

  const fetchPosts = async () => {
    if (!location) return;

    setLoading(true);
    try {
      const radiusInM = radiusKm * 1000;
      const center = [location.lat, location.lng] as [number, number];
      const bounds = geohashQueryBounds(center, radiusInM);
      const promises = [];

      for (const b of bounds) {
        let q = query(
          collection(db, 'posts'),
          where('location.geohash', '>=', b[0]),
          where('location.geohash', '<=', b[1]),
          where('status', 'in', ['active', 'tender'])
        );
        if (communityId) {
          q = query(q, where('communityId', '==', communityId));
        }
        promises.push(getDocs(q));
      }

      const snapshots = await Promise.all(promises);
      const matchingDocs: any[] = [];
      const now = new Date().toISOString();

      for (const snap of snapshots) {
        for (const doc of snap.docs) {
          const data = doc.data();
          
          if (data.expiresAt && data.expiresAt < now) continue;
          
          // Filter out community posts if we are in the global feed
          if (!communityId && data.communityId && data.communityId !== 'global') continue;

          const lat = data.location.lat;
          const lng = data.location.lng;
          const distanceInKm = distanceBetween([lat, lng], center);
          
          if (distanceInKm <= data.radius) {
            matchingDocs.push({ id: doc.id, ...data, distance: distanceInKm });
          }
        }
      }
      matchingDocs.sort((a, b) => {
        if (a.isPopup && !b.isPopup) return -1;
        if (!a.isPopup && b.isPopup) return 1;
        return a.distance - b.distance;
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
  }, [location, radiusKm, communityId]);

  // Exposing fetchPosts so it can be called manually if needed (e.g. after connection/bid)
  return { posts, loading, location, setPosts, fetchPosts };
}
