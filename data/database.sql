
-- =====================================
-- Encoding (OK cho tiếng Việt)
-- =====================================
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- =====================================
-- Aiven: sử dụng database có sẵn
-- =====================================
-- =====================================
create database newdb3;
USE newdb3;

-- =====================================
-- 1. Bảng Departments
-- =====================================
CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) UNIQUE,
    description TEXT,
    manager_id VARCHAR(50),
    status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    -- Bỏ foreign key manager_id tham chiếu users ở dây vì users chưa được tạo, 
    -- ta sẽ ALTER TABLE sau khi tạo bảng users.
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================
-- 2. Bảng Users
-- =====================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('MANAGER', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    avatar_url TEXT,
    
    -- New Fields
    email VARCHAR(255),
    phone VARCHAR(20),
    position VARCHAR(100), -- Vd: Frontend Developer
    level VARCHAR(50),     -- Vd: Senior, Junior
    department_id VARCHAR(50), -- Vd: Engineering
    skills TEXT,           -- Lưu dạng JSON string hoặc comma separated
    github_url TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_user_department
        FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON DELETE SET NULL
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Thêm lại FK manager_id cho departments tham chiếu đến users
ALTER TABLE departments 
ADD CONSTRAINT fk_department_manager
FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- =====================================
-- 2. Bảng Projects
-- =====================================
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Đang làm',
    priority VARCHAR(20) DEFAULT 'Trung bình',
    start_date DATE,
    due_date DATE,
    progress INT DEFAULT 0,
    github_url TEXT,
    live_url TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================
-- 3. Tech stack của Project
-- =====================================
CREATE TABLE IF NOT EXISTS project_tech_stacks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    tech_name VARCHAR(100) NOT NULL,
    CONSTRAINT fk_project_tech
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================
-- 4. Thành viên Project (N-N)
-- =====================================
CREATE TABLE IF NOT EXISTS project_members (
    project_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id),
    CONSTRAINT fk_pm_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pm_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================
-- 5. Task Groups
-- =====================================
CREATE TABLE IF NOT EXISTS task_groups (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    estimated_time DATETIME,
    late_reason TEXT, -- Lý do trễ hạn
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_group_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================
-- 6. Phân công Task Group
-- =====================================
CREATE TABLE IF NOT EXISTS task_group_assignments (
    group_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (group_id, user_id),
    CONSTRAINT fk_tga_group
        FOREIGN KEY (group_id)
        REFERENCES task_groups(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tga_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================
-- 7. Task Items
-- =====================================
CREATE TABLE IF NOT EXISTS task_items (
    id VARCHAR(50) PRIMARY KEY,
    group_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    estimated_time DATETIME,
    late_reason TEXT, -- Lý do trễ hạn
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_item_group
        FOREIGN KEY (group_id)
        REFERENCES task_groups(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================
-- 8. Phân công Task Item
-- =====================================
CREATE TABLE IF NOT EXISTS task_item_assignments (
    item_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (item_id, user_id),
    CONSTRAINT fk_tia_item
        FOREIGN KEY (item_id)
        REFERENCES task_items(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tia_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================
-- 9. Check Items
-- =====================================
CREATE TABLE IF NOT EXISTS check_items (
    id VARCHAR(50) PRIMARY KEY,
    item_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_check_item
        FOREIGN KEY (item_id)
        REFERENCES task_items(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =====================================
-- 10. Project Notifications
-- =====================================
CREATE TABLE IF NOT EXISTS project_notifications (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    type ENUM('GENERAL', 'PERSONAL') NOT NULL DEFAULT 'GENERAL',
    target_member_id VARCHAR(50), -- NULL nếu là GENERAL
    sender_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pn_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- (Deleted departments table creation from here as it was moved to the top)
-- =====================================

CREATE TABLE IF NOT EXISTS messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id VARCHAR(50) NOT NULL,
    receiver_id VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    message_type ENUM('TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO') DEFAULT 'TEXT',
    
    -- Trạng thái tin nhắn
    is_read BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Tính năng nâng cao
    reply_to_message_id INT DEFAULT NULL,
    attachment_url TEXT DEFAULT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL DEFAULT NULL,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    
    -- Foreign Keys
    CONSTRAINT fk_sender 
        FOREIGN KEY (sender_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_receiver 
        FOREIGN KEY (receiver_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_reply_message 
        FOREIGN KEY (reply_to_message_id) 
        REFERENCES messages(message_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    
    -- Indexes
    INDEX idx_sender (sender_id),
    INDEX idx_receiver (receiver_id),
    INDEX idx_created_at (created_at),
    INDEX idx_conversation (sender_id, receiver_id, created_at),
    INDEX idx_unread (receiver_id, is_read, is_deleted)
    
) ENGINE=InnoDB
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ====================================

-- =====================================
-- SEED DATA (FULL DEMO)
-- =====================================

-- 1. Departments
INSERT INTO departments (id, name, code, description, manager_id) VALUES
('d1', 'Engineering', 'ENG', 'Phòng phát triển hệ thống & kỹ thuật', NULL),
('d2', 'Management', 'MNG', 'Phòng quản lý & điều hành dự án', NULL),
('d3', 'Human Resources', 'HR', 'Phòng nhân sự & hành chính', NULL),
('d4', 'Marketing', 'MKT', 'Phòng Marketing & Truyền thông', NULL);

-- 2. Users
-- 1024, 4592, 8831 đã có trong script trước, tôi sẽ viết lại toàn bộ để đảm bảo đồng bộ
DELETE FROM users; -- Xóa cũ để nạp mới cho sạch
INSERT INTO users (id, name, password, role, position, level, department_id, skills, email) VALUES
('1024', 'Nguyễn Văn An', '123', 'MANAGER', 'Project Manager', 'Senior', 'd2', 'Management, Agile, Jira', 'an.nguyen@hola.com'),
('4592', 'Trần Thị Bình', '123', 'MEMBER', 'Frontend Developer', 'Mid-Level', 'd1', 'React, TypeScript, Tailwind', 'binh.tran@hola.com'),
('8831', 'Lê Minh Cường', '123', 'MEMBER', 'Backend Developer', 'Junior', 'd1', 'Node.js, MySQL, Docker', 'cuong.le@hola.com'),
('5521', 'Phạm Hồng Dũng', '123', 'MEMBER', 'UI/UX Designer', 'Senior', 'd1', 'Figma, Adobe XD, Design System', 'dung.pham@hola.com'),
('6672', 'Hoàng Thu Hải', '123', 'MEMBER', 'QC Engineer', 'Mid-Level', 'd1', 'Selenium, Jest, Automation Test', 'hai.hoang@hola.com'),
('7783', 'Lý Mỹ Linh', '123', 'MEMBER', 'Content Creator', 'Junior', 'd4', 'Copywriting, SEO, Social Media', 'linh.ly@hola.com'),
('9904', 'Vũ Quốc Phương', '123', 'MEMBER', 'HR Specialist', 'Mid-Level', 'd3', 'Recruitment, Payroll', 'phuong.vu@hola.com');

-- Cập nhật manager_id cho departments
UPDATE departments SET manager_id = '1024' WHERE id = 'd2';
UPDATE departments SET manager_id = '4592' WHERE id = 'd1';

-- 3. Projects
INSERT INTO projects (id, name, description, status, priority, start_date, due_date, progress) VALUES
('1', 'Hệ thống Quản lý Kho', 'Xây dựng hệ thống quản lý kho thông minh...', 'Đang làm', 'Cao', '2023-10-01', '2024-03-01', 65),
('2', 'Ứng dụng Mobile Hola', 'Phát triển app quản lý công việc trên iOS/Android', 'Lên kế hoạch', 'Trung bình', '2024-01-15', '2024-08-30', 10),
('3', 'Chiến dịch Brand Identity', 'Tái định vị thương hiệu HaloGroup 2024', 'Đang làm', 'Thấp', '2024-02-01', '2024-05-15', 30);

-- 4. Project Members
INSERT INTO project_members (project_id, user_id) VALUES
('1', '1024'), ('1', '4592'), ('1', '8831'), ('1', '6672'),
('2', '1024'), ('2', '4592'), ('2', '5521'),
('3', '1024'), ('3', '7783');

-- 5. Task Groups
INSERT INTO task_groups (id, project_id, title, description) VALUES
('g1', '1', 'Phân tích & Thiết kế', 'Thiết kế Database và UI/UX'),
('g2', '2', 'Thiết kế Mobile App', 'Làm mockups và prototype'),
('g3', '3', 'Content Marketing', 'Viết bài truyền thông');

-- 6. Task Items
INSERT INTO task_items (id, group_id, title) VALUES
-- Project 1 tasks
('i1', 'g1', 'Thiết kế Database ERD'),
('i2', 'g1', 'Thiết kế giao diện (Figma)'),
('i3', 'g1', 'Thiết lập API và Routes'),
('i4', 'g1', 'Viết tài liệu hướng dẫn'),
-- Project 2 tasks
('i5', 'g2', 'Landing page app'),
('i6', 'g2', 'Định nghĩa luồng login'),
('i7', 'g2', 'Sketch màn hình chính'),
-- Project 3 tasks
('i8', 'g3', 'Kịch bản video giới thiệu');

-- 7. Task Assignments (Phân phối để test màu sắc)
INSERT INTO task_item_assignments (item_id, user_id) VALUES
-- Trần Thị Bình (4592): 2 tasks -> Màu XANH
('i1', '4592'), 
('i2', '4592'),
-- Lê Minh Cường (8831): 4 tasks -> Màu VÀNG
('i3', '8831'),
('i5', '8831'),
('i6', '8831'),
('i4', '8831'),
-- Phạm Hồng Dũng (5521): 7 tasks -> Màu ĐỎ (Quá tải)
('i7', '5521'), 
('i8', '5521'),
('i1', '5521'), ('i2', '5521'), ('i3', '5521'), ('i5', '5521'), ('i6', '5521');

-- 8. Check Items (Cần có check item chưa hoàn thành để task được tính vào "đang làm")
INSERT INTO check_items (id, item_id, title, completed) VALUES
('c1', 'i1', 'Entity chính', TRUE),
('c2', 'i1', 'Mối quan hệ', FALSE), -- Task i1 chưa xong
('c3', 'i2', 'Figma layout', FALSE), -- Task i2 chưa xong
('c4', 'i3', 'Express setup', FALSE), -- Task i3 chưa xong
('c5', 'i4', 'Drafting', FALSE), -- Task i4 chưa xong
('c6', 'i5', 'HTML/CSS', FALSE), -- Task i5 chưa xong
('c7', 'i6', 'Flowchart', FALSE), -- Task i6 chưa xong
('c8', 'i7', 'Sketching', FALSE), -- Task i7 chưa xong
('c9', 'i8', 'Draft script', FALSE); -- Task i8 chưa xong
