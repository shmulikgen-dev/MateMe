import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RadiusMapPreviewProps {
  radiusKm: number;
  center?: { lat: number; lng: number } | null;
  onCenterChange?: (coords: { lat: number; lng: number }) => void;
}

// Counter-clockwise polygon of Israel's borders (Mediterranean coast -> Eilat -> Eastern border -> Golan/Hermon -> Northern border)
const ISRAEL_BORDER_CCW: [number, number][] = [
  // Mediterranean Coast (North to South)
  [33.094, 35.104], // Rosh HaNikra
  [33.006, 35.089], // Nahariya
  [32.923, 35.068], // Akko
  [32.818, 35.039], // Haifa Bay
  [32.830, 34.954], // Haifa Carmel Cape
  [32.687, 34.926], // Atlit
  [32.500, 34.889], // Caesarea
  [32.404, 34.864], // Hadera
  [32.328, 34.846], // Netanya
  [32.165, 34.796], // Herzliya
  [32.080, 34.764], // Tel Aviv
  [31.986, 34.726], // Bat Yam / Rishon Coast
  [31.812, 34.636], // Ashdod
  [31.669, 34.544], // Ashkelon
  [31.608, 34.507], // Zikim
  // Western Negev Border
  [31.558, 34.545], // Netiv HaAsara
  [31.472, 34.492], // Nahal Oz
  [31.380, 34.435], // Re'im
  [31.300, 34.375], // Kissufim
  [31.221, 34.268], // Kerem Shalom
  // Southern Border (Sinai / Negev down to Eilat)
  [31.050, 34.330], // Holot Halutza
  [30.880, 34.395], // Nitzana
  [30.770, 34.455], // Ezuz
  [30.505, 34.555], // Har Harif
  [30.300, 34.620], // Har Sagi
  [29.950, 34.760], // Uvda West
  [29.590, 34.875], // Netafim
  [29.491, 34.903], // Taba / Eilat South
  // Eilat & Eastern Border (Arava to Dead Sea)
  [29.546, 34.978], // Eilat North Beach
  [29.700, 35.025], // Beer Ora
  [29.890, 35.075], // Yotvata
  [30.360, 35.170], // Paran
  [30.660, 35.255], // Ein Yahav
  [30.850, 35.340], // Hatzeva
  [30.950, 35.385], // Neot HaKikar
  // Dead Sea & Jordan Valley
  [31.200, 35.365], // Ein Bokek
  [31.460, 35.398], // Ein Gedi
  [31.760, 35.558], // Kalia
  [31.875, 35.545], // Jordan Valley South
  [32.160, 35.565], // Argaman
  [32.380, 35.560], // Mehola
  [32.495, 35.575], // Maoz Haim
  [32.645, 35.575], // Ashdot Ya'akov
  // Golan Heights & Mount Hermon
  [32.685, 35.665], // Hamat Gader
  [32.830, 35.815], // Ramat Magshimim
  [33.040, 35.855], // Alonei HaBashan
  [33.120, 35.825], // Zivan
  [33.305, 35.785], // Mount Hermon
  // Northern Border (East to West)
  [33.245, 35.630], // Har Dov
  [33.285, 35.578], // Metula
  [33.220, 35.552], // Manara
  [33.115, 35.535], // Yiftah
  [33.095, 35.505], // Malkia
  [33.065, 35.445], // Avivim / Dovev
  [33.048, 35.385], // Mattat
  [33.085, 35.335], // Biranit
  [33.102, 35.280], // Zar'it
  [33.088, 35.215], // Arab al-Aramshe
  [33.090, 35.155], // Hanita
];

interface Point2D {
  x: number;
  y: number;
}

/**
 * Clips an arbitrary subject polygon against a convex clip polygon (Sutherland-Hodgman algorithm).
 * Both polygons are in local kilometer coordinates (x = East, y = North) relative to center.
 */
