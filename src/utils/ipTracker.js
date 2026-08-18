import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

let hasTrackedSession = false;

export async function trackUserIpAndActivity(uid, additionalData = {}) {
  if (!uid || hasTrackedSession) return;
  hasTrackedSession = true;

  try {
    let ip = 'Unknown IP';
    let city = 'Dhaka';
    let region = 'Dhaka Division';
    let country = 'Bangladesh';
    let fullAddress = 'Dhaka, Bangladesh';
    let isp = 'Mobile / Broadband';
    let lat = null;
    let lon = null;

    // 1. Try ipwho.is (rich, free, accurate city/district/ISP)
    try {
      const res = await fetch('https://ipwho.is/', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success !== false) {
          ip = data.ip || ip;
          city = data.city || city;
          region = data.region || region;
          country = data.country || country;
          fullAddress = `${city}, ${region}, ${country}`;
          isp = data.connection?.isp || data.connection?.org || isp;
          lat = data.latitude || null;
          lon = data.longitude || null;
        }
      }
    } catch (e) {
      // 2. Fallback to ipapi.co
      try {
        const res2 = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
        if (res2.ok) {
          const data2 = await res2.json();
          ip = data2.ip || ip;
          city = data2.city || city;
          region = data2.region || region;
          country = data2.country_name || country;
          fullAddress = `${city}, ${region}, ${country}`;
          isp = data2.org || data2.isp || isp;
          lat = data2.latitude || null;
          lon = data2.longitude || null;
        }
      } catch (err) {}
    }

    const userRef = doc(db, 'users', uid);
    const payload = {
      lastIpAddress: ip,
      ipCity: city,
      ipRegion: region,
      ipCountry: country,
      fullAddress: fullAddress,
      ipIsp: isp,
      locationCoords: lat && lon ? { lat, lon } : null,
      lastActiveAt: new Date().toISOString(),
      platform: navigator.userAgent.includes('Mobile') ? 'Mobile App / Web' : 'Desktop Browser',
      ...additionalData
    };

    await setDoc(userRef, payload, { merge: true });
  } catch (error) {
    console.warn('IP & full address telemetry silent catch:', error);
  }
}
