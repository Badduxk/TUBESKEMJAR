const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = 3000;

// ==========================================
// 1. HARDENING & INFRASTRUCTURE SECURITY [cite: 30, 33]
// ==========================================
// Mengamankan HTTP Header menggunakan Helmet [cite: 34]
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            // Pastikan default-src mengarah ke 'self', bukan 'none'
            defaultSrc: ["'self'"],
            
            // SOLUSI: Mengizinkan koneksi internal browser/DevTools ke server lokal
            connectSrc: ["'self'", "http://localhost:3000", "ws://localhost:3000"],
            
            // Pengaturan aset lainnya tetap aman
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
            fontSrc: ["'self'", "cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:"]
        },
    }
}));

// Rate Limiting: Mencegah Brute Force & DoS skala kecil [cite: 41, 75]
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Menit
    max: 100, // Maksimal 100 request per IP
    message: "🛡️ Terlalu banyak request dari IP Anda. Sila coba beberapa saat lagi."
});
app.use(generalLimiter);

// ==========================================
// 2. PARSER & SESSION CONFIGURATION 
// ==========================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser('EcoDrop_Secure_Cookie_Secret_2026'));

app.use(session({
    secret: 'EcoDrop_NodeJS_Session_Key_Secret_Top_Secure',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true, // Proteksi dari pencurian session via XSS [cite: 39]
        secure: false,  // Set ke true jika sudah menggunakan HTTPS/TLS di server [cite: 53]
        maxAge: 60 * 60 * 1000 // Session kedaluwarsa dalam 1 Jam
    }
}));

// Set View Engine ke EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// 3. DATABASE CONNECTION (MySQL / Laragon)
// ==========================================
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '12345', // Sesuaikan jika database Laragon kamu bermonitor password
    database: 'ecodrop_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Tes Koneksi Database
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Koneksi database MySQL gagal:', err.message);
        process.exit(1);
    }
    console.log('🚀 Terkoneksi ke database ecodrop_db (Laragon) dengan aman.');
    connection.release();
});

// ==========================================
// 4. ANTI-CSRF PROTECTION MIDDLEWARE 
// ==========================================
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// Middleware untuk menyisipkan CSRF Token global ke setiap render EJS 
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
});

// ==========================================
// 5. ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARES 
// ==========================================
// Memastikan user sudah otentikasi (login)
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

// Validasi Khusus Role Warga 
const isWarga = (req, res, next) => {
    if (req.session.userId && req.session.role === 'warga') {
        return next();
    }
    res.status(403).send('🛡️ Akses Ditolak: Halaman ini khusus untuk jalur akun Warga.');
};

// Validasi Khusus Role Admin 
const isAdmin = (req, res, next) => {
    if (req.session.userId && req.session.role === 'admin') {
        return next();
    }
    res.status(403).send('🛡️ Akses Ditolak: Anda tidak memiliki hak akses administrator.');
};

app.get('/', (req, res) => {
    // Jalur pintar: Jika user sudah login, cek role-nya untuk dilempar ke dashboard yang sesuai
    if (req.session.userId) {
        return req.session.role === 'admin' ? res.redirect('/admin') : res.redirect('/dashboard');
    }
    // Jika belum login, otomatis alihkan ke halaman login
    res.redirect('/login');
});

// ==========================================
// 6. ROUTES - AUTHENTICATION SUITE
// ==========================================

// [GET] Halaman Login
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return req.session.role === 'admin' ? res.redirect('/admin') : res.redirect('/dashboard');
    }
    res.render('login'); // Pastikan kamu punya file views/login.ejs
});

// [POST] Memproses Login (Validasi Password Hashing & Deteksi RBAC) [cite: 35, 42]
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Prepared Statement mencegah SQL Injection 
    const query = 'SELECT * FROM users WHERE username = ?';
    db.execute(query, [username], async (err, results) => {
        if (err) return res.status(500).send("Terjadi kendala pada internal server.");
        if (results.length === 0) return res.status(401).send("Username atau Password salah.");

        const user = results[0];

        // Validasi Password Hash [cite: 35]
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).send("Username atau Password salah.");

        // Menyimpan data kredensial ke Session Server 
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        // Pengalihan cerdas berbasis Otoritas Role (RBAC) 
        if (user.role === 'admin') {
            res.redirect('/admin');
        } else {
            res.redirect('/dashboard');
        }
    });
});

// [GET] Halaman Registrasi Warga
app.get('/register', (req, res) => {
    res.render('register'); // Pastikan kamu punya file views/register.ejs
});

