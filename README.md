# 🏍️ RideLog BD — Smart Motorcycle Mileage, GPS Ride & Maintenance Tracker (v1.6.2)

![RideLog BD Logo](/src/assets/dark-mode-logo.png)

[![App Version](https://img.shields.io/badge/version-1.6.2-emerald.svg)](https://github.com/coderwadud/ride-log/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web%20PWA-blue.svg)](https://github.com/coderwadud/ride-log)
[![Framework](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Mobile Runtime](https://img.shields.io/badge/Capacitor-8-indigo.svg)](https://capacitorjs.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 🌟 Overview

**RideLog BD** is the ultimate, feature-packed motorcycle companion app built specifically for Bangladeshi bikers and motorcycling enthusiasts. It enables riders to track fuel consumption, calculate real-time fuel efficiency (km/L), monitor engine oil health, log maintenance & repairs, safely store bike registration documents, track GPS rides in the background, discover nearby petrol pumps and garages, and receive real-time admin announcements and live support ticket resolutions.

---

## 🚀 Comprehensive Feature Breakdown

### 🛰️ 1. Background GPS Ride Tracker & Navigation
* **Continuous Background Tracking:** Real-time distance, speed, duration, and heading rotation tracking powered by Android Foreground Service & Screen WakeLock. Keeps recording your route seamlessly even when the app is backgrounded or the phone screen is locked!
* **Zero-Jitter Stationary Drift Filter:** Advanced noise filtering and deadband detection that eliminates random GPS jitter and messy polylines when stopped at traffic lights or parked.
* **OSRM Snap-to-Roads & Geometry Smoothing:** Snaps recorded GPS coordinates cleanly onto real OpenStreetMap road geometries for smooth, high-precision route rendering.
* **Start & Finish Waypoint Markers:** Visual green 'Start' pin badge at ride launch location and red 'Finish' pin badge at destination.

---

### 🗺️ 2. 3-Day Animated Route Playback & Trip History
* **Interactive Trip Replay:** Replay recorded ride routes from the last 3 days with variable animation playback speeds (1x, 2x, 4x, 8x).
* **Live Speed Telemetry Gauge:** Inspect speed changes, trip duration, total distance, and full route details step-by-step.

---

### ⛽ 3. Fuel Refill & Efficiency Calculator (km/L)
* **Automated Mileage Engine:** Calculates accurate mileage (km/L), cost per kilometer, and refilling stats from full-tank refills.
* **Fuel Expense Logs:** Keep detailed history of every petrol refill, price per liter, total cost, and station location.
* **Log Filters & Search:** Instantly filter logs by custom date ranges or search terms.

---

### 🛠️ 4. Engine Oil Health & Service Log Monitor
* **Live Oil Health Gauge:** Dynamic percentage indicator based on distance driven since the last oil change.
* **Maintenance Schedule Alerts:** Automatic warnings when engine oil change or routine servicing is due (e.g. 2,000 km threshold).
* **Detailed Maintenance Logs:** Track spare parts cost, labor cost, garage name, and full repair descriptions.

---

### 📍 5. Interactive Petrol Pump & Garage Finder
* **Free OpenStreetMap Overpass Search Engine:** Instantly locate fuel stations and motorcycle repair workshops within a 6 km radius.
* **1-Click Google Maps Turn-by-Turn Navigation:** Tap any discovered station or garage marker to launch turn-by-turn navigation in Google Maps.

---

### 📁 6. Digital Vehicle Document Vault
* **Document Locker:** Safely store digital copies of bike Registration Certificate, Tax Token, Fitness Certificate, Insurance, and Driving License.
* **Fast Offline Access:** Instant image preview and full-screen view for hassle-free presentation during highway checks.

---

### 📢 7. Remote In-App Campaign & Announcement Banner
* **Promotional Dialogues:** Receive live promotional banners, discount offers, and maintenance announcements dispatched from the Admin Suite.
* **Rich Image Rendering:** High-resolution banner image rendering with fallback image handling and deep-link action CTA buttons.
* **Smart Snooze Memory:** Dismissed campaign dialogs remember user preferences so popups never annoy riders.

---

### ⚡ 8. OTA Remote Version Control & Force Update Prompt
* **Instant Version Invalidation:** Real-time Firestore listener checks installed version against latest release code using numeric `versionCode` comparison.
* **Mandatory Force Update:** Unbypassable update prompt for critical security releases with direct APK download link.

---

### 💬 9. Bilingual Support Desk & Live Ticket Resolution
* **In-App Ticket System:** Submit support inquiries, bug reports, or feature requests directly to the engineering team.
* **Real-Time Admin Reply Alert:** Receive instant notifications when an admin replies to your support ticket.
* **Bilingual UI (Bangla / English):** Complete language toggle support across the entire interface.

---

### 🏍️ 10. Multi-Bike Profile Switcher & Cloud Sync
* **Multi-Bike Management:** Manage multiple motorcycles per rider profile (e.g., Hornet 2.0, R15, Pulsar).
* **Firebase Cloud Sync:** Real-time data sync across all your Android devices and Web browser logins.
* **Smart Expense Reports:** Export fuel and maintenance records to Excel, CSV, and formatted PDF reports.

---

## 🛠️ Technology Stack & Architecture

* **Frontend Framework:** React 19, Vite 8 (Rolldown bundler), Tailwind CSS, Lucide Icons
* **Mapping & GIS:** Leaflet JS, OpenStreetMap Tile Servers, Overpass API, Nominatim Geocoding, OSRM Match API
* **Mobile Runtime:** Capacitor 8 (Android Native plugins for Geolocation, Foreground Service, Push Notifications, Storage, and Share)
* **Backend & Cloud:** Google Firebase (Firestore Database, Firebase Authentication, Cloud Storage)
* **Build Pipeline:** GitHub Actions automated Android APK build & Release publisher (`build-apk.yml`)

---

## 💻 Building & Running Locally

```bash
# 1. Clone the repository
git clone https://github.com/coderwadud/ride-log.git
cd ride-log

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev

# 4. Build web production bundle
npm run build

# 5. Sync native Android project
npx cap sync android

# 6. Open in Android Studio
npx cap open android
```

---

Developed with ❤️ by **Md. Abdul Wadud** for riders across Bangladesh 🇧🇩 🏍️
