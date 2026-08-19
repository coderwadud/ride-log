import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, doc, setDoc, writeBatch, deleteField
} from 'firebase/firestore';

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

const DEFAULT_BIKE = {
  id: 'bike_1',
  name: 'My Bike',
  regNumber: '',
  initialOdometer: 0,
  currentOdometer: 0,
  targetOilKm: 1000
};

async function migrateAllUsers() {
  console.log('🚀 Starting Cloud Database Migration for all users...');
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`Found ${usersSnap.size} user documents in Firestore.`);

  let migratedCount = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();
    console.log(`\nChecking user: ${uid}`);

    const bikes = data.bikes || [];
    const fuelLogs = data.fuelLogs || [];
    const serviceLogs = data.serviceLogs || [];

    if (bikes.length > 0 || fuelLogs.length > 0 || serviceLogs.length > 0) {
      console.log(`  - Migrating ${bikes.length} bikes, ${fuelLogs.length} fuel logs, ${serviceLogs.length} service logs to sub-collections...`);

      const batch = writeBatch(db);

      // 1. Bikes sub-collection
      for (const bike of (bikes.length > 0 ? bikes : [DEFAULT_BIKE])) {
        const bId = bike.id || 'bike_1';
        batch.set(doc(db, 'users', uid, 'bikes', bId), { ...bike, id: bId });
      }

      // 2. Fuel logs sub-collection
      for (const fuel of fuelLogs) {
        const fId = fuel.id || `fuel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        batch.set(doc(db, 'users', uid, 'fuel_logs', fId), { ...fuel, id: fId });
      }

      // 3. Service logs sub-collection
      for (const service of serviceLogs) {
        const sId = service.id || `service_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        batch.set(doc(db, 'users', uid, 'service_logs', sId), { ...service, id: sId });
      }

      // 4. Update root doc: delete old monolithic arrays & set schemaVersion 2.0
      batch.set(doc(db, 'users', uid), {
        settings: data.settings || { lang: 'bn', theme: 'dark' },
        activeBikeId: data.activeBikeId || 'bike_1',
        schemaVersion: '2.0',
        migratedAt: new Date().toISOString(),
        bikes: deleteField(),
        fuelLogs: deleteField(),
        serviceLogs: deleteField()
      }, { merge: true });

      await batch.commit();
      migratedCount++;
      console.log(`  ✅ Successfully migrated user: ${uid}`);
    } else {
      console.log(`  ✓ User ${uid} is already using sub-collections or is clean.`);
    }
  }

  console.log(`\n🎉 All done! Successfully migrated ${migratedCount} users to Firestore sub-collections.`);
  process.exit(0);
}

migrateAllUsers().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
