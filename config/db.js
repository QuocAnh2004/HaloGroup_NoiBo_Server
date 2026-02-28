
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Cấu hình SSL nếu có đường dẫn CA certificate
let sslConfig = undefined;
if (process.env.DB_SSL_CA) {
  try {
    // Đọc file ca.pem từ đường dẫn đã cấu hình
    // Nếu chạy trong Docker, đảm bảo file này đã được COPY vào
    const caPath = path.resolve(__dirname, '..', process.env.DB_SSL_CA);
    if (fs.existsSync(caPath)) {
      sslConfig = {
        ca: fs.readFileSync(caPath),
        rejectUnauthorized: true // Aiven yêu cầu xác thực SSL
      };
    } else {
      console.warn(`Warning: SSL CA file not found at ${caPath}`);
    }
  } catch (err) {
    console.warn("Warning: Could not load SSL CA certificate:", err.message);
  }
}

// Tạo connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  ssl: sslConfig // Thêm cấu hình SSL vào pool
});

const query = async (sql, params) => {
  const [results, ] = await pool.query(sql, params);
  return results;
};

// Hàm kiểm tra kết nối
const checkConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully to:', process.env.DB_HOST);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

module.exports = { pool, query, checkConnection };
