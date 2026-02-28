
const { query, pool } = require('../config/db');

// Helper: Chuyển đổi ngày tháng an toàn cho MySQL (YYYY-MM-DD HH:mm:ss.ms)
const toMySQLDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    // Giữ lại mili-giây (.slice(0, 23)) để sắp xếp chính xác hơn
    return date.toISOString().slice(0, 23).replace('T', ' ');
  } catch (e) {
    console.error("Date parse error:", e);
    return null;
  }
};

// Helper: Tái cấu trúc cây dữ liệu từ các bảng phẳng
const getFullTaskTree = async (projectId) => {
  // 1. Lấy tất cả Groups
  const groups = await query('SELECT * FROM task_groups WHERE project_id = ? ORDER BY created_at ASC', [projectId]);
  if (!groups || groups.length === 0) return [];

  const groupIds = groups.map(g => g.id);

  // 2. Lấy Assignments cho Groups
  let groupAssignments = [];
  if (groupIds.length > 0) {
    groupAssignments = await query(`SELECT * FROM task_group_assignments WHERE group_id IN (?)`, [groupIds]);
  }

  // 3. Lấy tất cả Items
  let items = [];
  if (groupIds.length > 0) {
    items = await query(`SELECT * FROM task_items WHERE group_id IN (?) ORDER BY created_at ASC`, [groupIds]);
  }
  
  const itemIds = items.map(i => i.id);

  // 4. Lấy Assignments và Checks cho Items
  let itemAssignments = [];
  let checks = [];
  
  if (itemIds.length > 0) {
    itemAssignments = await query(`SELECT * FROM task_item_assignments WHERE item_id IN (?)`, [itemIds]);
    checks = await query(`SELECT * FROM check_items WHERE item_id IN (?) ORDER BY created_at ASC`, [itemIds]);
  }

  // 5. Ráp dữ liệu (Mapping)
  const result = groups.map(g => {
    const gAssignments = groupAssignments
      .filter(a => a.group_id === g.id)
      .map(a => a.user_id);

    const gItems = items
      .filter(i => i.group_id === g.id)
      .map(i => {
        const iAssignments = itemAssignments
          .filter(a => a.item_id === i.id)
          .map(a => a.user_id);

        const iChecks = checks
          .filter(c => c.item_id === i.id)
          .map(c => ({
            id: c.id,
            title: c.title,
            completed: Boolean(c.completed),
            createdAt: c.created_at
          }));

        return {
          id: i.id,
          title: i.title,
          description: i.description,
          estimatedTime: i.estimated_time ? new Date(i.estimated_time).toISOString() : null,
          lateReason: i.late_reason,
          assignedMemberIds: iAssignments,
          checkItems: iChecks,
          createdAt: i.created_at
        };
      });

    return {
      id: g.id,
      title: g.title,
      description: g.description,
      estimatedTime: g.estimated_time ? new Date(g.estimated_time).toISOString() : null,
      lateReason: g.late_reason,
      assignedMemberIds: gAssignments,
      taskItems: gItems,
      createdAt: g.created_at
    };
  });

  return result;
};

exports.getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const user = req.user; 

    if (user.role !== 'MANAGER') {
      const membership = await query(
        'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
        [projectId, user.id]
      );
      if (membership.length === 0) {
        return res.status(403).json({ message: 'Bạn không phải là thành viên của dự án này.' });
      }
    }

    const tasks = await getFullTaskTree(projectId);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ message: error.message });
  }
};

// --- GROUP HANDLERS ---

exports.addGroup = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { projectId } = req.params;
    const { id, title, description, estimatedTime, assignedMemberIds = [], lateReason, createdAt } = req.body;
    const validEstimatedTime = toMySQLDate(estimatedTime);
    
    // Nếu client gửi createdAt (có mili-giây), dùng nó. Nếu không, để DB tự sinh (NOW).
    const validCreatedAt = createdAt ? toMySQLDate(createdAt) : null;

    // Insert Group
    if (validCreatedAt) {
        await connection.query(
          'INSERT INTO task_groups (id, project_id, title, description, estimated_time, late_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, projectId, title, description, validEstimatedTime, lateReason || null, validCreatedAt]
        );
    } else {
        await connection.query(
          'INSERT INTO task_groups (id, project_id, title, description, estimated_time, late_reason) VALUES (?, ?, ?, ?, ?, ?)',
          [id, projectId, title, description, validEstimatedTime, lateReason || null]
        );
    }

    // Insert Assignments
    if (assignedMemberIds && assignedMemberIds.length > 0) {
      const values = assignedMemberIds.map(uid => [id, uid]);
      await connection.query('INSERT INTO task_group_assignments (group_id, user_id) VALUES ?', [values]);
    }

    await connection.commit();
    res.status(201).json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error("Error adding group:", err);
    res.status(500).json({ message: err.message });
  } finally {
    connection.release();
  }
};

