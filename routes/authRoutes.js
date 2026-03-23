
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/login', authController.login);

// Quan trọng: Bỏ verifyToken ở đây để cho phép người dùng đổi mật khẩu 
// khi chưa đăng nhập (miễn là họ nhớ mật khẩu cũ và ID)
router.post('/change-password', authController.changePassword);


// --- Thêm 2 route Google OAuth ---
// Route 1: FE redirect user đến đây → BE chuyển tiếp sang Google
router.get('/google', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `http://localhost:${process.env.PORT}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Route 2: Google gọi về đây sau khi user chọn tài khoản
router.get('/google/callback', authController.googleCallback);

module.exports = router;
