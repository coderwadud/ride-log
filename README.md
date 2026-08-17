# 🏍️ RideLog BD - বাইক ফুয়েল, সার্ভিস ও ডকুমেন্ট ট্র্যাকার (v1.1.0)

**RideLog BD** একটি আধুনিক, শক্তিশালী এবং অ্যান্ড্রয়েড নেটিভ ও PWA সক্ষম মোবাইল অ্যাপ্লিকেশন, যা বিশেষভাবে মোটরসাইকেল ও গাড়ি মালিকদের জন্য তৈরি করা হয়েছে। এর মাধ্যমে বাইকের মাইলেজ (Km/L), জ্বালানি খরচ, সার্ভিসিং হিস্ট্রি, ইঞ্জিন অয়েল রিমাইন্ডার, ক্লাউড ব্যাকআপ, প্রাইভেট ডকুমেন্ট স্টোরেজ (মেয়াদ ট্র্যাকিং সহ) এবং পুশ নোটিফিকেশন খুব সহজে পরিচালনা করা যায়।

---

## 🌟 প্রধান ফিচারসমূহ (Key Features)

### ⛽ ১. মাইলেজ ও ফুয়েল ট্র্যাকার (Mileage & Fuel Tracker)
- **নির্ভুল মাইলেজ হিসাব (Km/L)**: ফুল ট্যাংক এবং পার্শিয়াল রিফিলের তথ্যের ভিত্তিতে বাইকের সঠিক মাইলেজ ক্যালকুলেশন।
- **খরচ বিশ্লেষণ**: কত লিটার তেল নেওয়া হলো, প্রতি লিটারের মূল্য এবং মোট খরচের রিয়েল-টাইম পরিসংখ্যান।
- **প্রতি কিমি খরচ (৳/Km)**: বাইক চালাতে প্রতি কিলোমিটারে কত খরচ হচ্ছে তা সরাসরি ট্র্যাকিং।

### 🛠️ ২. সার্ভিস ও ইঞ্জিন অয়েল এলার্ট (Service & Oil Health)
- **ইঞ্জিন অয়েল লাইফট্র্যাকার**: ইঞ্জিন অয়েল পরিবর্তনের কত কিমি বাকি আছে তা কালার-কোডেড প্রগ্রেস বারে প্রদর্শন।
- **সার্ভিস রেকর্ড**: মিস্ত্রির খরচ, স্পেয়ার পার্টসের দাম, সার্ভিস সেন্টারের নাম ও কাজের বিস্তারিত বিবরণ সংরক্ষণ।
- **ক্যাটাগরি ট্যাগস**: ইঞ্জিন অয়েল, অয়েল ফিল্টার, এয়ার ফিল্টার, স্পার্ক প্লাগ, ব্রেক শু, চেইন লুব ইত্যাদি ভিত্তিক আলাদা ট্র্যাকিং।

### 🔔 ৩. পুশ নোটিফিকেশন সিস্টেম (Firebase Cloud Messaging - FCM)
- **Firebase Console ক্যাম্পেইন**: অ্যাডমিন যেকোনো সময় Firebase Console থেকে সরাসরি সকল ইউজারের ফোনে ম্যানুয়ালি পুশ নোটিফিকেশন পাঠাতে পারবেন।
- **FCM Token Sync**: ইউজার লগইন করার সাথে সাথে তার ডিভাইসের ইউনিক টোকেন Firestore `users/{uid}/fcmToken`-এ সেভ হয়ে যায় (নির্দিষ্ট ইউজারকে নোটিফিকেশন পাঠানোর সুবিধার্থে)।
- **Android 13+ পারমিশন ও হাই-ইম্পরট্যান্স চ্যানেল**: নোটিফিকেশনে সাউন্ড ও ভাইব্রেশন নিশ্চিত করতে ডেডিকেটেড নোটিফিকেশন চ্যানেল।

### 📄 ৪. প্রাইভেট ডকুমেন্ট ভল্ট ও মেয়াদ ট্র্যাকিং (Document Storage & Expiry)
- **১০০% প্রাইভেট ইন্টারনাল স্টোরেজ**: ড্রাইভিং লাইসেন্স, রেজিস্ট্রেশন (স্মার্ট কার্ড), ট্যাক্স টোকেন, ফিটনেস ও ইন্স্যুরেন্সের ছবি বা PDF অ্যাপের নিজস্ব প্রাইভেট মেমোরিতে সুরক্ষিত থাকে (গ্যালারিতে প্রকাশ পায় না)।
- **মেয়াদ উত্তীর্ণের এলার্ট (Expiry Tracking)**:
  - 🔴 **মেয়াদ শেষ হলে:** `⚠️ মেয়াদ শেষ (X দিন আগে)` লাল এলার্ট।
  - 🟡 **মেয়াদ শেষ হতে ১৫ দিন বাকি থাকলে:** `⏳ মেয়াদ শেষ হবে X দিনে` হলুদ ওয়ার্নিং।
  - 🟢 **মেয়াদ ঠিক থাকলে:** `✓ মেয়াদ: YYYY-MM-DD` সবুজ ব্যাজ।
