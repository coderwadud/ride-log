# 📱 RideLog BD — Smart Motorcycle Mileage & Maintenance Tracker (v1.4.1)

![RideLog BD Logo](/src/assets/dark-mode-logo.png)

> **React 19 • Vite • Capacitor 8 • Leaflet • OpenStreetMap Overpass API • OSRM • Firebase Firestore • Android Native & PWA**

---

## 🏍️ Overview

**RideLog BD** is the ultimate motorcycle companion app built specifically for Bangladeshi riders. It enables bikers to track fuel consumption, calculate real-time mileage (km/L), monitor engine oil health, log maintenance & repairs, safely store bike registration documents, track GPS rides in the background, and instantly discover nearby fuel pumps and repair garages with turn-by-turn navigation.

---

## ✨ Comprehensive Key Features

* 🛰️ **Background GPS Ride Tracker:** Real-time distance, speed, duration, and heading rotation tracking with Android Foreground Service & Screen WakeLock. Keeps tracking seamlessly even when the app is backgrounded or the phone screen is locked!
* 🛡️ **Zero Jitter & Stationary Drift Engine:** Advanced noise filtering and deadband detection that eliminates random GPS drift and messy polylines when stationary.
* 🛣️ **OSRM Snap-to-Roads & Path Smoothing:** Snaps recorded ride coordinates cleanly onto real OpenStreetMap road geometries for polished route rendering.
* 📌 **Start & Finish Pin Markers:** Visual green 'Start' pin badge at ride launch and red 'Finish' pin badge at destination.
* 🗺️ **Interactive Petrol Pump & Garage Finder:** 100% free search engine powered by OpenStreetMap Overpass API & Nominatim. Instantly locates fuel stations and motorcycle repair shops within a 6 km radius with 1-click Google Maps turn-by-turn navigation!
* 📼 **3-Day Animated Route Playback:** Interactive trip history replay from the last 3 days with variable animation speeds (1x, 2x, 4x, 8x), live speed telemetry, and full route inspection.
* ⚡ **Persistent Session Auto-Recovery:** Continuous local state persistence ensuring active ride sessions are automatically recovered even if the app process is killed or the device restarts.
* ⛽ **Fuel Efficiency & Mileage Calculator:** Automatically calculates accurate mileage (km/L), cost per kilometer, and refilling stats from full-tank refills.
* 🔧 **Engine Oil & Service Monitor:** Live oil health percentage indicator, maintenance schedule reminders, and detailed repair cost breakdowns.
* 📑 **Digital Document Vault:** Safely store and view bike registration certificates, insurance, tax tokens, and driving licenses with fast offline access.
* 🌐 **Live Telemetry & Geo-Sync:** Automated district synchronization, multi-bike switching, and real-time cloud sync powered by Google Firebase.
* 📊 **Smart Charts & Export:** Interactive monthly fuel and maintenance expense analytics with 1-click Excel, CSV, and PDF report downloads.

---

## 🛠️ Tech Stack & Architecture

* **Frontend:** React 19, Vite (Rolldown bundler), Leaflet JS, Tailwind CSS, Lucide-React
* **Geo & Mapping:** OpenStreetMap Tile Servers, Overpass API, Nominatim Geocoding, OSRM Match API
* **Mobile Runtime:** Capacitor 8 (Android Native plugins for Geolocation, Foreground Service, Push Notifications, Storage, and Share)
* **Backend & Auth:** Google Firebase (Firestore Database, Firebase Authentication, Cloud Storage)
* **CI/CD:** GitHub Actions automated APK build & Release publisher (`v1.4.1`)

---

## 📲 Build & Run Locally

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Build production bundle
npm run build

# Sync native Android project
npx cap sync android

# Open in Android Studio
npx cap open android
```

---

Developed with ❤️ by **Md. Abdul Wadud** for bikers across Bangladesh. 🇧🇩
