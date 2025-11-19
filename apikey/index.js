// index.js
import express from 'express';
import cors from 'cors';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Koneksi ke MySQL
const connectDB = async () => {
  try {
    const db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',           // ← sesuaikan
      password: 'ridhorzq',        // ← sesuaikan
      database: 'apikey_db',
      port: '3309',   // ← sesuaikan (harus sudah dibuat)
    });
    console.log('✅ Terhubung ke database MySQL');
    return db;
  } catch (err) {
    console.error('❌ Gagal terhubung ke MySQL:', err.message);
    process.exit(1);
  }
};

// Fungsi utama
const startServer = async () => {
  const db = await connectDB();

  // Buat tabel jika belum ada
  await db.execute(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      api_key VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      revoked TINYINT(1) DEFAULT 0
    )
  `);

  // ✅ Generate API Key
  app.post('/api/generate-key', async (req, res) => {
    try {
      const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
      await db.execute('INSERT INTO api_keys (api_key) VALUES (?)', [apiKey]);
      res.json({ success: true, apiKey });
    } catch (error) {
      console.error('Error generate key:', error);
      res.status(500).json({ success: false, message: 'Gagal membuat API key' });
    }
  });

  // ✅ Validasi API Key
  app.post('/api/validate-key', async (req, res) => {
    let providedKey = null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedKey = authHeader.slice(7);
    } else if (req.headers['x-api-key']) {
      providedKey = req.headers['x-api-key'];
    } else if (req.body?.apiKey) {
      providedKey = req.body.apiKey;
    }

    if (!providedKey) {
      return res.status(400).json({ success: false, message: 'No API key provided' });
    }

    const [rows] = await db.execute(
      'SELECT api_key, created_at FROM api_keys WHERE api_key = ? AND revoked = 0',
      [providedKey]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, valid: false, message: 'API key invalid or revoked' });
    }

    const key = rows[0];
    res.json({
      success: true,
      valid: true,
      apiKey: key.api_key,
      createdAt: key.created_at
    });
  });

  // (Opsional) Lihat semua key — hanya untuk debug!
  app.get('/api/keys', async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT id, api_key, created_at, revoked FROM api_keys');
      res.json({ success: true, keys: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error fetching keys' });
    }
  });

  // Fallback ke index.html untuk SPA
  app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Jalankan server
  app.listen(PORT, () => {
    console.log(`✅ Server berjalan di http://localhost:${PORT}`);
  });
};

startServer();