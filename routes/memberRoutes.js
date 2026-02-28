
const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', memberController.getAllMembers);
router.get('/:id', memberController.getMemberById); // Route mới
router.post('/', memberController.createMember);
router.put('/:id', memberController.updateMember);
router.delete('/:id', memberController.deleteMember);
router.post('/:id/reset-password', memberController.resetPassword);

module.exports = router;
