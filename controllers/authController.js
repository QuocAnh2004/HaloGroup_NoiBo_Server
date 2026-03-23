
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
/////////////////////////////////////////////////// Thêm hàm xử lý callback Google OAuth vào authController.js
// authController.js — thêm vào cuối file
const axios = require('axios');

exports.googleCallback = async (req, res) => {
  try {


    const { code } = req.query;

    // 1. Đổi code lấy access_token từ Google
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `http://localhost:${process.env.PORT}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenRes.data;

    // 2. Lấy thông tin user từ Google
    const profileRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { email, name } = profileRes.data;

    // 3. Chỉ cho phép email nội bộ (bỏ dòng này nếu không cần lọc domain)
    // if (!email.endsWith('@holagroup.vn')) {
    //   return res.redirect(`${process.env.FRONTEND_URL}/login?error=unauthorized_email`);
    // }

    // 4. Tìm user trong DB theo email
    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];

    console.log('>>> Google email nhận được:', email); // THÊM DÒNG NÀY
    console.log('>>> Kết quả query:', users); // THÊM DÒNG NÀY


    // }
    if (!user) {
      // Không tự tạo — phải được Manager thêm vào hệ thống trước
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=account_not_found`);
    }



    // 5. Tạo JWT y hệt như login thường
    const { password: _, ...userInfo } = user;
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'hola_secret_key',
      { expiresIn: '24h' }
    );

    // 6. Redirect về FE kèm token và thông tin user
    const params = new URLSearchParams({
      token,
      id: String(user.id),
      role: user.role,
      name: user.name,
    });
    res.redirect(`${process.env.FRONTEND_URL}/#/auth-callback?${params}`);

  } catch (error) {
    console.error('Google OAuth error:', error.message);
    console.error('Google OAuth error:', error.response?.data || error.message);
    console.error('Google OAuth status:', error.response?.status);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
  }
};

