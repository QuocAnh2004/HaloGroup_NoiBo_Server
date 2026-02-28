
const { query } = require('../config/db');

exports.getAllMembers = async (req, res) => {
  try {
    // Chỉ lấy các trường cần thiết, không lấy password
    const members = await query('SELECT id, name, role, avatar_url, position, department, created_at FROM users ORDER BY created_at DESC');
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMemberById = async (req, res) => {
  try {
    const { id } = req.params;
    // Lấy full thông tin (trừ password)
    const users = await query(`
      SELECT id, name, role, avatar_url, created_at, 
             email, phone, position, level, department, skills, github_url 
      FROM users WHERE id = ?
    `, [id]);
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại.' });
    }

    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createMember = async (req, res) => {
  try {
    const { id, name, password, role, avatar_url } = req.body;

    // Kiểm tra trùng ID
    const existing = await query('SELECT id FROM users WHERE id = ?', [id]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Mã nhân viên đã tồn tại.' });
    }

    const finalPassword = password || '123';
    const finalRole = role || 'MEMBER';

    await query(
      'INSERT INTO users (id, name, password, role, avatar_url) VALUES (?, ?, ?, ?, ?)',
      [id, name, finalPassword, finalRole, avatar_url || null]
    );

    res.status(201).json({ id, name, role: finalRole, avatar_url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, position, level, department, skills, github_url } = req.body;

    // Kiểm tra tồn tại
    const existing = await query('SELECT id FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại.' });
    }

    // Xây dựng query động hoặc update từng trường
    const sql = `
      UPDATE users 
      SET name = ?, email = ?, phone = ?, position = ?, level = ?, department = ?, skills = ?, github_url = ?
      WHERE id = ?
    `;
    
    await query(sql, [name, email, phone, position, level, department, skills, github_url, id]);

    // Lấy lại thông tin đã update
    const updatedUser = await query(`
      SELECT id, name, role, avatar_url, created_at,
             email, phone, position, level, department, skills, github_url
      FROM users WHERE id = ?
    `, [id]);
    
    res.json(updatedUser[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteMember = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra role trước khi xóa
    const users = await query('SELECT role FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại.' });
    }

    if (users[0].role === 'MANAGER') {
      return res.status(403).json({ message: 'Không thể xóa tài khoản Quản lý.' });
    }

    await query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Sử dụng trim() để tránh lỗi nếu ID có khoảng trắng thừa
    const cleanId = id.toString().trim();

    // Thực hiện update
    const result = await query("UPDATE users SET password = '123' WHERE id = ?", [cleanId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại.' });
    }

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: error.message });
  }
};
