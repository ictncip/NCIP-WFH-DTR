import admin from 'firebase-admin';
import fs from 'node:fs';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountPath) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT env var (path to service account JSON).');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTs = (value) => {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

const pickTime = (existing, incoming, mode) => {
  if (!existing) return incoming;
  if (!incoming) return existing;
  return mode === 'earliest'
    ? (incoming < existing ? incoming : existing)
    : (incoming > existing ? incoming : existing);
};

const isOldLog = (data) => {
  return data && data.type && data.timestamp && !data.dateKey;
};

const isDailyRecord = (data) => {
  return data && data.dateKey && (data.timeIn || data.timeOut || data.breakIn || data.breakOut);
};

const main = async () => {
  const snapshot = await db.collection('dtr').get();
  const dailyMap = new Map();
  const oldDocs = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (isDailyRecord(data)) return;
    if (!isOldLog(data)) return;

    const ts = getTs(data.timestamp);
    if (!ts || !data.userId) return;

    const dateKey = toDateKey(ts);
    const key = `${data.userId}_${dateKey}`;

    let record = dailyMap.get(key);
    if (!record) {
      record = {
        userId: data.userId,
        userName: data.userName || '',
        userEmail: data.userEmail || '',
        dateKey,
        timeIn: null,
        breakOut: null,
        breakIn: null,
        timeOut: null
      };
      dailyMap.set(key, record);
    }

    if (data.userName && !record.userName) record.userName = data.userName;
    if (data.userEmail && !record.userEmail) record.userEmail = data.userEmail;

    if (data.type === 'time_in') record.timeIn = pickTime(record.timeIn, ts, 'earliest');
    if (data.type === 'break_out') record.breakOut = pickTime(record.breakOut, ts, 'earliest');
    if (data.type === 'break_in') record.breakIn = pickTime(record.breakIn, ts, 'earliest');
    if (data.type === 'time_out') record.timeOut = pickTime(record.timeOut, ts, 'latest');

    oldDocs.push({ id: doc.id, key });
  });

  console.log(`Old logs found: ${oldDocs.length}`);
  console.log(`Daily records to write: ${dailyMap.size}`);

  if (!APPLY) {
    console.log('Dry run only. Use --apply to write changes.');
    process.exit(0);
  }

  const writer = db.bulkWriter();

  for (const [key, record] of dailyMap.entries()) {
    const ref = db.collection('dtr').doc(key);
    const payload = {
      userId: record.userId,
      userName: record.userName,
      userEmail: record.userEmail,
      dateKey: record.dateKey
    };
    if (record.timeIn) payload.timeIn = admin.firestore.Timestamp.fromDate(record.timeIn);
    if (record.breakOut) payload.breakOut = admin.firestore.Timestamp.fromDate(record.breakOut);
    if (record.breakIn) payload.breakIn = admin.firestore.Timestamp.fromDate(record.breakIn);
    if (record.timeOut) payload.timeOut = admin.firestore.Timestamp.fromDate(record.timeOut);

    writer.set(ref, payload, { merge: true });
  }

  for (const doc of oldDocs) {
    const ref = db.collection('dtr').doc(doc.id);
    writer.update(ref, {
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedTo: doc.key
    });
  }

  await writer.close();
  console.log('Migration applied.');
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
