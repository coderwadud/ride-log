# 🏍️ RideLog BD - Smart Motorcycle Fuel & Service Tracker

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-7.6-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-11.10-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Web-green)](https://github.com/coderwadud/ride-log/releases)

**RideLog BD** is a modern, high-performance, offline-capable motorcycle mileage, fuel efficiency, and service history tracking application available as both a **Native Android Mobile App** and a **Web Application**.

Specifically engineered for motorcycle enthusiasts and daily riders in Bangladesh and worldwide, it provides accurate mileage math ($\text{Km/L}$), cost per kilometer ($\text{৳/Km}$), engine oil health percentage indicators, multi-bike management, and real-time cloud data synchronization.

---

## 🌟 Key Features

### ⛽ 1. Fuel & Mileage Analytics
- **Precise Mileage ($\text{Km/L}$)**: Calculates accurate fuel consumption based on odometer readings between full-tank refills.
- **Running Cost ($\text{৳/Km}$)**: Calculates exact operational expense per kilometer driven.
- **Detailed Fuel Logs**: Keep track of liters purchased, fuel unit prices ($\text{৳/L}$), total expense, and odometer history.

### 🛠️ 2. Service & Maintenance History
- **Engine Oil Health Bar**: Visual progress indicator showing remaining oil lifespan ($\text{Km}$) and percentage health before the next oil change.
- **Maintenance Categories**: Track expenses across key components — Engine Oil, Oil Filter, Air Filter, Spark Plug, Brake Shoes/Pads, Chain Lube, Tires, and General Service.
- **Mechanics & Parts Cost Breakdown**: Record mechanics labor fees, spare parts cost, service center name, and maintenance notes.

### 🏍️ 3. Multi-Bike Profile Management
- **Multiple Bike Cards**: Add and manage multiple bikes under a single user account.
- **Custom Bike Specs**: Set custom initial odometers, registration numbers, bike names, and target engine oil change intervals (e.g. 1000 km, 1500 km, 2000 km).

### ☁️ 4. Google Authentication & Firebase Cloud Sync
- **One-Tap Google Sign-In**: Native Android bottom-sheet login on mobile devices and Google Auth popup on Web.
- **Firestore Cloud Database**: User data is securely synchronized and backed up to Firebase Firestore (`users/{uid}`).

### 📱 5. Platform-Tailored Storage Engine (Offline-First Android App)
- **Native Android Mobile App (APK)**: Features full **Offline-First** local caching (`localStorage`). Log fuel and service entries seamlessly while offline without network coverage. Automatic 2-way cloud merge uploads missing entries when internet reconnects.
- **Web Browser App**: Bypasses stale local cache and always fetches live fresh data directly from Firebase Firestore.

### 📦 6. Complete Data Backup & Restore
- **JSON Backup File**: Export all bike profiles, fuel logs, service history, and user preferences into a portable `.json` backup file.
- **Backup Code Copy/Paste**: Quickly copy or paste encrypted raw JSON backup strings to transfer data across devices.

### 🌐 7. Bilingual UI Support (English & Bengali)
- **Default Language**: English (`en`) interface out-of-the-box.
- **Instant Language Toggle**: 1-Click switch between **English** and **Bengali (বাংলা)** in the top header app bar. Automatically translates all UI text, digits, currency symbols, and date formats.

### 🎨 8. Premium Modern Dark & Light Aesthetics
- **Glassmorphic UI**: Vibrant gradient accent colors, sleek dark mode by default, floating action buttons (FAB), and smooth bottom-sheet modal dialogs.
- **Interactive Visual Charts**: Powered by Chart.js for tracking mileage performance trends and monthly expenditure breakdowns.

---

## 🛠️ Technology Stack

| Layer | Technology Used |
| :--- | :--- |
| **Frontend Framework** | React 19 + Vite 8 |
| **Native Mobile Framework** | Capacitor 7 (Android Platform) |
| **Authentication & Cloud DB** | Firebase Auth + Firebase Firestore |
| **Styling & Theme** | Custom Vanilla CSS (Design System, Dark/Light Mode) |
| **Icons & UI Components** | Lucide React |
| **Data Visualization** | Chart.js + React-ChartJS-2 |
| **CI/CD Build Automation** | GitHub Actions (`build-apk.yml`) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 1. Installation
Clone the repository and install project dependencies:
```bash
git clone https://github.com/coderwadud/ride-log.git
cd fuel-log
npm install
```

### 2. Run Local Development Server
Start the Vite development server:
```bash
npm run dev
```
Open your browser at `http://localhost:3000/`.

---

## 📱 Building Native Android APK

To build the native Android project locally or compile an APK:

```bash
# 1. Build web production bundle
npm run build

# 2. Sync web assets to Capacitor Android project
npx cap sync android

# 3. Open project in Android Studio (Optional)
npx cap open android
```

Or trigger an automated build by pushing commits to `main`. GitHub Actions will automatically generate and attach **`Ride-Log-BD.apk`** to the latest GitHub Release!

---

## 📁 Project Directory Structure

```text
fuel-log/
├── .github/workflows/
│   └── build-apk.yml          # GitHub Actions workflow for building Android APK
├── android/                   # Capacitor Native Android project files
├── public/
│   ├── favicon.svg            # App Brand Logo Icon
│   └── manifest.json          # PWA Web App Manifest
├── src/
│   ├── components/
│   │   ├── AnalyticsTab.jsx   # Chart.js visual graphs & stats
│   │   ├── BikeModal.jsx      # Bike profile management, backup & settings
│   │   ├── BikeSelector.jsx   # Custom dropdown bike selector
│   │   ├── Dashboard.jsx      # Summary cards, engine oil health bar
│   │   ├── FuelLogsTab.jsx    # Fuel log history & trip mileage
│   │   ├── FuelModal.jsx      # Fuel entry bottom sheet modal
│   │   ├── Header.jsx         # App header bar, language & theme toggles
│   │   ├── LoginScreen.jsx    # Google Auth login screen
│   │   ├── ServiceLogsTab.jsx # Maintenance history & parts cost
│   │   └── ServiceModal.jsx   # Service entry bottom sheet modal
│   ├── utils/
│   │   ├── calculations.js    # Mileage math and currency/number formatting
│   │   ├── firebase.js        # Firebase App & Auth initialization
│   │   ├── firestoreDB.js     # Platform-aware cloud sync & offline cache
│   │   ├── gdrive.js          # Google OAuth configuration
│   │   ├── storage.js         # Backup export/import utilities
│   │   └── translations.js    # English & Bengali language dictionary
│   ├── App.jsx                # Main application state manager
│   ├── index.css              # Custom mobile-first responsive design system
│   └── main.jsx               # React entry point
├── package.json
└── vite.config.js
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

Developed with ❤️ for Motorcycle Riders by **[Coder Wadud](https://github.com/coderwadud)**.
