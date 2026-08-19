import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBmFLLRdpGmwW0fNaOw76AnzUOfItkMJkA",
  authDomain: "ride-log-8511a.firebaseapp.com",
  projectId: "ride-log-8511a",
  storageBucket: "ride-log-8511a.firebasestorage.app",
  messagingSenderId: "757251174457",
  appId: "1:757251174457:web:08b7aead9de1f2cbe2dde8",
  measurementId: "G-3VYKY7458H"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initDatabase() {
  console.log('🚀 Initializing new Firebase Database collections & initial configs...');

  try {
    // 1. Initialize app_config / version
    await setDoc(doc(db, 'app_config', 'version'), {
      version: '1.6.2',
      mandatory: false,
      updateUrl: 'https://play.google.com/store/apps/details?id=com.ridelog.app',
      changeLog: 'Initial release for new database.',
      releasedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log('✅ Collection "app_config" -> Document "version" created.');

    // 2. Initialize app_config / campaign
    await setDoc(doc(db, 'app_config', 'campaign'), {
      id: 'welcome_campaign',
      title: 'Welcome to RideLog BD!',
      message: 'Track your bike fuel, service logs, and maintenance easily.',
      bannerUrl: '',
      actionUrl: '',
      active: true,
      createdAt: new Date().toISOString()
    }, { merge: true });
    console.log('✅ Collection "app_config" -> Document "campaign" created.');

    // 3. Initialize sample directory place
    await setDoc(doc(db, 'directory', 'place_sample'), {
      id: 'place_sample',
      name: 'Central Service Station',
      category: 'Garage & Fuel Station',
      address: 'Dhaka, Bangladesh',
      phone: '+8801700000000',
      rating: 5.0,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log('✅ Collection "directory" -> Document "place_sample" created.');

    console.log('\n🎉 Database setup complete! All global collections and configs have been initialized successfully.');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

initDatabase();
