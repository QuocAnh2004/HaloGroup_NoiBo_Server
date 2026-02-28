
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const verifyToken = require('../middleware/authMiddleware');

// Public route (nếu muốn cho xem danh sách mà không cần login thì bỏ verifyToken ở get)
// Ở đây ta bảo vệ toàn bộ
router.get('/', verifyToken, projectController.getAllProjects);
router.post('/', verifyToken, projectController.createProject);
router.put('/:id', verifyToken, projectController.updateProject);
router.delete('/:id', verifyToken, projectController.deleteProject);

// --- Notification Routes ---
router.get('/:id/notifications', verifyToken, projectController.getNotifications);
router.post('/:id/notifications', verifyToken, projectController.createNotification);

module.exports = router;
