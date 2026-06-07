require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const helmet = require('helmet');
const csrf = require('csurf');
const path = require('path');

const app = express();

// ==========================================
// 1. SET VIEW ENGINE & ANTARMUKA (UI/UX)
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// 2. IMPLEMENTASI KEAMANAN (SECURE CODING)
// ==========================================

// A. Proteksi HTTP Header dengan Helmet (Mitigasi XSS Dasar & Clickjacking)
app.use(helmet({
    contentSecurityPolicy: false, // Di-false agar CDN CSS/JS Bootstrap dapat dimuat lancar di localhost
}));

// B. Parsing Input & Validasi Data Dasar
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// C. Session Management (Mencegah Session Fixation & Hijacking)
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey123!',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true, // WAJIB: Mencegah dokumen cookie dibaca oleh JavaScript jahat (XSS)
        secure: false,  // Set ke TRUE jika nanti server Ubuntu sudah memakai sertifikat HTTPS/TLS
        maxAge: 3600000 // Sesi otomatis hangus/logout dalam waktu 1 jam
    }
}));

// D. Proteksi Anti-CSRF (Cross-Site Request Forgery)
const csrfProtection = csrf();
app.use(csrfProtection);

// Middleware Global untuk menyalurkan Token CSRF ke berkas EJS frontend
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
});

// ==========================================
// 3. KONEKSI DATABASE (LARAGON / HEIDISQL)
// ==========================================
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '12345',
    database: process.env.DB_NAME || 'ecodrop_db',
    waitForConnections: true,
    connectionLimit: 10
});

// ==========================================
// 4. ROUTING & LOGIKA SISTEM
// ==========================================

// [GET] Halaman Utama (Login / Register Form)
app.get('/', (req, res) => {
    // Jika user sudah memiliki session aktif, langsung alihkan ke dashboard
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null });
});

// [POST] Proses Registrasi Pengguna (Dengan Password Hashing)
app.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    // Validasi input kosong di sisi Server
    if (!username || !password) {
        return res.render('login', { error: 'Username dan password wajib diisi!' });
    }

    try {
        // Kriptografi: Hashing password dengan Bcrypt menggunakan salt round 10
        const hashedPassword = await bcrypt.hash(password, 10);

        // WAJIB: Menggunakan Prepared Statement (?) untuk menggagalkan SQL Injection
        const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
        
        db.execute(query, [username, hashedPassword, role || 'warga'], (err, result) => {
            if (err) {
                // Mencegah duplikasi data jika username sudah terdaftar (Constraint UNIQUE)
                return res.render('login', { error: 'Username sudah digunakan, silakan pilih nama lain.' });
            }
            res.render('login', { error: 'Registrasi akun berhasil! Silakan Login.' });
        });
    } catch (error) {
        res.render('login', { error: 'Gagal memproses registrasi pada sistem.' });
    }
});

// [POST] Proses Autentikasi Masuk (Login)
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render('login', { error: 'Semua field wajib diisi!' });
    }

    // Mengamankan query pencarian user dari SQL Injection
    const query = 'SELECT * FROM users WHERE username = ?';
    db.execute(query, [username], async (err, results) => {
        // Penulisan pesan error dibuat ambigu/generik untuk mencegah Username Enumeration
        if (err || results.length === 0) {
            return res.render('login', { error: 'Username atau password salah!' });
        }

        const user = results[0];

        // Membandingkan plain password dari input dengan hash password dari database
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.render('login', { error: 'Username atau password salah!' });
        }

        // Menyimpan status otorisasi ke dalam Session Server (RBAC Dasar)
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        res.redirect('/dashboard');
    });
});

// [GET] Halaman Dashboard Manajemen Sampah (Akses Terkontrol)
app.get('/dashboard', (req, res) => {
    // Pengecekan Kredensial Session (Mencegah Broken Authentication / Bypass URL)
    if (!req.session.userId) {
        return res.redirect('/');
    }

    // Mengambil data monitoring sampah dari database Laragon
    const query = 'SELECT * FROM waste_reports ORDER BY created_at DESC';
    db.execute(query, [], (err, reports) => {
        if (err) {
            return res.status(500).send("Gagal mengambil data dari database server.");
        }
        
        // Render view dashboard serta melempar data session user dan list sampah
        res.render('dashboard', { 
            user: req.session, 
            reports: reports 
        });
    });
});

// [POST] Form Setor/Laporkan Sampah Baru
app.post('/report', (req, res) => {
    // Keamanan Akses Token Sesi
    if (!req.session.userId) {
        return res.redirect('/');
    }

    const { waste_type, weight, description } = req.body;

    // Validasi parameter tipe data input server-side
    if (!waste_type || !weight || isNaN(weight)) {
        return res.status(400).send("Parameter input data sampah tidak valid.");
    }

    // Amankan parameter query input menggunakan Prepared Statement
    const query = 'INSERT INTO waste_reports (user_id, waste_type, weight, description) VALUES (?, ?, ?, ?)';
    db.execute(query, [req.session.userId, waste_type, weight, description], (err, result) => {
        if (err) {
            return res.status(500).send("Gagal menyimpan data laporan.");
        }
        res.redirect('/dashboard');
    });
});

// [GET] Proses Keluar Sistem (Logout)
app.get('/logout', (req, res) => {
    // Menghancurkan session di server dan membersihkan cookie di sisi client browser
    req.session.destroy((err) => {
        if (err) {
            console.log("Gagal menghapus session cookie:", err);
        }
        res.clearCookie('connect.sid'); // Menghapus token session ID default Express
        res.redirect('/');
    });
});

// ==========================================
// 5. RUN SERVER JARINGAN LOCALHOST
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🍃 Server EcoDrop (Manajemen Sampah) Sukses Dijalankan`);
    console.log(`🌐 URL Aplikasi  : http://localhost:${PORT}`);
    console.log(`🛡️  Status Keamanan: Helmet (Aktif), CSRF (Aktif), Bcrypt (Aktif)`);
    console.log(`====================================================`);
});