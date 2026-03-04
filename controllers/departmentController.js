const { query } = require('../config/db');

exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await query(`
      SELECT d.*, u.name as managerName 
      FROM departments d 
      LEFT JOIN users u ON d.manager_id = u.id 
      ORDER BY d.name ASC
    `);
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const departments = await query(`
      SELECT d.*, u.name as managerName 
      FROM departments d 
      LEFT JOIN users u ON d.manager_id = u.id 
      WHERE d.id = ?
    `, [id]);
    
    if (departments.length === 0) {
      return res.status(404).json({ message: 'Phòng ban không tồn tại.' });
    }

    res.json(departments[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { id, name, code, description, managerId } = req.body;

    // Kiểm tra trùng ID hoặc code
    const existing = await query('SELECT id FROM departments WHERE id = ? OR code = ?', [id, code]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'ID hoặc mã phòng ban đã tồn tại.' });
    }

    // Validate manager exists if provided
    if (managerId) {
      const manager = await query('SELECT id FROM users WHERE id = ? AND role = ?', [managerId, 'MANAGER']);
      if (manager.length === 0) {
        return res.status(400).json({ message: 'Manager không tồn tại hoặc không có quyền quản lý.' });
      }
    }

    const finalId = id || `d${Date.now()}`;

    await query(
      'INSERT INTO departments (id, name, code, description, manager_id) VALUES (?, ?, ?, ?, ?)',
      [finalId, name, code, description, managerId || null]
    );

    // Trả về department vừa tạo
    const newDept = await query(`
      SELECT d.*, u.name as managerName 
      FROM departments d 
      LEFT JOIN users u ON d.manager_id = u.id 
      WHERE d.id = ?
    `, [finalId]);

    res.status(201).json(newDept[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, managerId, status } = req.body;

    // Validate manager exists if provided
    if (managerId) {
      const manager = await query('SELECT id FROM users WHERE id = ? AND role = ?', [managerId, 'MANAGER']);
      if (manager.length === 0) {
        return res.status(400).json({ message: 'Manager không tồn tại hoặc không có quyền quản lý.' });
      }
    }

    await query(
      `UPDATE departments SET 
       name = COALESCE(?, name),
       code = COALESCE(?, code), 
       description = COALESCE(?, description),
       manager_id = COALESCE(?, manager_id),
       status = COALESCE(?, status),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, code, description, managerId, status, id]
    );

    // Trả về department đã cập nhật
    const updated = await query(`
      SELECT d.*, u.name as managerName 
      FROM departments d 
      LEFT JOIN users u ON d.manager_id = u.id 
      WHERE d.id = ?
    `, [id]);

    if (updated.length === 0) {
      return res.status(404).json({ message: 'Phòng ban không tồn tại.' });
    }

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra có nhân viên nào đang thuộc phòng ban này không
    const members = await query('SELECT COUNT(*) as count FROM users WHERE department_id = ?', [id]);
    if (members[0].count > 0) {
      return res.status(400).json({ 
        message: `Không thể xóa phòng ban vì còn ${members[0].count} nhân viên đang thuộc phòng ban này.` 
      });
    }

    const result = await query('DELETE FROM departments WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Phòng ban không tồn tại.' });
    }

    res.json({ success: true, message: 'Xóa phòng ban thành công.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDepartmentMembers = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra department có tồn tại không
    const dept = await query('SELECT id FROM departments WHERE id = ?', [id]);
    if (dept.length === 0) {
      return res.status(404).json({ message: 'Phòng ban không tồn tại.' });
    }

    const members = await query(`
      SELECT id, name, role, avatar_url, position, level, email, phone, skills, github_url, created_at
      FROM users 
      WHERE department_id = ? 
      ORDER BY role DESC, name ASC
    `, [id]);

    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};