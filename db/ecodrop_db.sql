-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.0.30 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.1.0.6537
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Dumping structure for table ecodrop_db.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('warga','petugas','admin') DEFAULT 'warga',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table ecodrop_db.users: ~5 rows (approximately)
INSERT INTO `users` (`id`, `username`, `password`, `role`, `created_at`) VALUES
	(1, 'reza', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'admin', '2026-06-07 13:02:24'),
	(2, 'zaza', '$2b$10$8HhOs2K5abuFsa6kMz.KeettmkBKQbA0aUVRjiKCay6Ly3j2cCpP.', 'warga', '2026-06-07 13:20:15'),
	(3, 'admin', 'admin', 'admin', '2026-06-07 14:21:48'),
	(4, 'reza_admin', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'admin', '2026-06-07 14:37:41'),
	(6, 'petugas', '$2b$10$r0Ly0dpnZtPjc4vAIeHDI.Ra3F0vu2bMm61rKf1WfVRR0fZSYmBim', 'warga', '2026-06-07 14:43:49');

-- Dumping structure for table ecodrop_db.waste_reports
CREATE TABLE IF NOT EXISTS `waste_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `waste_type` varchar(50) NOT NULL,
  `weight` float NOT NULL,
  `status` enum('Pending','Diverifikasi','Selesai') DEFAULT 'Pending',
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `waste_reports_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table ecodrop_db.waste_reports: ~21 rows (approximately)
INSERT INTO `waste_reports` (`id`, `user_id`, `waste_type`, `weight`, `status`, `description`, `created_at`) VALUES
	(1, 2, 'Organik (Sisa Makanan/Daun)', 54, 'Pending', 'awd', '2026-06-07 13:27:24'),
	(2, 2, 'Anorganik (Plastik/Kertas/Besi)', 1000000, 'Pending', 'awdawd', '2026-06-07 13:28:20'),
	(3, 2, 'Organik (Sisa Makanan/Daun)', 12, 'Pending', '', '2026-06-07 13:46:17'),
	(4, 2, 'Organik (Sisa Makanan/Daun)', 12, 'Pending', '', '2026-06-07 13:46:22'),
	(5, 2, 'Organik (Sisa Makanan/Daun)', 12, 'Pending', '', '2026-06-07 13:46:24'),
	(6, 2, 'Organik (Sisa Makanan/Daun)', 7, 'Pending', '', '2026-06-07 13:46:27'),
	(7, 2, 'Organik (Sisa Makanan/Daun)', 8, 'Pending', '', '2026-06-07 13:46:30'),
	(8, 2, 'Organik (Sisa Makanan/Daun)', 9, 'Pending', '', '2026-06-07 13:46:32'),
	(9, 2, 'Organik (Sisa Makanan/Daun)', 10, 'Pending', '', '2026-06-07 13:46:36'),
	(10, 2, 'Organik (Sisa Makanan/Daun)', 11, 'Pending', '', '2026-06-07 13:46:39'),
	(11, 2, 'Organik (Sisa Makanan/Daun)', 12, 'Pending', '', '2026-06-07 13:46:42'),
	(12, 2, 'Organik (Sisa Makanan/Daun)', 12, 'Pending', '', '2026-06-07 13:47:52'),
	(13, 2, 'Organik (Sisa Makanan/Daun)', 13, 'Pending', '', '2026-06-07 13:47:58'),
	(14, 2, 'Organik (Sisa Makanan/Daun)', 14, 'Pending', '', '2026-06-07 13:48:02'),
	(15, 2, 'Organik (Sisa Makanan/Daun)', 15, 'Pending', '', '2026-06-07 13:48:04'),
	(16, 2, 'Anorganik (Plastik/Kertas/Besi)', 16, 'Pending', '', '2026-06-07 13:48:08'),
	(17, 2, 'B3 (Baterai/Lampu/Elektronik)', 17, 'Pending', '', '2026-06-07 13:48:13'),
	(18, 2, 'Organik (Sisa Makanan/Daun)', 18, 'Pending', '', '2026-06-07 13:48:15'),
	(19, 2, 'Anorganik (Plastik/Kertas/Besi)', 200000, 'Pending', '', '2026-06-07 13:48:27'),
	(20, 2, 'Organik (Sisa Makanan/Daun)', 200000000000, 'Pending', '', '2026-06-07 13:48:38'),
	(21, 2, 'B3 (Baterai/Lampu/Elektronik)', 123, 'Pending', NULL, '2026-06-07 14:48:49');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
