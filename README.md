# 📱 RideLog BD — Smart Motorcycle Mileage & Maintenance Tracker

![RideLog BD Logo](/src/assets/dark-mode-logo.png)

> **React 19 • Vite • Capacitor 8 • Firebase Firestore • Background GPS Engine • PWA & Android Native**

---

## 🏍️ Overview

**RideLog BD** is the ultimate motorcycle companion app built specifically for Bangladeshi bikers. It enables riders to track fuel consumption, calculate real-time mileage (km/L), monitor engine oil health, log maintenance & repairs, safely store bike registration documents, and track GPS rides in the background.

---

## ✨ Key Features

* 🛰️ **Background GPS Ride Tracker:** Real-time distance, speed, and duration tracking with Android Foreground Service & Screen WakeLock. Keeps tracking even when the app is backgrounded or screen is turned off!
* ⛽ **Fuel Efficiency & Mileage Calculator:** Automatically calculates accurate mileage (km/L) and cost per kilometer from full-tank refills.
* 🔧 **Engine Oil & Service Monitor:** Live oil health percentage calculator, service schedule reminders, and cost breakdown.
* 📑 **Digital Document Vault:** Store and view bike registration, insurance, tax token, and driving license with fast offline access.
* 🗺️ **Petrol Pump & Garage Finder:** Nearby verified petrol stations, octane pumps, and trusted motorcycle repair shops across Bangladesh.
* 🌐 **Live Telemetry & Geo-Sync:** Automated IP geolocation, district synchronization, and real-time cloud backup via Firebase.
* 📊 **Smart Charts & Export:** Interactive monthly fuel expense charts with 1-click Excel, CSV, and PDF exports.

---

## 🛠️ Tech Stack & Architecture

* **Frontend:** React 19, Vite (Rolldown engine), Tailwind CSS, Lucide-React
* **Mobile Runtime:** Capacitor 8 (Android Native plugins for Geolocation, Foreground Service, Push Notifications, Storage, and Share)
* **Backend & Auth:** Google Firebase (Firestore, Authentication, Storage)
* **CI/CD:** GitHub Actions automated APK build & Release publisher

---

## 📲 Build APK Locally

```bash
# Install dependencies
npm install

# Build web assets
npm run build

# Sync native Android project
npx cap sync android

# Open in Android Studio
npx cap open android
```

---

Developed with ❤️ by **Md. Abdul Wadud** for riders across Bangladesh.
