/**
 * GPS Tracking Utilities for RideLog BD
 * Includes GPS noise/jitter filtering, stationary deadband detection,
 * path smoothing (RDP + Moving Average), OSRM road snapping, and bearing calculation.
 */
import { calculateDistanceKm } from './tripStorage';

/**
 * Calculate bearing/heading in degrees (0 - 360) between two coordinates
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Filter raw incoming GPS point against stationary jitter and inaccurate noise
 * @param {Array} currentPoints Array of already accepted point objects [{lat, lng, speed, accuracy, timestamp}]
 * @param {Object} candidatePoint New candidate GPS point object
 * @returns {Object} { accept: boolean, reason: string }
 */
export function filterGpsJitter(currentPoints, candidatePoint) {
  if (!candidatePoint || typeof candidatePoint.lat !== 'number' || typeof candidatePoint.lng !== 'number') {
    return { accept: false, reason: 'invalid_coords' };
  }

  // 1. Reject very low accuracy fixes (accuracy > 35m)
  if (candidatePoint.accuracy && candidatePoint.accuracy > 35) {
    return { accept: false, reason: 'low_accuracy' };
  }

  if (!currentPoints || currentPoints.length === 0) {
    return { accept: true, reason: 'first_point' };
  }

  const lastPoint = currentPoints[currentPoints.length - 1];
  const distKm = calculateDistanceKm(lastPoint.lat, lastPoint.lng, candidatePoint.lat, candidatePoint.lng);
  const distMeters = distKm * 1000;
  const timeDiffSec = Math.max(0.5, (candidatePoint.timestamp - (lastPoint.timestamp || Date.now())) / 1000);
  const calculatedSpeedKmH = (distKm / (timeDiffSec / 3600));

  // 2. Reject impossible speed spikes / GPS teleportation (> 160 km/h jump)
  if (calculatedSpeedKmH > 160 && distMeters > 50) {
    return { accept: false, reason: 'speed_spike' };
  }

  // 3. Stationary Deadband Filter:
  // If user is sitting still or moving < 6 meters with speed <= 2 km/h, ignore jitter point
  const currentSpeed = candidatePoint.speed || 0;
  if (distMeters < 6 && currentSpeed <= 2.5) {
    return { accept: false, reason: 'stationary_jitter' };
  }

  // If distMeters is very tiny (< 4 meters), ignore unless moving fast
  if (distMeters < 4 && currentSpeed <= 5) {
    return { accept: false, reason: 'micro_jitter' };
  }

  return { accept: true, reason: 'valid_movement' };
}

/**
 * Apply weighted moving average to smooth sharp GPS jitter along a route
 */
export function smoothPathMovingAverage(points) {
  if (!points || points.length < 3) return points;

  const smoothed = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const smoothLat = 0.25 * prev.lat + 0.5 * curr.lat + 0.25 * next.lat;
    const smoothLng = 0.25 * prev.lng + 0.5 * curr.lng + 0.25 * next.lng;

    smoothed.push({
      ...curr,
      lat: +smoothLat.toFixed(6),
      lng: +smoothLng.toFixed(6)
    });
  }

  smoothed.push(points[points.length - 1]);
  return smoothed;
}

/**
 * Ramer-Douglas-Peucker (RDP) path simplification to eliminate collinear/redundant jitter
 */
