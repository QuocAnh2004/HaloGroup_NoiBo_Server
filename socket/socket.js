// socket/socket.js
const { Server } = require("socket.io");

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`⚡ User connected: ${socket.id}`);

    // User tham gia phòng cá nhân (để nhận notify + inbox)
    socket.on("join_private", (userId) => {
      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined their private room`);
    });

    // User mở một cuộc hội thoại cụ thể
    socket.on("join_chat", (pairId) => {
      socket.join(`chat_${pairId}`);
      console.log(`💬 Joined chat room: ${pairId}`);
    });

    // ✅ FIX: Lắng nghe event 'chat_message' từ FE và broadcast cho cả phòng
    // FE gửi: socket.emit("chat_message", { pairId, payload })
    // Server broadcast lại cho tất cả trong room (kể cả sender để đồng bộ)
    socket.on("chat_message", ({ pairId, payload }) => {
      if (!pairId || !payload) return;
      console.log(`📨 chat_message in room chat_${pairId}:`, payload);

      // Dùng io.to thay vì socket.to để sender cũng nhận được (dùng để dedupe phía FE)
      // Nếu muốn sender KHÔNG nhận lại (vì đã optimistic), dùng socket.to(...)
      io.to(`chat_${pairId}`).emit("receive_message", payload);
    });

    socket.on("disconnect", () => {
      console.log("🔥 User disconnected:", socket.id);
    });
  });

  return io;
}

function getChannelIdForUsers(user1Id, user2Id) {
  const sorted = [String(user1Id), String(user2Id)].sort();
  return `${sorted[0]}-${sorted[1]}`;
}

// Gửi tin nhắn vào box chat chung của 2 người (gọi từ API controller sau khi lưu DB)
function sendToPublicByUsers(userA, userB, payload) {
  if (!io) return;
  const pairId = getChannelIdForUsers(userA, userB);
  io.to(`chat_${pairId}`).emit("receive_message", payload);
}

// Gửi thông báo riêng cho 1 user
function sendToNotify(userId, payload) {
  if (!io) return;
  io.to(`user_${userId}`).emit("notify", payload);
}

// Gửi tới inbox cá nhân
function sendToUser(userId, payload) {
  if (!io) return;
  io.to(`user_${userId}`).emit("inbox", payload);
}

module.exports = { initSocket, sendToUser, sendToPublicByUsers, sendToNotify };