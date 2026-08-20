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

  // 1. Reject very low accuracy fixes (accuracy > 65m)
  if (candidatePoint.accuracy && candidatePoint.accuracy > 65) {
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

  // 2. Reject impossible speed spikes / GPS teleportation (> 180 km/h jump)
  if (calculatedSpeedKmH > 180 && distMeters > 80) {
    return { accept: false, reason: 'speed_spike' };
  }

  // 3. Stationary Deadband Filter:
  // If user is sitting still or moving < 2.5 meters with speed <= 1 km/h, ignore stationary noise
  const currentSpeed = candidatePoint.speed || 0;
  if (distMeters < 2.5 && currentSpeed <= 1.0) {
    return { accept: false, reason: 'stationary_jitter' };
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
 * Decode Polyline6 string format (used by Valhalla / Mapbox)
 */
export function decodePolyline6(str) {
  if (!str) return [];
  let index = 0,
    lat = 0,
    lng = 0,
    coordinates = [],
    shift = 0,
    result = 0,
    byte = null,
    latitude_change,
    longitude_change,
    factor = Math.pow(10, 6);

  while (index < str.length) {
    byte = null;
    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude_change = (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude_change = (result & 1) ? ~(result >> 1) : (result >> 1);

    lat += latitude_change;
    lng += longitude_change;

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
}

/**
 * Snap GPS trace coordinates to real OpenStreetMap roads using:
 * 1. OSRM Match API (dense GPS points)
 * 2. OSRM Driving Route API (sparse / screen-off GPS waypoints)
 * 3. Valhalla OpenStreetMap Motorcycle Routing API (fallback)
 * 4. Local RDP + Moving Average Filter (offline fallback)
 */
export function snapToRoadsOSRM(points) {
  return new Promise(async (resolve) => {
    if (!points || points.length < 2) {
      resolve(points || []);
      return;
    }

    // Limit chunk size for OSRM URL length (max ~80 coordinates per request)
    let processedPoints = points;
    const MAX_CHUNK = 80;
    if (processedPoints.length > MAX_CHUNK) {
      processedPoints = simplifyPathRDP(processedPoints, 0.00004);
    }

    const coordString = processedPoints.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');

    // 1. If points are dense (>= 8 points), try OSRM Match API first
    if (processedPoints.length >= 8) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const matchUrl = `https://router.project-osrm.org/match/v1/driving/${coordString}?overview=full&geometries=geojson`;

        const response = await fetch(matchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.code === 'Ok' && data.matchings && data.matchings.length > 0) {
            const matchedCoords = data.matchings[0].geometry.coordinates; // [[lng, lat], ...]
            if (matchedCoords && matchedCoords.length > 0) {
              const roadPoints = matchedCoords.map((coord, idx) => {
                const orig = processedPoints[Math.min(idx, processedPoints.length - 1)] || processedPoints[0];
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
        }
      } catch (e) {
        console.debug('OSRM Match API attempt failed, switching to Route API:', e?.message);
      }
    }

    // 2. If points are sparse (e.g. 2-7 points recorded during screen off) or Match API failed:
    // Call OSRM Route API to find the exact road path following street turns between waypoints!
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const routeUrl = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

      const response = await fetch(routeUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const routeCoords = data.routes[0].geometry.coordinates; // [[lng, lat], ...]
          if (routeCoords && routeCoords.length > 0) {
            const roadPoints = routeCoords.map((coord, idx) => {
              const orig = processedPoints[Math.min(idx, processedPoints.length - 1)] || processedPoints[0];
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
      }
    } catch (e) {
      console.debug('OSRM Route API attempt failed, trying Valhalla engine:', e?.message);
    }

    // 3. Fallback: Valhalla OpenStreetMap Motorcycle Routing Engine
    try {
      const valhallaLocations = processedPoints.map((p) => ({
        lat: +p.lat.toFixed(6),
        lon: +p.lng.toFixed(6)
      }));

      const body = {
        locations: valhallaLocations,
        costing: 'motorcycle',
        directions_options: { units: 'kilometers' }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const valhallaUrl = `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(body))}`;

      const response = await fetch(valhallaUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const legShape = data?.trip?.legs?.[0]?.shape;
        if (legShape) {
          const decodedCoords = decodePolyline6(legShape);
          if (decodedCoords && decodedCoords.length > 0) {
            const roadPoints = decodedCoords.map((coord, idx) => {
              const orig = processedPoints[Math.min(idx, processedPoints.length - 1)] || processedPoints[0];
              return {
                lat: +coord[0].toFixed(6),
                lng: +coord[1].toFixed(6),
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
      }
    } catch (e) {
      console.debug('Valhalla routing attempt failed, fallback to local smoothing:', e?.message);
    }

    // 4. Final Fallback: Local RDP simplification + moving average filter (100% Offline)
    const simplified = simplifyPathRDP(points, 0.000025);
    const smoothed = smoothPathMovingAverage(simplified);
    resolve(smoothed);
  });
}

/**
 * Fetch nearby Petrol Pumps (fuel stations) or Motorcycle Garages/Repair Shops
 * using 100% Free OpenStreetMap Overpass API & Nominatim Fallback
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @param {'fuel' | 'garage'} type Search type
 * @param {number} radiusMeters Search radius in meters (default 6000 = 6km)
 */
export async function fetchNearbyPumpsAndGarages(lat, lng, type = 'fuel', radiusMeters = 6000) {
  if (!lat || !lng) return [];

  let queryFilter = '';
  if (type === 'fuel') {
    queryFilter = `
      nwr["amenity"="fuel"](around:${radiusMeters},${lat},${lng});
    `;
  } else {
    queryFilter = `
      nwr["shop"="motorcycle"](around:${radiusMeters},${lat},${lng});
      nwr["craft"="motorcycle_repair"](around:${radiusMeters},${lat},${lng});
      nwr["shop"="car_repair"](around:${radiusMeters},${lat},${lng});
      nwr["amenity"="motorcycle_repair"](around:${radiusMeters},${lat},${lng});
      nwr["amenity"="car_wash"](around:${radiusMeters},${lat},${lng});
    `;
  }

  const query = `[out:json][timeout:15];(${queryFilter});out center 40;`;
  const overpassEndpoints = [
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://overpass.khtml.disroot.org/api/interpreter?data=${encodeURIComponent(query)}`
  ];

  for (const url of overpassEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const elements = data.elements || [];

        const results = elements
          .map((item) => {
            const itemLat = item.lat || item.center?.lat;
            const itemLng = item.lon || item.center?.lon;
            if (!itemLat || !itemLng) return null;

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
          })
          .filter(Boolean);

        if (results.length > 0) {
          results.sort((a, b) => a.distanceKm - b.distanceKm);
          return results;
        }
      }
    } catch (e) {
      console.warn(`Overpass endpoint fetch attempt failed:`, e);
    }
  }

  // 🛡️ Nominatim API Fallback if Overpass yielded 0 nodes
  try {
    const searchTerm = type === 'fuel' ? 'fuel pump' : 'motorcycle repair';
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&lat=${lat}&lon=${lng}&limit=15`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(nominatimUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const items = await response.json();
      const results = items.map((item) => {
        const itemLat = parseFloat(item.lat);
        const itemLng = parseFloat(item.lon);
        const distKm = calculateDistanceKm(lat, lng, itemLat, itemLng);
        return {
          id: item.place_id || `nom_${Math.random()}`,
          name: item.display_name?.split(',')[0] || (type === 'fuel' ? 'ফুয়েল পাম্প' : 'গ্যারেজ'),
          type,
          lat: itemLat,
          lng: itemLng,
          distanceKm: +distKm.toFixed(2),
          brand: '',
          openingHours: ''
        };
      });

      results.sort((a, b) => a.distanceKm - b.distanceKm);
      return results;
    }
  } catch (e) {
    console.warn('Nominatim fallback fetch error:', e);
  }

  return [];
}