export function simplifyPathRDP(points, epsilon = 0.00003) {
  if (!points || points.length <= 2) return points;

  const getSqDist = (p1, p2) => {
    const dx = p1.lng - p2.lng;
    const dy = p1.lat - p2.lat;
    return dx * dx + dy * dy;
  };

  const getSqSegDist = (p, p1, p2) => {
    let x = p1.lng;
    let y = p1.lat;
    let dx = p2.lng - x;
    let dy = p2.lat - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((p.lng - x) * dx + (p.lat - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2.lng;
        y = p2.lat;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    dx = p.lng - x;
    dy = p.lat - y;
    return dx * dx + dy * dy;
  };

  const rdpStep = (pts, sqEpsilon) => {
    const maxIdx = pts.length - 1;
    let maxSqDist = 0;
    let index = 0;

    for (let i = 1; i < maxIdx; i++) {
      const sqDist = getSqSegDist(pts[i], pts[0], pts[maxIdx]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqEpsilon) {
      const recResults1 = rdpStep(pts.slice(0, index + 1), sqEpsilon);
      const recResults2 = rdpStep(pts.slice(index), sqEpsilon);
      return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    }
    return [pts[0], pts[maxIdx]];
  };

  return rdpStep(points, epsilon * epsilon);
}

/**
 * Snap GPS trace coordinates to real OpenStreetMap roads using OSRM Match API
 * Falls back gracefully to local RDP + Moving Average if offline or request fails.
 */
export function snapToRoadsOSRM(points) {
  return new Promise(async (resolve) => {
    if (!points || points.length < 2) {
      resolve(points);
      return;
    }

    // Limit chunk size for OSRM URL length (max ~80 coordinates per request)
    const MAX_CHUNK = 80;
    if (points.length > MAX_CHUNK) {
      // Downsample points first using RDP for large trips
      points = simplifyPathRDP(points, 0.00004);
    }

    // Prepare coordinates string: "lng,lat;lng,lat;..."
    const coordString = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/match/v1/biking/${coordString}?overview=full&geometries=geojson`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.code === 'Ok' && data.matchings && data.matchings.length > 0) {
          // Extract road-matched coordinates from GeoJSON
          const matchedCoords = data.matchings[0].geometry.coordinates; // [[lng, lat], ...]
          const roadPoints = matchedCoords.map((coord, idx) => {
            const orig = points[Math.min(idx, points.length - 1)] || points[0];
            return {
              lat: +coord[1].toFixed(6),
              lng: +coord[0].toFixed(6),
              speed: orig.speed || 0,
              accuracy: 5,
              altitude: orig.altitude || 0,
              timestamp: orig.timestamp || Date.now()
            };
          });
          resolve(roadPoints);
          return;
        }
      }
    } catch (e) {
      console.warn('OSRM Match API unavailable, fallback to local path smoothing:', e);
    }

    // Fallback: Local RDP simplification + moving average filter
    const simplified = simplifyPathRDP(points, 0.000025);
    const smoothed = smoothPathMovingAverage(simplified);
    resolve(smoothed);
  });
}

/**
 * Fetch nearby Petrol Pumps (fuel stations) or Motorcycle Garages/Repair Shops
 * using 100% Free OpenStreetMap Overpass API
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @param {'fuel' | 'garage'} type Search type
 * @param {number} radiusMeters Search radius in meters (default 4000 = 4km)
 */
export async function fetchNearbyPumpsAndGarages(lat, lng, type = 'fuel', radiusMeters = 4000) {
  if (!lat || !lng) return [];

  let queryFilter = '';
  if (type === 'fuel') {
    queryFilter = `node["amenity"="fuel"](around:${radiusMeters},${lat},${lng});`;
  } else {
    queryFilter = `
      node["shop"="motorcycle"](around:${radiusMeters},${lat},${lng});
      node["craft"="motorcycle_repair"](around:${radiusMeters},${lat},${lng});
      node["shop"="car_repair"](around:${radiusMeters},${lat},${lng});
      node["amenity"="motorcycle_repair"](around:${radiusMeters},${lat},${lng});
    `;
  }

  const query = `[out:json][timeout:12];(${queryFilter});out body 25;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const elements = data.elements || [];

      const results = elements
        .filter((item) => item.lat && item.lon)
        .map((item) => {
          const itemLat = item.lat;
          const itemLng = item.lon;
          const distKm = calculateDistanceKm(lat, lng, itemLat, itemLng);
          const name =
            item.tags?.name ||
            item.tags?.['name:bn'] ||
            item.tags?.brand ||
            (type === 'fuel' ? 'পেট্রোল / ফুয়েল পাম্প' : 'বাইক গ্যারেজ & সার্ভিস সেন্টার');

          return {
            id: item.id || `poi_${Math.random()}`,
            name,
            type,
            lat: itemLat,
            lng: itemLng,
            distanceKm: +distKm.toFixed(2),
            brand: item.tags?.brand || '',
            openingHours: item.tags?.opening_hours || ''
          };
        });

      // Sort closest first
      results.sort((a, b) => a.distanceKm - b.distanceKm);
      return results;
    }
  } catch (e) {
    console.warn(`Overpass API fetch warning for ${type}:`, e);
  }

  return [];
}

