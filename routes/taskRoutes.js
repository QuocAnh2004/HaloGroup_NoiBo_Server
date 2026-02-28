
const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const verifyToken = require('../middleware/authMiddleware');

// Áp dụng middleware cho tất cả các route tasks
router.use(verifyToken);

// Lấy toàn bộ task của dự án
router.get('/:projectId', taskController.getTasksByProject);

// --- GROUPS ---
router.post('/:projectId/groups', taskController.addGroup);
router.put('/:projectId/groups/:groupId', taskController.updateGroup);
router.delete('/:projectId/groups/:groupId', taskController.deleteGroup);

// --- ITEMS ---
router.post('/:projectId/groups/:groupId/items', taskController.addItem);
router.put('/:projectId/groups/:groupId/items/:itemId', taskController.updateItem);
router.delete('/:projectId/groups/:groupId/items/:itemId', taskController.deleteItem);

// --- CHECKS ---
router.post('/:projectId/groups/:groupId/items/:itemId/checks', taskController.addCheck);
router.put('/:projectId/groups/:groupId/items/:itemId/checks/:checkId', taskController.updateCheck);
router.delete('/:projectId/groups/:groupId/items/:itemId/checks/:checkId', taskController.deleteCheck);

module.exports = router;
