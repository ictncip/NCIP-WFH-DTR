import admin from 'firebase-admin';
import fs from 'node:fs';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const FILE = process.env.EMPLOYEES_FILE || 'data/employees.tsv';

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

const normalize = (value) => String(value || '').trim().toLowerCase();

const parseLine = (line) => {
  if (!line.trim()) return null;
  const parts = line.split('\t');
  if (parts.length < 2) return null;
  const name = parts[0].trim();
  const office = parts.slice(1).join('\t').trim();
  if (!name || !office) return null;
  return { name, office };
};

const main = async () => {
  const raw = fs.readFileSync(FILE, 'utf8');
  const lines = raw.split(/\r?\n/);
  const parsed = [];

  lines.forEach((line) => {
    const row = parseLine(line);
    if (!row) return;
    parsed.push(row);
  });

  const unique = new Map();
  parsed.forEach(row => {
    const key = `${normalize(row.name)}::${normalize(row.office)}`;
    if (!unique.has(key)) unique.set(key, row);
  });

  const items = Array.from(unique.values());

  console.log(`Parsed: ${parsed.length}`);
  console.log(`Unique: ${items.length}`);

  if (!APPLY) {
    console.log('Dry run only. Use --apply to write changes.');
    process.exit(0);
  }

  const writer = db.bulkWriter();

  items.forEach(item => {
    const ref = db.collection('users').doc();
    writer.set(ref, {
      name: item.name,
      office: item.office,
      role: 'employee',
      isActive: true,
      email: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  await writer.close();
  console.log('Import complete.');
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
