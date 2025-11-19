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

