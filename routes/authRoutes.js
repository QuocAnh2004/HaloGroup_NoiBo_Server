
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/login', authController.login);

// Quan trọng: Bỏ verifyToken ở đây để cho phép người dùng đổi mật khẩu 
// khi chưa đăng nhập (miễn là họ nhớ mật khẩu cũ và ID)
router.post('/change-password', authController.changePassword);

module.exports = router;