function clipPolygonByConvexCircle(
  subjectPoly: Point2D[],
  radiusKm: number,
  segments = 72
): { clipped: Point2D[]; wasClipped: boolean } {
  // Build convex regular polygon for the circle in counter-clockwise order
  const circlePoly: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    circlePoly.push({
      x: radiusKm * Math.cos(angle),
      y: radiusKm * Math.sin(angle)
    });
  }

  let outputList = subjectPoly;

  // Check if any point of the circle lies outside the subject polygon (to know if border clipping occurred)
  let wasClipped = false;

  for (let i = 0; i < circlePoly.length; i++) {
    const clipA = circlePoly[i];
    const clipB = circlePoly[(i + 1) % circlePoly.length];

    const inputList = outputList;
    outputList = [];

    if (inputList.length === 0) break;

    // Inside test: point P is to the left of directed edge clipA -> clipB
    const isInside = (p: Point2D) =>
      (clipB.x - clipA.x) * (p.y - clipA.y) - (clipB.y - clipA.y) * (p.x - clipA.x) >= -1e-7;

    // Intersection of segment S -> E with line clipA -> clipB
    const computeIntersection = (s: Point2D, e: Point2D): Point2D => {
      const dc = { x: clipA.x - clipB.x, y: clipA.y - clipB.y };
      const dp = { x: s.x - e.x, y: s.y - e.y };
      const n1 = clipA.x * clipB.y - clipA.y * clipB.x;
      const n2 = s.x * e.y - s.y * e.x;
      const denom = dc.x * dp.y - dc.y * dp.x;
      if (Math.abs(denom) < 1e-9) return s;
      return {
        x: (n1 * dp.x - n2 * dc.x) / denom,
        y: (n1 * dp.y - n2 * dc.y) / denom
      };
    };

    let s = inputList[inputList.length - 1];
    for (const e of inputList) {
      if (isInside(e)) {
        if (!isInside(s)) {
          outputList.push(computeIntersection(s, e));
          wasClipped = true;
        } else {
          // If original subject vertex is inside the circle, the country border itself is inside the radius!
          wasClipped = true;
        }
        outputList.push(e);
      } else if (isInside(s)) {
        outputList.push(computeIntersection(s, e));
        wasClipped = true;
      }
      s = e;
    }
  }

  return { clipped: outputList, wasClipped };
}