- **সরাসরি ডাউনলোড ও শেয়ার**: এক ক্লিকে যেকোনো ডকুমেন্ট ফোনে ডাউনলোড বা শেয়ার করার সুবিধা।

### 🚀 ৫. ইন-অ্যাপ আপডেট প্রম্পট (Remote In-App Update)
- **প্লে-স্টোর ছাড়াই সরাসরি আপডেট**: Firestore-এর `app_config/version` ডকুমেন্টে নতুন ভার্সন নাম্বার ও APK ডাউনলোড লিংক দিয়ে দিলেই মোবাইল ইউজারদের স্ক্রিনে **"🚀 নতুন আপডেট চলে এসেছে!"** পপ-আপ ভেসে উঠবে।
- **বাধ্যতামূলক/ঐচ্ছিক কন্ট্রোল**: `isMandatory: true/false` দিয়ে আপডেটটি বাধ্যতামূলক বা ঐচ্ছিক করা সম্ভব।
- **স্মার্ট ডিটেকশন**: এটি শুধুমাত্র অ্যান্ড্রয়েড মোবাইল অ্যাপে প্রদর্শিত হয়, ওয়েব ভার্সনে কোনো বিরক্তিকর পপ-আপ আসে না।

### 💡 ৬. সাপোর্ট ও ফিডব্যাক সিস্টেম (In-App Feedback & Bug Report)
- অ্যাপের ভেতর থেকেই ইউজাররা সরাসরি মতামত, বাগ রিপোর্ট বা নতুন ফিচারের অনুরোধ পাঠাতে পারেন।
- সমস্ত রিপোর্ট সরাসরি Firebase Firestore-এর `feedbacks` কালেকশনে রিয়েল-টাইমে জমা হয়।

### ☁️ ৭. ক্লাউড সিঙ্ক ও সিকিউর একাউন্ট (Firebase Auth & Firestore)
- **Google Sign-In & Email Login**: অ্যান্ড্রয়েডে নেটিভ গুগল সাইন-ইন বটমশিট সাপোর্ট।
- **মাল্টি-ডিভাইস সিঙ্ক**: একাউন্টে লগইন করলেই যেকোনো ডিভাইসে আপনার বাইকের ডাটা সিঙ্ক হয়ে যাবে।
- **JSON এক্সপোর্ট/ইমপোর্ট**: অফলাইনে সম্পূর্ণ ডাটা ব্যাকআপ ও রিস্টোর করার সুবিধা।

### 📊 ৮. গ্রাফিক্যাল অ্যানালিটিক্স (Visual Performance Charts)
- **মাইলেজ পারফরম্যান্স ট্রেন্ড (Line Chart)**: সময়ের সাথে বাইকের মাইলেজ কেমন চলছে তার গ্রাফ।
- **মাসিক ব্যয়ের হিসেব (Bar Chart)**: প্রতি মাসে ফুয়েল বনাম মেইনটেন্যান্স খরচের তুলনামূলক গ্রাফ।

### 🌐 ৯. দ্বিভাষিক ও থিম সাপোর্ট (Bilingual & Dark/Light Mode)
- **বাংলা ও ইংরেজি**: এক ক্লিকে সম্পূর্ণ অ্যাপের ভাষা পরিবর্তন।
- **ডার্ক ও লাইট মোড**: চোখের আরামদায়ক আধুনিক ডার্ক থিম ও লাইট থিম।

---

## 🛠️ টেকনোলজি স্ট্যাক (Tech Stack)

| কম্পোনেন্ট | ব্যবহৃত টেকনোলজি |
| :--- | :--- |
| **Frontend Framework** | React 19 + Vite |
| **Mobile Runtime** | Capacitor 7 (Android Native) |
| **Authentication** | Firebase Auth (`@capacitor-firebase/authentication` + Web SDK) |
| **Database & Cloud Sync** | Firebase Cloud Firestore |
| **Push Notifications** | Firebase Cloud Messaging (FCM) via `@capacitor/push-notifications` |
| **Local Private Storage** | `@capacitor/filesystem` + IndexedDB |
| **Icons & Charts** | Lucide React + Chart.js (React-Chartjs-2) |
| **Design System** | Vanilla CSS (Glassmorphism UI, Native Bottom Navigation, FABs) |

