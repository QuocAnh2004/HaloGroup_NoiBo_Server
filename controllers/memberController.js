
const { query } = require('../config/db');

exports.getAllMembers = async (req, res) => {
  try {
    // Chỉ lấy các trường cần thiết, không lấy password
    const members = await query('SELECT id, name, role, avatar_url, position, department_id, created_at FROM users ORDER BY created_at DESC');
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMembersWithTaskCount = async (req, res) => {
  try {
    const members = await query(`
      SELECT 
        u.id, u.name, u.role, u.avatar_url, u.position, u.department_id, u.created_at,
        d.name as departmentName, d.code as departmentCode,
        COALESCE(COUNT(CASE 
          WHEN ti.id IS NOT NULL AND (
            NOT EXISTS(SELECT 1 FROM check_items ci WHERE ci.item_id = ti.id) OR
            EXISTS(SELECT 1 FROM check_items ci WHERE ci.item_id = ti.id AND ci.completed = FALSE)
          ) THEN 1 
        END), 0) as task_count
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN task_item_assignments tia ON u.id = tia.user_id
      LEFT JOIN task_items ti ON tia.item_id = ti.id
      GROUP BY u.id, u.name, u.role, u.avatar_url, u.position, u.department_id, u.created_at, d.name, d.code
      ORDER BY u.created_at DESC
    `);

    // Format response với destructuring
    const result = members.map(({ departmentName, departmentCode, department_id, ...member }) => ({
      ...member,
      department: departmentName ? { id: department_id, name: departmentName, code: departmentCode } : null
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMemberById = async (req, res) => {
  try {
    const { id } = req.params;
    // Lấy full thông tin (trừ password) với thông tin phòng ban
    const users = await query(`
      SELECT u.id, u.name, u.role, u.avatar_url, u.created_at, 
             u.email, u.phone, u.position, u.level, u.department_id, u.skills, u.github_url,
             d.name as departmentName, d.code as departmentCode
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `, [id]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại.' });
    }

    const user = users[0];
    // Format response để include department object nếu có
    const response = {
      ...user,
      department: user.departmentName ? {
        id: user.department_id,
        name: user.departmentName,
        code: user.departmentCode
      } : null
    };

    // Remove the flat department fields
    delete response.departmentName;
    delete response.departmentCode;

    res.json(response);
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

// exports.updateMember = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, email, phone, position, level, department, skills, github_url } = req.body;

//     // Kiểm tra tồn tại
//     const existing = await query('SELECT id FROM users WHERE id = ?', [id]);
//     if (existing.length === 0) {
//       return res.status(404).json({ message: 'Nhân viên không tồn tại.' });
//     }

//     // Xây dựng query động hoặc update từng trường
//     const sql = `
//       UPDATE users 
//       SET name = ?, email = ?, phone = ?, position = ?, level = ?, department = ?, skills = ?, github_url = ?
//       WHERE id = ?
//     `;

//     await query(sql, [name, email, phone, position, level, department, skills, github_url, id]);

//     // Lấy lại thông tin đã update
//     const updatedUser = await query(`
//       SELECT id, name, role, avatar_url, created_at,
//              email, phone, position, level, department, skills, github_url
//       FROM users WHERE id = ?
//     `, [id]);

//     res.json(updatedUser[0]);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

exports.updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    // ✅ Đổi "department" → "department_id"
    const { name, email, phone, position, level, department_id, skills, github_url } = req.body;

    const dept = await query(
  'SELECT id FROM departments WHERE id = ?',
  [department_id]
);

if (department_id && dept.length === 0) {
  return res.status(400).json({ message: 'Department không tồn tại' });
}
    const existing = await query('SELECT id FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại.' });
    }

    // ✅ Đổi column "department" → "department_id" trong SQL
    const sql = `
      UPDATE users 
      SET name = ?, email = ?, phone = ?, position = ?, level = ?, department_id = ?, skills = ?, github_url = ?
      WHERE id = ?
    `;

    await query(sql, [name, email, phone, position, level, department_id, skills, github_url, id]);

    // ✅ SELECT lại đúng column
    const updatedUser = await query(`
      SELECT u.id, u.name, u.role, u.avatar_url, u.created_at,
             u.email, u.phone, u.position, u.level, u.department_id, u.skills, u.github_url,
             d.name as departmentName, d.code as departmentCode
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `, [id]);

    const user = updatedUser[0];
    const response = {
      ...user,
      department: user.departmentName
        ? { id: user.department_id, name: user.departmentName, code: user.departmentCode }
        : null
    };
    delete response.departmentName;
    delete response.departmentCode;

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
