console.log("✅ messageRoutes file loaded");

const router = require("express").Router();
const {
  getAllMessages,
  getConversationMessages,
  sendMessage,
  getMessageById,
  getUsersByIds
} = require("../controllers/messageController");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ Route cụ thể trước ("/") phải đặt TRƯỚC "/:userId"
router.get("/", authMiddleware, getAllMessages);
// router.get("/", getAllMessages);

// Chat giữa tôi và 1 user
router.get("/conversation/:userId", authMiddleware, getConversationMessages);

// router.get("/single/:userId", authMiddleware, getMessageById);
router.get("/chat-users", authMiddleware, getMessageById);

//lấy thông tin user theo danh sách id
router.post("/users/by-ids", authMiddleware, getUsersByIds);


// gửi tin nhắn (nếu dùng)
router.post("/", authMiddleware, sendMessage);

module.exports = router;
