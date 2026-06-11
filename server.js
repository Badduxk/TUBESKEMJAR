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

// =========================================================================
// 🔬 MONITORING JARINGAN GLOBAL (LOGGER TERMINAL)
// =========================================================================
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] 📡 Request Masuk: ${req.method} ${req.url} | Dari IP: ${req.ip}`);
    next();
});

// ==========================================
// 1. HARDENING & INFRASTRUCTURE SECURITY 
// ==========================================
app.use(helmet({
    contentSecurityPolicy: {
        // Matikan fungsi default agar tidak memaksa upgrade-insecure-requests (HTTP -> HTTPS) otomatis
        useDefaults: false, 
        directives: {
            defaultSrc: ["'self'"],
            // Izinkan connect-src ke self dan jsdelivr (untuk map/assets bootstrap)
            connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
            fontSrc: ["'self'", "cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:"],
            // Wajib ditambahkan agar form submission diizinkan ke origin yang sama
            formAction: ["'self'"] 
        },
    }
}));

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 2000, 
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
        httpOnly: true, 
        secure: false,  
        maxAge: 60 * 60 * 1000 
    }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// 3. DATABASE CONNECTION (MySQL / Laragon)
// ==========================================
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '12345', 
    database: 'ecodrop_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Koneksi database MySQL gagal:', err.message);
        process.exit(1);
    }
    console.log('🚀 DB STATUS: Terkoneksi ke database ecodrop_db (Laragon) dengan aman.');
    connection.release();
});

// ==========================================
// 4. ANTI-CSRF PROTECTION MIDDLEWARE 
// ==========================================
const csrfProtection = csrf(); 
app.use(csrfProtection);

app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
});

// ==========================================
// 5. ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARES 
// ==========================================
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

const isWarga = (req, res, next) => {
    if (req.session.userId && req.session.role === 'warga') {
        return next();
    }
    res.status(403).send('🛡️ Akses Ditolak: Halaman ini khusus untuk jalur akun Warga.');
};

const isAdmin = (req, res, next) => {
    if (req.session.userId && req.session.role === 'admin') {
        return next();
    }
    res.status(403).send('🛡️ Akses Ditolak: Anda tidak memiliki hak akses administrator.');
};

app.get('/', (req, res) => {
    if (req.session.userId) {
        return req.session.role === 'admin' ? res.redirect('/admin') : res.redirect('/dashboard');
    }
    res.redirect('/login');
});

// ==========================================
// 6. ROUTES - AUTHENTICATION SUITE
// ==========================================
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return req.session.role === 'admin' ? res.redirect('/admin') : res.redirect('/dashboard');
    }
    res.render('login'); 
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`🔑 [LOGIN TRY]: Memproses login untuk username: "${username}"`);

    const query = 'SELECT * FROM users WHERE username = ?';
    db.execute(query, [username], async (err, results) => {
        if (err) {
            console.error(`❌ [LOGIN ERROR]: Query gagal -> ${err.message}`);
            return res.status(500).send(`<h3>❌ Error Database</h3><p>${err.message}</p>`);
        }
        
        if (results.length === 0) {
            console.warn(`⚠️ [LOGIN FAILED]: Username "${username}" tidak ditemukan di DB.`);
            return res.status(401).send(`
                <div style="font-family: sans-serif; padding: 20px; border: 2px solid red; background: #fff5f5;">
                    <h2>❌ Gagal: Username Tidak Ditemukan!</h2>
                    <p>Sistem mencari user dengan nama <b>"${username}"</b> di database, tapi hasilnya <b>KOSONG (0 baris)</b>.</p>
                </div>
            `);
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            console.warn(`⚠️ [LOGIN FAILED]: Password salah untuk user "${username}".`);
            return res.status(401).send(`
                <div style="font-family: sans-serif; padding: 20px; border: 2px solid orange; background: #fff9f0;">
                    <h2>❌ Gagal: Password Mismatch (Tidak Cocok)!</h2>
                    <p>User <b>"${user.username}"</b> ketemu di database, tapi password-nya ditolak oleh Bcrypt.</p>
                </div>
            `);
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        console.log(`✅ [LOGIN SUCCESS]: "${username}" berhasil masuk sebagai [${user.role}].`);

        if (user.role === 'admin') {
            res.redirect('/admin');
        } else {
            res.redirect('/dashboard');
        }
    });
});

app.get('/register', (req, res) => {
    res.render('login'); 
});

// 🔥 PERBAIKAN UTAMA DI SINI (LOGIKA DAFTAR/REGISTER) 🔥
app.post('/register', async (req, res) => {
    // 1. Tangkap parameter 'role' dari elemen <select name="role"> di file HTML kamu
    const { username, password, role } = req.body;
    console.log(`📝 [REGISTER TRY]: Memproses pendaftaran Username: "${username}" dengan pilihan Role: "${role}"`);
    
    try {
        // 2. PROTEKSI KEAMANAN (Cegah Red Team menembak role "admin" lewat HTTP Request Tools seperti Burp Suite)
        const allowedRoles = ['warga', 'petugas'];
        if (!allowedRoles.includes(role)) {
            console.warn(`🛡️ [SECURITY ALERT]: Deteksi manipulasi parameter! IP ${req.ip} mencoba mendaftar dengan role terlarang: "${role}"`);
            return res.status(400).send("<h3>🛡️ Sistem Proteksi: Parameter Role tidak valid atau dilarang!</h3>");
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Ubah query SQL agar kolom role diisi secara dinamis sesuai pilihan (?)
        const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
        db.execute(query, [username, hashedPassword, role], (err, result) => {
            if (err) {
                console.error(`❌ [DATABASE REGISTER ERROR]: Gagal menyimpan user baru.`);
                if (err.code === 'ER_DUP_ENTRY') {
                    console.warn(`⚠️ [REGISTER FAILED]: Username "${username}" sudah ada.`);
                    return res.status(400).send("Username sudah terdaftar.");
                }
                return res.status(500).send("Gagal mendaftarkan akun.");
            }
            console.log(`   [REGISTER SUCCESS]: Akun "${username}" dengan Role [${role}] berhasil disimpan ke database!`);
            res.send("<h3>Akun berhasil didaftarkan! Sila <a href='/login'>Login di sini</a></h3>");
        });
    } catch (e) {
        console.error(`❌ [SYSTEM REGISTER ERROR]: ${e.message}`);
        res.status(500).send("Gagal memproses data pendaftaran.");
    }
});

// ==========================================
// 7. ROUTES - CORE SYSTEMS (WARGA / DASHBOARD)
// ==========================================
app.get('/dashboard', isAuthenticated, isWarga, (req, res) => {
    const query = 'SELECT * FROM waste_reports WHERE user_id = ? ORDER BY created_at DESC';
    
    db.execute(query, [req.session.userId], (err, reports) => {
        if (err) return res.status(500).send("Gagal memuat log riwayat sampah.");
        
        res.render('dashboard', {
            user: req.session,
            reports: reports
        });
    });
});

app.post('/report', isAuthenticated, isWarga, (req, res) => {
    const { waste_type, weight, description } = req.body;

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
// 8. ROUTES - CORE SYSTEMS (ADMIN CONTROL PANEL & CRUD USER)
// ==========================================
app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
    const queryReports = `
        SELECT waste_reports.*, users.username 
        FROM waste_reports 
        JOIN users ON waste_reports.user_id = users.id 
        ORDER BY waste_reports.created_at DESC`;
        
    const queryUsersCount = 'SELECT COUNT(*) as total_users FROM users WHERE role = "warga"';
    const queryAllUsers = 'SELECT id, username, role FROM users ORDER BY id DESC';

    db.execute(queryReports, [], (err, reports) => {
        if (err) return res.status(500).send("Gagal mengambil repositori log sampah.");

        db.execute(queryUsersCount, [], (errUsers, userResult) => {
            if (errUsers) return res.status(500).send("Gagal memuat arsitektur statistik.");

            db.execute(queryAllUsers, [], (errAllUsers, allUsersResult) => {
                if (errAllUsers) return res.status(500).send("Gagal memuat data repositori pengguna.");

                res.render('admin', {
                    user: {
                        id: req.session.userId,
                        username: req.session.username,
                        role: req.session.role
                    },
                    reports: reports,
                    totalUsers: userResult[0].total_users,
                    users: allUsersResult 
                });
            });
        });
    });
});

app.post('/admin/update-status', isAuthenticated, isAdmin, (req, res) => {
    const { report_id, status } = req.body;

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

app.post('/admin/reports/delete/:id', isAuthenticated, isAdmin, (req, res) => {
    const { id } = req.params;

    const query = "DELETE FROM waste_reports WHERE id = ?";
    db.execute(query, [id], (err) => {
        if (err) return res.status(500).send("Gagal melenyapkan data laporan sampah: " + err.message);
        res.redirect('/admin');
    });
});

app.post('/admin/users/add', isAuthenticated, isAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const query = "INSERT INTO users (username, password, role) VALUES (?, ?, ?)";
        db.execute(query, [username, hashedPassword, role], (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).send("<script>alert('Username sudah terdaftar!'); window.location='/admin';</script>");
                return res.status(500).send("Gagal menyuntikkan user baru: " + err.message);
            }
            res.redirect('/admin');
        });
    } catch (e) {
        res.status(500).send("System Integrity Error: " + e.message);
    }
});

app.post('/admin/users/edit/:id', isAuthenticated, isAdmin, (req, res) => {
    const { id } = req.params;
    const { username, role } = req.body;

    const query = "UPDATE users SET username = ?, role = ? WHERE id = ?";
    db.execute(query, [username, role, id], (err) => {
        if (err) return res.status(500).send("Gagal memperbarui data user: " + err.message);
        res.redirect('/admin');
    });
});

app.post('/admin/users/delete/:id', isAuthenticated, isAdmin, (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === req.session.userId) {
        return res.status(400).send("<script>alert('Proteksi Keamanan: Anda tidak diperbolehkan menghapus akun Admin Anda sendiri yang sedang aktif!'); window.location='/admin';</script>");
    }

    const query = "DELETE FROM users WHERE id = ?";
    db.execute(query, [id], (err) => {
        if (err) return res.status(500).send("Gagal melenyapkan data user: " + err.message);
        res.redirect('/admin');
    });
});

// ==========================================
// 9. LOGOUT SUITE & GLOBAL ERROR CLEANUP 
// ==========================================
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).send("Gagal menghancurkan sesi aktif.");
        res.clearCookie('connect.sid'); 
        res.redirect('/login');
    });
});

app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        console.error(`\n🛡️  [SECURITY ALERT]: Request POST ditolak! Token CSRF tidak valid atau diblokir oleh browser client.`);
        console.error(`   Detail Request -> URL: ${req.url} | IP: ${req.ip}\n`);
        return res.status(403).send('🛡️ Keamanan Sistem: Aktivitas ilegal terdeteksi (Bad CSRF Token). Request ditolak.');
    }
    next(err);
});

app.get('/buat-admin-pasti-jadi', async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashAman = await bcrypt.hash('admin', salt);
        
        db.execute("DELETE FROM users WHERE username = 'reza_admin'", [], (err) => {
            if (err) return res.status(500).send("Gagal membersihkan user lama: " + err.message);
            
            const queryInsert = "INSERT INTO users (username, password, role) VALUES ('reza_admin', ?, 'admin')";
            db.execute(queryInsert, [hashAman], (errInsert) => {
                if (errInsert) return res.status(500).send("Gagal injeksi user baru: " + errInsert.message);
                
                res.send(`
                    <div style="font-family:sans-serif; padding:20px; background:#e6fffa; border:2px solid #319795;">
                        <h2>🚀 Akun Admin Berhasil Dibuat Bersih!</h2>
                        <p>Username: <b>reza_admin</b></p>
                        <p>Password asli: <b>admin</b></p>
                        <p>Hash baru dari server: <code>${hashAman}</code></p>
                        <hr>
                        <p>👉 Silakan balik ke halaman <a href="/login"><b>/login</b></a> dan tes sekarang.</p>
                    </div>
                `);
            });
        });
    } catch (e) {
        res.status(500).send("Error System: " + e.message);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n===================================================================`);
    console.log(`📡 EcoDrop Web Server aktif berjalan pada port ${PORT} (Semua Interface)`);
    console.log(`👉 Akses internal (Laptop Kamu) : http://localhost:${PORT}`);
    console.log(`===================================================================\n`);
});