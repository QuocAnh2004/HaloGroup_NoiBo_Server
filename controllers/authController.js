
const { query } = require('../config/db');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  try {
    const { id, password } = req.body;
    
    const users = await query('SELECT * FROM users WHERE id = ?', [id]);
    const user = users[0];

    if (user && user.password === password) {
      const { password: _, ...userInfo } = user;
      
      // Tạo Token, hết hạn sau 24h
      const token = jwt.sign(
        { id: user.id, role: user.role, name: user.name },
        process.env.JWT_SECRET || 'hola_secret_key',
        { expiresIn: '24h' }
      );

      // Trả về user info kèm token
      res.json({ ...userInfo, token });
    } else {
      res.status(401).json({ message: 'ID hoặc mật khẩu không chính xác.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server khi đăng nhập.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { id, currentPassword, newPassword } = req.body;

    // Logic kiểm tra quyền hạn:
    // 1. Nếu req.user tồn tại (đã login), kiểm tra xem có phải chính chủ hoặc Manager không.
    // 2. Nếu req.user KHÔNG tồn tại (chưa login - đổi pass từ màn hình login), bỏ qua check này 
    //    và dựa hoàn toàn vào việc khớp 'currentPassword' ở bước dưới.
    if (req.user) {
        if (req.user.id !== id && req.user.role !== 'MANAGER') {
            return res.status(403).json({ message: 'Không có quyền đổi mật khẩu người khác.' });
        }
    }

    const users = await query('SELECT password FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Tài khoản không tồn tại.' });
    }

    const user = users[0];
    // Kiểm tra mật khẩu cũ (Bắt buộc cho cả 2 trường hợp)
    if (user.password !== currentPassword) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng.' });
    }

    await query('UPDATE users SET password = ? WHERE id = ?', [newPassword, id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server khi đổi mật khẩu.' });
  }
};