// [POST] Proses Registrasi Akun Warga Baru [cite: 35]
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Enkripsi password menggunakan Bcrypt [cite: 35]
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Secara default, registrasi mandiri diarahkan sebagai role 'warga' 
        // Menghindari celah Privilege Escalation dari sisi client 
        const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, "warga")';
        
        db.execute(query, [username, hashedPassword], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).send("Username sudah terdaftar.");
                return res.status(500).send("Gagal mendaftarkan akun.");
            }
            res.send("<h3>Akun berhasil didaftarkan! Sila <a href='/login'>Login di sini</a></h3>");
        });
    } catch (e) {
        res.status(500).send("Gagal memproses data pendaftaran.");
    }
});

// ==========================================
// 7. ROUTES - CORE SYSTEMS (WARGA / DASHBOARD)
// ==========================================

// [GET] Dashboard Utama Warga (Membaca Riwayat Milik Sendiri) 
app.get('/dashboard', isAuthenticated, isWarga, (req, res) => {
    // Memastikan Warga HANYA bisa membaca data miliknya sendiri (Pencegahan IDOR / Broken Object Level Authorization) 
    const query = 'SELECT * FROM waste_reports WHERE user_id = ? ORDER BY created_at DESC';
    
    db.execute(query, [req.session.userId], (err, reports) => {
        if (err) return res.status(500).send("Gagal memuat log riwayat sampah.");
        
        res.render('dashboard', {
            user: req.session,
            reports: reports
        });
    });
});

// [POST] Mengirimkan Setoran Sampah Baru oleh Warga [cite: 37]
app.post('/report', isAuthenticated, isWarga, (req, res) => {
    const { waste_type, weight, description } = req.body;

    // Server-side Input Validation (Validasi tipe data makro) [cite: 37]
    const parsedWeight = parseFloat(weight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
        return res.status(400).send("Input berat sampah tidak valid.");
    }

    const query = 'INSERT INTO waste_reports (user_id, waste_type, weight, description, status) VALUES (?, ?, ?, ?, "Pending")';
    db.execute(query, [req.session.userId, waste_type, parsedWeight, description || null], (err, result) => {
        if (err) return res.status(500).send("Gagal menyimpan laporan ke database.");
        
        res.redirect('/dashboard');
    });
});

// ==========================================
// 8. ROUTES - CORE SYSTEMS (ADMIN CONTROL PANEL) 
// ==========================================

// [GET] Panel Kendali Utama Admin (Membaca Seluruh Data Sistem) 
app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
    // SQL JOIN: Menggabungkan tabel laporan dengan nama user pelapornya 
    const queryReports = `
        SELECT waste_reports.*, users.username 
        FROM waste_reports 
        JOIN users ON waste_reports.user_id = users.id 
        ORDER BY waste_reports.created_at DESC`;
        
    const queryUsers = 'SELECT COUNT(*) as total_users FROM users WHERE role = "warga"';

    db.execute(queryReports, [], (err, reports) => {
        if (err) return res.status(500).send("Gagal mengambil repositori log sampah.");

        db.execute(queryUsers, [], (errUsers, userResult) => {
            if (errUsers) return res.status(500).send("Gagal memuat arsitektur statistik.");

            res.render('admin', {
                user: req.session,
                reports: reports,
                totalUsers: userResult[0].total_users
            });
        });
    });
});

// [POST] Pembaruan Status Pelaporan oleh Admin 
app.post('/admin/update-status', isAuthenticated, isAdmin, (req, res) => {
    const { report_id, status } = req.body;

    // Membatasi status agar tidak di-inject nilai teks aneh selain opsi sistem [cite: 37]
    const allowedStatus = ['Pending', 'Diverifikasi', 'Selesai'];
    if (!allowedStatus.includes(status)) {
        return res.status(400).send("Parameter manipulasi status tidak diizinkan.");
    }

    const query = 'UPDATE waste_reports SET status = ? WHERE id = ?';
    db.execute(query, [status, report_id], (err, result) => {
        if (err) return res.status(500).send("Gagal memperbarui status kliring data.");
        
        res.redirect('/admin');
    });
});

// ==========================================
// 9. LOGOUT SUITE & GLOBAL ERROR CLEANUP 
// ==========================================
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).send("Gagal menghancurkan sesi aktif.");
        res.clearCookie('connect.sid'); // Bersihkan cookie session di browser client
        res.redirect('/login');
    });
});

// Menangani Error CSRF Token secara elegan agar tidak crash 
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).send('🛡️ Keamanan Sistem: Aktivitas ilegal terdeteksi (Bad CSRF Token). Request ditolak.');
    }
    next(err);
});

// Jalankan Server Aplikasi
app.listen(PORT, () => {
    console.log(`📡 EcoDrop Web Server aktif berjalan pada port http://localhost:${PORT}`);
});