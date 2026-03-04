const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const verifyToken = require('../middleware/authMiddleware');

// Áp dụng middleware authentication cho tất cả routes
router.use(verifyToken);

// Department routes
router.get('/', departmentController.getAllDepartments);
router.get('/:id', departmentController.getDepartmentById);
router.post('/', departmentController.createDepartment);
router.put('/:id', departmentController.updateDepartment);
router.delete('/:id', departmentController.deleteDepartment);

// Department members
router.get('/:id/members', departmentController.getDepartmentMembers);

module.exports = router;