---

## 🚀 ডেভেলপমেন্ট ও রান করার নিয়ম (Getting Started)

### ১. ডিপেন্ডেন্সি ইনস্টল করুন:
```bash
npm install
```

### ২. ডেভেলপমেন্ট সার্ভার চালু করুন:
```bash
npm run dev
```

### ৩. অ্যান্ড্রয়েড প্রজেক্ট সিঙ্ক ও বিল্ড করুন:
```bash
npm run build
npx cap sync android
```

### ৪. Android Studio দিয়ে অ্যাপ রান করুন:
```bash
npx cap open android
```

---

## 📱 Firebase Firestore ডাটাবেস স্ট্রাকচার (Data Structure)

```text
Firestore Root
├── users/
│   └── {uid}/
│       ├── settings: { lang: 'bn', theme: 'dark' }
│       ├── activeBikeId: 'bike_1'
│       ├── bikes: [ { id, name, regNumber, targetOilKm, ... } ]
│       ├── fuelLogs: [ { id, date, odometer, liters, cost, mileage, ... } ]
│       ├── serviceLogs: [ { id, date, odometer, cost, notes, ... } ]
│       ├── fcmToken: "eXampleToken..."
│       └── lastActiveAt: Timestamp
├── feedbacks/
│   └── {feedbackId}/
│       ├── uid: "..."
│       ├── email: "..."
│       ├── type: "bug" | "feedback" | "feature_request"
│       ├── message: "..."
│       └── createdAt: Timestamp
└── app_config/
    └── version/
        ├── latestVersion: "1.1"
        ├── updateUrl: "https://..."
        ├── releaseNotes: "..."
        └── isMandatory: false
```

---

## 📁 প্রজেক্ট ডিরেক্টরি স্ট্রাকচার (Project Structure)

```text
ride-log/
├── android/                     # Capacitor Android Native প্রজেক্ট
│   └── app/
│       ├── build.gradle         # Android বিল্ড ও সাইনিং কনফিগারেশন
│       ├── google-services.json # Firebase Android কনফিগারেশন
│       └── src/main/AndroidManifest.xml
├── src/
│   ├── components/
│   │   ├── Header.jsx           # টপ বার, ল্যাঙ্গুয়েজ ও থিম সুইচ
│   │   ├── Dashboard.jsx        # ড্যাশবোর্ড, ফুয়েল স্ট্যাটাস ও অয়েল হেলথ
│   │   ├── FuelLogsTab.jsx      # ফুয়েল লগ তালিকা
│   │   ├── ServiceLogsTab.jsx   # সার্ভিস লগ তালিকা
│   │   ├── AnalyticsTab.jsx     # চার্ট ও অ্যানালিটিক্স গ্রাফ
│   │   ├── ProfileModal.jsx     # প্রোফাইল, ডকুমেন্ট স্টোরেজ ও সাপোর্ট
│   │   ├── BikeModal.jsx        # বাইক প্রোফাইল ও ডাটা ব্যাকআপ
│   │   ├── UpdateModal.jsx      # রিমোট ইন-অ্যাপ আপডেট প্রম্পট
│   │   └── LoginScreen.jsx      # গুগল ও ইমেইল লগইন স্ক্রিন
│   ├── utils/
│   │   ├── firebase.js          # Firebase Auth ও Firestore ইনিশিয়ালাইজেশন
│   │   ├── firestoreDB.js       # Firestore ক্লাউড সিঙ্ক ও আপডেট চেকার
│   │   ├── pushNotifications.js # FCM পুশ নোটিফিকেশন হ্যান্ডলার
│   │   ├── documentStorage.js   # প্রাইভেট ডকুমেন্ট ও মেয়াদ ট্র্যাকার
│   │   ├── calculations.js      # মাইলেজ ও পরিসংখ্যান ক্যালকুলেশন
│   │   ├── analytics.js         # Firebase Analytics ও ইভেন্ট ট্র্যাকার
│   │   └── translations.js      # বাংলা ও ইংরেজি অনুবাদের ডিকশনারি
│   ├── App.jsx                  # প্রধান রিয়্যাক্ট কম্পোনেন্ট
│   ├── index.css                # মোবাইল-ফার্স্ট গ্লাস মরফিজম ডিজাইন
│   └── main.jsx                 # এন্ট্রি পয়েন্ট
├── capacitor.config.json        # Capacitor কনফিগারেশন
├── package.json
└── vite.config.js
```

---

## 📄 লাইসেন্স (License)

This project is licensed under the **MIT License**. Open-source and free for all motorbike enthusiasts!
