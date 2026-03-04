
const express = require('express');
const cors = require('cors');
const http = require("http");          // 👈 THÊM DÒNG NÀY
const { checkConnection } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
// chat 

const messageRoutes = require('./routes/messageRoutes');

const { initStomp } = require("./socket/stomp"); // ✅ thêm

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/departments', departmentRoutes);

console.log("✅ messageRoutes mounted at /api/messages");

app.use('/api/messages', messageRoutes);


// Root Endpoint check
app.get('/', (req, res) => {
  res.send('Hola API Server is running...');
});

// Endpoint để kiểm tra kết nối DB thủ công
app.get('/api/test-db', async (req, res) => {
  const isConnected = await checkConnection();
  if (isConnected) {
    res.json({ status: 'success', message: 'Kết nối Database thành công!' });
  } else {
    res.status(500).json({ status: 'error', message: 'Không thể kết nối đến Database.' });
  }
});

// Start Server
// app.listen(PORT, async () => {
//   console.log(`Hola API Server running on http://localhost:${PORT}`);
//   // Kiểm tra kết nối DB ngay khi server khởi động
//   await checkConnection();
// });
// ✅ Tạo HTTP server (thay vì app.listen)
const server = http.createServer(app);

// ✅ Mount STOMP/SockJS at /ws
initStomp(server);

// ✅ Start server
server.listen(PORT, async () => {
  console.log(`Hola API Server running on http://localhost:${PORT}`);
  await checkConnection();
}); 
