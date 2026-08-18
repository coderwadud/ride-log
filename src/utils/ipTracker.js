import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

let hasTrackedSession = false;

export async function trackUserIpAndActivity(uid, additionalData = {}) {
  if (!uid || hasTrackedSession) return;
  hasTrackedSession = true;

  try {
    // Fetch public IP and rough geolocation safely
    let ip = 'Unknown IP';
    let city = 'Bangladesh';
    let isp = 'Mobile / Broadband';

    try {
      const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        ip = data.ip || ip;
        city = data.city || data.region || city;
        isp = data.org || data.isp || isp;
      }
    } catch (e) {
      try {
        const fallbackRes = await fetch('https://api.ipify.org?format=json');
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          ip = fallbackData.ip || ip;
        }
      } catch (err) {}
    }

    const userRef = doc(db, 'users', uid);
    const payload = {
      lastIpAddress: ip,
      ipCity: city,
      ipIsp: isp,
      lastActiveAt: new Date().toISOString(),
      platform: navigator.userAgent.includes('Mobile') ? 'Mobile App / Web' : 'Desktop Browser',
      ...additionalData
    };

    await setDoc(userRef, payload, { merge: true });
  } catch (error) {
    console.warn('IP telemetry silent catch:', error);
  }
}