export default function RadiusMapPreview({ radiusKm, center, onCenterChange }: RadiusMapPreviewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const unclippedLayerRef = useRef<L.Circle | null>(null);
  const markerLayerRef = useRef<L.CircleMarker | null>(null);

  // Default to central Israel (Tel Aviv area) until geolocation resolves
  const [userPos, setUserPos] = useState<{ lat: number; lng: number }>(
    center || { lat: 32.0853, lng: 34.7818 }
  );
  const [isClippedByBorder, setIsClippedByBorder] = useState(false);
  const [locating, setLocating] = useState(!center);

  useEffect(() => {
    if (center) {
      setUserPos(center);
      setLocating(false);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserPos(coords);
          setLocating(false);
          onCenterChange?.(coords);
        },
        () => {
          setLocating(false);
        },
        { enableHighAccuracy: false, timeout: 6000 }
      );
    } else {
      setLocating(false);
    }
  }, []);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [userPos.lat, userPos.lng],
      zoom: 11,
      zoomControl: true,
      attributionControl: false
    });

    // Free OpenStreetMap tiles (no API key required, shows Hebrew city & street names)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18
    }).addTo(map);

    // Allow clicking on map to test/adjust center location
    map.on('click', (e: L.LeafletMouseEvent) => {
      const nextPos = { lat: e.latlng.lat, lng: e.latlng.lng };
      setUserPos(nextPos);
      onCenterChange?.(nextPos);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update clipped polygon & camera whenever radiusKm or userPos changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const lat0 = userPos.lat;
    const lng0 = userPos.lng;
    const kmPerLat = 110.574;
    const kmPerLng = 111.32 * Math.cos((lat0 * Math.PI) / 180);

    // Convert Israel border polygon to local (x, y) in km around userPos
    const subjectInKm: Point2D[] = ISRAEL_BORDER_CCW.map(([lat, lng]) => ({
      x: (lng - lng0) * kmPerLng,
      y: (lat - lat0) * kmPerLat
    }));

    const { clipped } = clipPolygonByConvexCircle(subjectInKm, radiusKm, 72);

    // Convert clipped (x, y) back to [lat, lng]
    let latLngs: [number, number][] = clipped.map((pt) => [
      lat0 + pt.y / kmPerLat,
      lng0 + pt.x / kmPerLng
    ]);

    // Fallback if user is completely outside Israel's polygon (e.g. abroad): show regular circle
    if (latLngs.length < 3) {
      setIsClippedByBorder(false);
      latLngs = [];
      for (let i = 0; i < 72; i++) {
        const angle = (2 * Math.PI * i) / 72;
        latLngs.push([
          lat0 + (radiusKm * Math.sin(angle)) / kmPerLat,
          lng0 + (radiusKm * Math.cos(angle)) / kmPerLng
        ]);
      }
    } else {
      // If the circle was not clipped by any border of Israel, it remains an exact 72-gon
      // where every edge midpoint is at distance ~ R * cos(pi/72) = 0.99905 * R from center.
      const expectedMinDist = radiusKm * 0.995;
      let hitBorder = clipped.length !== 72;
      if (!hitBorder) {
        for (let i = 0; i < clipped.length; i++) {
          const a = clipped[i];
          const b = clipped[(i + 1) % clipped.length];
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          if (Math.hypot(mx, my) < expectedMinDist) {
            hitBorder = true;
            break;
          }
        }
      }
      setIsClippedByBorder(hitBorder);
    }

    // Remove previous layers
    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
    }
    if (unclippedLayerRef.current) {
      unclippedLayerRef.current.remove();
    }
    if (markerLayerRef.current) {
      markerLayerRef.current.remove();
    }

    // Subtle dashed ghost circle showing where the raw radius would be if clipped
    const ghostCircle = L.circle([lat0, lng0], {
      radius: radiusKm * 1000,
      color: '#94a3b8',
      weight: 1,
      dashArray: '4 6',
      fill: false,
      interactive: false
    }).addTo(map);
    unclippedLayerRef.current = ghostCircle;

    // Clipped active broadcast region inside Israel's borders
    const poly = L.polygon(latLngs, {
      color: '#4f46e5',
      weight: 2.5,
      fillColor: '#6366f1',
      fillOpacity: 0.28,
      interactive: false
    }).addTo(map);
    polygonLayerRef.current = poly;

    // Center marker for the user
    const marker = L.circleMarker([lat0, lng0], {
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: '#4f46e5',
      fillOpacity: 1
    }).addTo(map);
    markerLayerRef.current = marker;

    // Smoothly fit bounds so the user can clearly appreciate the distance
    const bounds = poly.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14, animate: true });
    }
  }, [radiusKm, userPos]);

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div
        style={{
          position: 'relative',
          height: '230px',
          width: '100%',
          borderRadius: '14px',
          overflow: 'hidden',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)'
        }}
      >
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', direction: 'ltr' }} />

        {/* Overlay pill showing radius & border clipping status */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 500,
            background: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(6px)',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            pointerEvents: 'none',
            border: '1px solid rgba(255,255,255,0.15)'
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isClippedByBorder ? '#10b981' : '#818cf8'
            }}
          />
          <span>
            {locating
              ? 'מאתר מיקום...'
              : isClippedByBorder
              ? `רדיוס ${radiusKm} ק״מ (מותאם לגבולות המדינה)`
              : `רדיוס פרסום: ${radiusKm} ק״מ סביבך`}
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.76rem',
          color: 'var(--text-secondary)',
          marginTop: '0.4rem',
          padding: '0 0.2rem'
        }}
      >
        <span>💡 ניתן ללחוץ על המפה לשינוי נקודת המרכז</span>
        {isClippedByBorder && (
          <span style={{ color: 'var(--secondary-color)', fontWeight: 500 }}>
            ✓ הסימון מוגבל לשטח המדינה בלבד
          </span>
        )}
      </div>
    </div>
  );
}
