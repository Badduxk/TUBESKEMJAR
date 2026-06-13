# 🌿 EcoDrop - Secure Waste Management System

[![Node.js Version](https://img.shields.io/badge/node-v18.x+-green.svg)](https://nodejs.org)
[![Security Platform](https://img.shields.io/badge/SIEM-Wazuh-blue.svg)](https://wazuh.com)
[![IDS](https://img.shields.io/badge/IDS-Suricata-orange.svg)](https://suricata.io)
[![License](https://img.shields.io/badge/UAS-Keamanan%20Jaringan%202026-red.svg)](#)

**EcoDrop** adalah aplikasi berbasis web manajemen sampah berbasis masyarakat yang dirancang untuk mendata, memantau, dan mengelola pengumpulan sampah secara efisien. Proyek ini dikembangkan khusus untuk memenuhi tugas **UAS Keamanan Jaringan**, dengan focus utama pada implementasi **Defense-in-Depth (Keamanan Berlapis)** dari *Application Layer* hingga *Network & Infrastructure Layer*.

---

## 🛡️ Fitur Keamanan Sistem (Security Architecture)

Aplikasi ini mengadopsi prinsip *Secure by Design* untuk memitigasi kerentanan pada OWASP Top 10 melalui arsitektur berikut:

### 1. Application Layer Security (Node.js & Express)
* **Anti-SQL Injection:** Menggunakan *Prepared Statements* via `db.execute()` untuk memisahkan perintah SQL dan input pengguna.
* **Cross-Site Scripting (XSS) Mitigation:** * Penerapan **Content Security Policy (CSP)** ketat via `Helmet.js`.
    * Konfigurasi *HTML Escaping* otomatis di sisi klien menggunakan ekspresi `<%= data %>` pada mesin templat EJS.
* **CSRF Protection:** Validasi token kriptografis dinamis pada setiap form manipulasi data (`POST`) menggunakan middleware `csurf`.
* **Rate Limiting / Anti-Brute Force:** Pembatasan frekuensi request ke rute sensitif (seperti `/login`) menggunakan `express-rate-limit`.
* **Secure Session Management:** Cookie sesi dikonfigurasi dengan atribut `httpOnly: true` untuk mencegah pencurian sesi via skrip berbahaya.
* **Password Cryptography:** Enkripsi satu arah untuk kata sandi menggunakan algoritma `bcryptjs` dengan *salt rounds* 10.
* **Role-Based Access Control (RBAC):** Otentikasi dan otorisasi berlapis untuk memisahkan hak akses antara rute `Warga` dan `Admin`.

### 2. Network & Infrastructure Layer Security (Ubuntu & Nginx)
* **Nginx Reverse Proxy & Hardening:** Menyembunyikan arsitektur backend asli, menonaktifkan informasi versi server (`server_tokens off`), dan mengontrol header keamanan tambahan.
* **Host-Based Firewall (UFW):** Penutupan seluruh port jaringan yang tidak esensial, hanya membuka port 22 (SSH), 80 (HTTP), dan 3000 (Testing Node.js).
* **Fail2Ban Automation:** Pemblokiran otomatis terhadap IP penyerang yang melakukan aktivitas mencurigakan atau gagal login secara berulang.

### 3. Monitoring, Auditing & Alerting Layer
* **Suricata (Network IDS):** Deteksi dini aktivitas *reconnaissance* seperti *port scanning* (Nmap) atau *vulnerability scanning* (Nikto).
* **Wazuh SIEM Integration:** Sentralisasi log dari sistem operasi, Nginx (`access.log` & `error.log`), dan log internal aplikasi Node.js untuk analisis korelasi ancaman secara *real-time*.
* **Automated Telegram Bot Alert:** Pengiriman notifikasi insiden keamanan level tinggi langsung ke kanal Telegram tim saat serangan terdeteksi.

---

