// index.js
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
const KEYS_FILE = path.join(__dirname, 'keys.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// helper: baca keys dari file (kembalikan array)
function readKeys() {
  try {
    const raw = fs.readFileSync(KEYS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return []; // kalau file belum ada atau rusak -> kembalikan array kosong
  }
}

// helper: simpan keys ke file
function writeKeys(keys) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
}

// Endpoint generate key (simpan ke keys.json)
app.post('/api/generate-key', (req, res) => {
  const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
  const keys = readKeys();

  // Simpan metadata sederhana: key, createdAt
  keys.push({
    apiKey,
    createdAt: new Date().toISOString(),
    // opsional: owner, note, revoked: false
  });

  writeKeys(keys);

  res.json({ success: true, apiKey });
});

// Endpoint validate key
// Bisa menerima key di header Authorization (Bearer) atau x-api-key, atau body
app.post('/api/validate-key', (req, res) => {
  // Ambil dari header Authorization: "Bearer <key>"
  const authHeader = req.headers['authorization'] || '';
  let providedKey = null;

  if (authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.slice(7); // hapus "Bearer "
  } else if (req.headers['x-api-key']) {
    providedKey = req.headers['x-api-key'];
  } else if (req.body && req.body.apiKey) {
    providedKey = req.body.apiKey;
  }

  if (!providedKey) {
    return res.status(400).json({ success: false, message: 'No API key provided' });
  }

  const keys = readKeys();
  const found = keys.find(k => k.apiKey === providedKey);

  if (!found) {
    return res.status(401).json({ success: false, valid: false, message: 'API key invalid' });
  }

  // Jika ingin cek juga apakah ada flag revoked, expired, dll.:
  // if (found.revoked) { ... }

  return res.json({ success: true, valid: true, apiKey: found.apiKey, createdAt: found.createdAt });
});

// (Opsional) Endpoint untuk melihat semua keys (debug only)
// Jangan pakai ini di production kecuali dibatasi/authenticated
app.get('/api/keys', (req, res) => {
  const keys = readKeys();
  res.json({ success: true, keys });
});

// Fallback ke index.html
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
