
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  // Lấy token từ header: "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Truy cập bị từ chối. Vui lòng đăng nhập.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hola_secret_key');
    req.user = decoded; // Lưu thông tin user vào request để dùng ở controller
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
};

module.exports = verifyToken;
