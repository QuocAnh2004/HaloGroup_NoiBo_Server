
const { query, pool } = require('../config/db');

// Helper: Format project data để giống với cấu trúc JSON frontend mong đợi
const formatProject = async (project) => {
  if (!project) return null;

  // Lấy Tech Stack
  const techs = await query('SELECT tech_name FROM project_tech_stacks WHERE project_id = ?', [project.id]);
  project.techStack = techs.map(t => t.tech_name);

  // Lấy Team Members
  const members = await query(`
    SELECT u.id, u.name, u.role, u.avatar_url 
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `, [project.id]);
  
  // Map avatar_url -> avatar để khớp frontend type
  project.teamMembers = members.map(m => ({
    ...m,
    avatar: m.avatar_url
  }));

  // Format dates về string YYYY-MM-DD nếu cần thiết, hoặc để nguyên ISO string từ DB
  // MySQL driver thường trả về Date object, frontend đang dùng string
  if (project.start_date) project.startDate = new Date(project.start_date).toISOString().split('T')[0];
  if (project.due_date) project.dueDate = new Date(project.due_date).toISOString().split('T')[0];
  
  // Mapping tên trường từ DB (snake_case) sang Frontend (camelCase)
  project.githubUrl = project.github_url;
  project.liveUrl = project.live_url;

  // Cleanup field thừa
  delete project.start_date;
  delete project.due_date;
  delete project.github_url;
  delete project.live_url;

  return project;
};

exports.getAllProjects = async (req, res) => {
  try {
    const projects = await query('SELECT * FROM projects ORDER BY created_at DESC');
    
    // Format từng project (N+1 query nhưng chấp nhận được với số lượng nhỏ)
    // Tối ưu hơn: Dùng Promise.all
    const formattedProjects = await Promise.all(projects.map(p => formatProject(p)));
    
    res.json(formattedProjects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

exports.createProject = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { 
      id: reqId, name, description, status, priority, 
      startDate, dueDate, progress, 
      techStack = [], teamMembers = [],
      githubUrl, liveUrl, category 
    } = req.body;

    const id = reqId || Date.now().toString();

    // Check trùng ID
    const [existing] = await connection.query('SELECT id FROM projects WHERE id = ?', [id]);
    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ message: 'ID dự án đã tồn tại' });
    }

    // Insert Project
    await connection.query(`
      INSERT INTO projects 
      (id, name, description, status, priority, start_date, due_date, progress, github_url, live_url, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, description, status, priority, startDate, dueDate, progress || 0, githubUrl, liveUrl, category]);

    // Insert Tech Stack
    if (techStack.length > 0) {
      const techValues = techStack.map(t => [id, t]);
      await connection.query('INSERT INTO project_tech_stacks (project_id, tech_name) VALUES ?', [techValues]);
    }

    // Insert Members
    if (teamMembers.length > 0) {
      const memberValues = teamMembers.map(m => [id, m.id]);
      await connection.query('INSERT INTO project_members (project_id, user_id) VALUES ?', [memberValues]);
    }

    await connection.commit();
    
    // Trả về data đã tạo (gọi lại formatProject hoặc trả về y nguyên req.body + id)
    res.status(201).json({ ...req.body, id });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
};

exports.updateProject = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const updates = req.body;

    // Check tồn tại
    const [projects] = await connection.query('SELECT id FROM projects WHERE id = ?', [id]);
    if (projects.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Project not found' });
    }

    // Update bảng chính (Xây dựng câu query động)
    const fieldsToUpdate = [];
    const values = [];

    if (updates.name !== undefined) { fieldsToUpdate.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { fieldsToUpdate.push('description = ?'); values.push(updates.description); }
    if (updates.status !== undefined) { fieldsToUpdate.push('status = ?'); values.push(updates.status); }
    if (updates.priority !== undefined) { fieldsToUpdate.push('priority = ?'); values.push(updates.priority); }
    if (updates.startDate !== undefined) { fieldsToUpdate.push('start_date = ?'); values.push(updates.startDate); }
    if (updates.dueDate !== undefined) { fieldsToUpdate.push('due_date = ?'); values.push(updates.dueDate); }
    if (updates.progress !== undefined) { fieldsToUpdate.push('progress = ?'); values.push(updates.progress); }
    if (updates.githubUrl !== undefined) { fieldsToUpdate.push('github_url = ?'); values.push(updates.githubUrl); }
    if (updates.liveUrl !== undefined) { fieldsToUpdate.push('live_url = ?'); values.push(updates.liveUrl); }

    if (fieldsToUpdate.length > 0) {
      values.push(id); // Cho WHERE clause
      await connection.query(`UPDATE projects SET ${fieldsToUpdate.join(', ')} WHERE id = ?`, values);
    }

    // Update Tech Stack (Xóa hết cũ thêm mới nếu có gửi lên)
    if (updates.techStack !== undefined) {
      await connection.query('DELETE FROM project_tech_stacks WHERE project_id = ?', [id]);
      if (updates.techStack.length > 0) {
        const techValues = updates.techStack.map(t => [id, t]);
        await connection.query('INSERT INTO project_tech_stacks (project_id, tech_name) VALUES ?', [techValues]);
      }
    }

    // Update Members (Xóa hết cũ thêm mới nếu có gửi lên)
    if (updates.teamMembers !== undefined) {
      await connection.query('DELETE FROM project_members WHERE project_id = ?', [id]);
      if (updates.teamMembers.length > 0) {
        const memberValues = updates.teamMembers.map(m => [id, m.id]);
        await connection.query('INSERT INTO project_members (project_id, user_id) VALUES ?', [memberValues]);
      }
    }

    await connection.commit();

    // Lấy lại dữ liệu đầy đủ để trả về
    const [freshData] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    const formatted = await formatProject(freshData[0]);
    res.json(formatted);

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    // Nhờ ON DELETE CASCADE trong MySQL, việc xóa project sẽ tự xóa các bảng con liên quan
    const result = await query('DELETE FROM projects WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Notifications Logic ---

exports.getNotifications = async (req, res) => {
  try {
    const { id } = req.params; // project_id
    const notifications = await query('SELECT * FROM project_notifications WHERE project_id = ? ORDER BY created_at DESC', [id]);
    
    // Map snake_case to camelCase for frontend
    const formatted = notifications.map(n => ({
      id: n.id,
      projectId: n.project_id,
      content: n.content,
      type: n.type,
      targetMemberId: n.target_member_id,
      senderName: n.sender_name,
      createdAt: n.created_at
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { content, type, targetMemberId, senderName } = req.body;
    
    const id = Date.now().toString(); // Simple ID generation
    
    await query(
      'INSERT INTO project_notifications (id, project_id, content, type, target_member_id, sender_name) VALUES (?, ?, ?, ?, ?, ?)',
      [id, projectId, content, type, targetMemberId || null, senderName || req.user.name]
    );

    // Lấy lại tin vừa tạo để trả về đầy đủ format
    const [newNotif] = await query('SELECT * FROM project_notifications WHERE id = ?', [id]);
    
    res.status(201).json({
      id: newNotif.id,
      projectId: newNotif.project_id,
      content: newNotif.content,
      type: newNotif.type,
      targetMemberId: newNotif.target_member_id,
      senderName: newNotif.sender_name,
      createdAt: newNotif.created_at
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
