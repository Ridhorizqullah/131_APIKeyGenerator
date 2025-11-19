// index.js
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Koneksi DB (reusable)
const getDBConnection = () => mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// === 1. REGISTER ADMIN ===
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi' });
  }

  try {
    const conn = await getDBConnection();
    await conn.execute(
      'INSERT INTO admin (email, password) VALUES (?, ?)',
      [email, password]
    );
    await conn.end();
    res.json({ message: 'Admin berhasil didaftarkan!' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email sudah terdaftar' });
    }
    console.error(err);
    res.status(500).json({ error: 'Gagal mendaftarkan admin' });
  }
});

// === 2. LOGIN ADMIN ===
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi' });
  }

  try {
    const conn = await getDBConnection();
    const [rows] = await conn.execute(
      'SELECT * FROM admin WHERE email = ? AND password = ?',
      [email, password]
    );
    await conn.end();

    if (rows.length > 0) {
      res.json({ success: true, message: 'Login berhasil' });
    } else {
      res.status(401).json({ success: false, message: 'Email atau password salah' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal login' });
  }
});

// === 3. REGISTER USER + GENERATE API KEY ===
app.post('/user-register', async (req, res) => {
  const { first_name, last_name, email } = req.body;
  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }

  const apiKey = randomBytes(32).toString('hex'); // 64 karakter

  try {
    const conn = await getDBConnection();

    // Simpan API key dulu
    const [apiKeyResult] = await conn.execute(
      'INSERT INTO api_keys (key_value, out_of_date) VALUES (?, 0)',
      [apiKey]
    );
    const apiKeyId = apiKeyResult.insertId;

    // Simpan user + kaitkan ke API key
    await conn.execute(
      'INSERT INTO users (first_name, last_name, email, api_key_id) VALUES (?, ?, ?, ?)',
      [first_name, last_name, email, apiKeyId]
    );

    await conn.end();

    res.json({
      success: true,
      message: 'User dan API Key berhasil dibuat!',
      apiKey
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' && err.message.includes('email')) {
      return res.status(400).json({ error: 'Email user sudah terdaftar' });
    }
    console.error(err);
    res.status(500).json({ error: 'Gagal membuat user' });
  }
});

// === 4. DASHBOARD: TAMPILKAN DAFTAR USER + API KEY ===
app.get('/dashboard', async (req, res) => {
  try {
    const conn = await getDBConnection();
    const [rows] = await conn.execute(`
      SELECT 
        u.id AS "ID User",
        u.first_name AS "Nama Depan",
        u.last_name AS "Nama Belakang",
        u.email AS "Email",
        k.key_value AS "API Key",
        CASE 
          WHEN k.out_of_date = 1 THEN 'Nonaktif'
          ELSE 'Aktif'
        END AS "Status Key"
      FROM users u
      LEFT JOIN api_keys k ON u.api_key_id = k.id
    `);
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengambil data dashboard' });
  }
});

// === Serve halaman utama ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`🚀 Backend berjalan di http://localhost:${PORT}`);
  console.log(`📁 Database: ${process.env.DB_NAME}`);
});