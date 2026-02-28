// socket/stomp.js
const sockjs = require("sockjs");
const StompServer = require("stomp-broker-js");

let stompServer = null;

function initStomp(httpServer) {
  // SockJS server
  const sockServer = sockjs.createServer();

  // STOMP broker
  stompServer = new StompServer({
    server: sockServer,
    path: "/ws", // ✅ FE đang dùng `${BASE_URL}ws`
    protocol: "sockjs",
  });

  // Attach SockJS to HTTP server
  sockServer.installHandlers(httpServer, { prefix: "/ws" });

  console.log("✅ STOMP/SockJS broker running at /ws");
  return stompServer;
}

function getChannelIdForUsers(user1Id, user2Id) {
  const sorted = [user1Id, user2Id].sort(); // sort theo thứ tự tăng dần
  return `${sorted[0]}-${sorted[1]}`;
}


function sendToChannelByUsers(user1Id, user2Id, payload) {
  if (!stompServer) return;
  const channelId = getChannelIdForUsers(user1Id, user2Id);
  const dest = `/topic/channel/${channelId}`;
  stompServer.send(dest, {}, JSON.stringify(payload));
}

/**
 * Gửi message tới inbox của user.
 * Client subscribe: `/user/{userId}/queue/messages`
 */
function sendToUser(userId, payload) {
  if (!stompServer) return;

  const dest = `/user/${userId}/queue/messages`;
  stompServer.send(dest, {}, JSON.stringify(payload));
}
// Gửi message tới topic chung (nếu cần)
module.exports = { initStomp, sendToUser,sendToChannelByUsers };