const { query } = require("../config/db");
const { sendToUser, sendToChannelByUsers } = require("../socket/stomp");

// const sendMessage = async (req, res) => {
//   const { receiver_id, content } = req.body;
//   const sender_id = req.user.id;

//   try {
//     const sql = `
//       INSERT INTO messages (sender_id, receiver_id, content)
//       VALUES (?, ?, ?)
//     `;
//     await query(sql, [sender_id, receiver_id, content]);
//     return res.json({ message: "Message sent" });
//   } catch (err) {
//     console.error("❌ sendMessage error:", err);
//     return res.status(500).json({ error: err.message });
//   }
// };
// const { query } = require("../config/db");

// const sendMessage = async (req, res) => {
//   const { receiver_id, content } = req.body;
//   const sender_id = req.user?.id;

//   if (!sender_id) return res.status(401).json({ error: "Unauthorized" });
//   if (!receiver_id) return res.status(400).json({ error: "receiver_id is required" });

//   const text = String(content ?? "").trim();
//   if (!text) return res.status(400).json({ error: "content is required" });

//   try {
//     const insertSql = `
//       INSERT INTO messages (sender_id, receiver_id, content)
//       VALUES (?, ?, ?)
//     `;

//     const result = await query(insertSql, [sender_id, receiver_id, text]);

//     // result.insertId (mysql2) - nếu query wrapper của bạn trả như mysql2
//     const insertedId = result?.insertId;

//     if (!insertedId) {
//       // fallback: vẫn trả ok nếu wrapper không có insertId
//       return res.json({ message: "Message sent" });
//     }

//     const selectSql = `SELECT * FROM messages WHERE message_id = ? LIMIT 1`;
//     const rows = await query(selectSql, [insertedId]);

//     return res.json(rows?.[0] ?? { message_id: insertedId, sender_id, receiver_id, content: text });
//   } catch (err) {
//     console.error("❌ sendMessage error:", err);
//     return res.status(500).json({ error: err.message });
//   }
// };

const sendMessage = async (req, res) => {
  const { receiver_id, content } = req.body;
  const sender_id = req.user?.id;

  if (!sender_id) return res.status(401).json({ error: "Unauthorized" });
  if (!receiver_id) return res.status(400).json({ error: "receiver_id is required" });

  const text = String(content ?? "").trim();
  if (!text) return res.status(400).json({ error: "content is required" });

  try {
    // 1️⃣ Insert DB
    const insertSql = `
      INSERT INTO messages (sender_id, receiver_id, content)
      VALUES (?, ?, ?)
    `;
    const result = await query(insertSql, [sender_id, receiver_id, text]);

    const insertedId = result?.insertId;

    // 2️⃣ Tạo object message (fallback)
    let created = {
      message_id: insertedId ?? null,
      sender_id,
      receiver_id,
      content: text,
      created_at: new Date().toISOString(),
    };

    // 3️⃣ Nếu có insertId → lấy message thật từ DB
    if (insertedId) {
      const rows = await query(
        `SELECT * FROM messages WHERE message_id = ? LIMIT 1`,
        [insertedId]
      );
      if (rows?.[0]) created = rows[0];
    }

    // ===============================
    // 4️⃣ 🔥 REALTIME WEBSOCKET 🔥
    // ===============================

    // Gửi cho người nhận
    // sendToUser(String(receiver_id), created);
    sendToChannel(channelId, created);  // gửi tới channel

    // (Optional) gửi lại cho sender (sync nhiều tab)
    // sendToUser(String(sender_id), created);

    // 5️⃣ Trả response cho REST
    return res.json(created);

  } catch (err) {
    console.error("❌ sendMessage error:", err);
    return res.status(500).json({ error: err.message });
  }
};


// ✅ GET ALL
const getAllMessages = async (req, res) => {
  try {
    const sql = `SELECT * FROM messages ORDER BY created_at DESC`;
    const data = await query(sql);

    console.log("✅ getAllMessages total:", data.length);
    return res.json(data);
  } catch (err) {
    console.error("❌ getAllMessages error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ✅ GET conversation between me and userId
const getConversationMessages = async (req, res) => {
  const { userId } = req.params;
  const myId = req.user.id;

  try {
    const sql = `
      SELECT * FROM messages
      WHERE (sender_id = ? AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `;
    const data = await query(sql, [myId, userId, userId, myId]);

    console.log("getConversationMessages dataaaaaaaaaa:", data);
    return res.json(data);
  } catch (err) {
    console.error("❌ getConversationMessages error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// // ✅ GET single message by ID
// const getMessageById = async (req, res) => {
//   // const { id } = 1024; // Lấy ID tin nhắn từ URL
//   const { id } = req.params; // Lấy ID tin nhắn từ URL

//   try {
//     const sql = `SELECT * FROM messages WHERE sender_id = ?`;
//     const data = await query(sql, [id]);

//     if (data.length === 0) {
//       return res.status(404).json({ message: "Không tìm thấy tin nhắn này." });
//     }

//     console.log("✅ getMessageById success:", id);
//     return res.json(data[0]); // Trả về đối tượng tin nhắn đầu tiên tìm thấy
//   } catch (err) {
//     console.error("❌ getMessageById error:", err);
//     return res.status(500).json({ error: err.message });
//   }
// };

const getMessageById = async (req, res) => {
// const { id } = req.params;
const id = req.user.id;
    //  SELECT * FROM MESSAGES WHERE sender_id = ?;

  try {
    const sql = `
      SELECT DISTINCT
        CASE
          WHEN sender_id = ? THEN receiver_id
          ELSE sender_id
        END AS userId
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?

    `;

    const data = await query(sql, [id, id, id]);

    res.json(data);
  } catch (err) {
    console.error("❌ getChatUsers error:", err);
    res.status(500).json({ error: err.message });
  }
};

const getUsersByIds = async (req, res) => {
  const { ids } = req.body; // ["4592","8831","1024"]

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.json([]);
  }

  try {
    const placeholders = ids.map(() => "?").join(",");

    const sql = `
       SELECT 
        id AS userId,
        name AS name,
        avatar_url AS avatar
      FROM users
      WHERE id IN (${placeholders})
    `;

    const data = await query(sql, ids);
    return res.json(data);
  } catch (err) {
    console.error("❌ getUsersByIds error:", err);
    return res.status(500).json({ error: err.message });
  }
};


// module.exports = { sendMessage, getAllMessages, getConversationMessages, getMessageById,getUsersByIds };



module.exports = {
  sendMessage,
  getAllMessages,
  getConversationMessages,
  getMessageById,
  getUsersByIds,
};