exports.updateGroup = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { groupId } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.lateReason !== undefined) { fields.push('late_reason = ?'); values.push(updates.lateReason); }
    if (updates.estimatedTime !== undefined) { 
      fields.push('estimated_time = ?'); 
      values.push(toMySQLDate(updates.estimatedTime)); 
    }

    if (fields.length > 0) {
      values.push(groupId);
      await connection.query(`UPDATE task_groups SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (updates.assignedMemberIds !== undefined) {
      await connection.query('DELETE FROM task_group_assignments WHERE group_id = ?', [groupId]);
      if (updates.assignedMemberIds.length > 0) {
        const vals = updates.assignedMemberIds.map(uid => [groupId, uid]);
        await connection.query('INSERT INTO task_group_assignments (group_id, user_id) VALUES ?', [vals]);
      }
    }

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error("Error updating group:", err);
    res.status(500).json({ message: err.message });
  } finally {
    connection.release();
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    await query('DELETE FROM task_groups WHERE id = ?', [groupId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting group:", error);
    res.status(500).json({ message: error.message });
  }
};

// --- ITEM HANDLERS ---

exports.addItem = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { groupId } = req.params;
    const { id, title, description, estimatedTime, assignedMemberIds = [], lateReason, createdAt } = req.body;
    const validEstimatedTime = toMySQLDate(estimatedTime);
    const validCreatedAt = createdAt ? toMySQLDate(createdAt) : null;

    // Insert Item
    if (validCreatedAt) {
        await connection.query(
          'INSERT INTO task_items (id, group_id, title, description, estimated_time, late_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, groupId, title, description, validEstimatedTime, lateReason || null, validCreatedAt]
        );
    } else {
        await connection.query(
          'INSERT INTO task_items (id, group_id, title, description, estimated_time, late_reason) VALUES (?, ?, ?, ?, ?, ?)',
          [id, groupId, title, description, validEstimatedTime, lateReason || null]
        );
    }

    // Insert Assignments
    if (assignedMemberIds && assignedMemberIds.length > 0) {
      const values = assignedMemberIds.map(uid => [id, uid]);
      await connection.query('INSERT INTO task_item_assignments (item_id, user_id) VALUES ?', [values]);
    }

    await connection.commit();
    res.status(201).json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error("Error adding item:", err);
    res.status(500).json({ message: err.message });
  } finally {
    connection.release();
  }
};

exports.updateItem = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { itemId } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.lateReason !== undefined) { fields.push('late_reason = ?'); values.push(updates.lateReason); }
    if (updates.estimatedTime !== undefined) { 
      fields.push('estimated_time = ?'); 
      values.push(toMySQLDate(updates.estimatedTime)); 
    }

    if (fields.length > 0) {
      values.push(itemId);
      await connection.query(`UPDATE task_items SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (updates.assignedMemberIds !== undefined) {
      await connection.query('DELETE FROM task_item_assignments WHERE item_id = ?', [itemId]);
      if (updates.assignedMemberIds.length > 0) {
        const vals = updates.assignedMemberIds.map(uid => [itemId, uid]);
        await connection.query('INSERT INTO task_item_assignments (item_id, user_id) VALUES ?', [vals]);
      }
    }

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error("Error updating item:", err);
    res.status(500).json({ message: err.message });
  } finally {
    connection.release();
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    await query('DELETE FROM task_items WHERE id = ?', [itemId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ message: error.message });
  }
};

// --- CHECK HANDLERS ---

exports.addCheck = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { id, title, completed } = req.body;
    
    const isCompleted = completed ? 1 : 0;

    await query(
      'INSERT INTO check_items (id, item_id, title, completed) VALUES (?, ?, ?, ?)',
      [id, itemId, title, isCompleted]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error adding check:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateCheck = async (req, res) => {
  try {
    const { checkId } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.completed !== undefined) { 
      fields.push('completed = ?'); 
      values.push(updates.completed ? 1 : 0); 
    }

    if (fields.length > 0) {
      values.push(checkId);
      await query(`UPDATE check_items SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating check:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCheck = async (req, res) => {
  try {
    const { checkId } = req.params;
    await query('DELETE FROM check_items WHERE id = ?', [checkId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting check:", error);
    res.status(500).json({ message: error.message });
  }
};
