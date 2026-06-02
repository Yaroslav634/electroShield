const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");
const net = require("net");
require("dotenv").config();

const app = express();
const SALT_ROUNDS = 10;
const SESSION_SECRET = "electroshield_secret_key_2026";

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Создание папок для загрузок
const uploadsDir = path.join(__dirname, "uploads", "components");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка multer для загрузки изображений
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Только изображения (jpg, png, gif, webp)"));
    }
  }
});

function findFreePort(startPort = 3000) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      findFreePort(startPort + 1).then(resolve);
    });
  });
}

const dbConfig = {
  host: "cfif31.ru",
  port: 3306,
  database: "ISPr25-24_LobanovYV_electroschield_bd",
  user: "ISPr25-24_LobanovYV",
  password: "ISPr25-24_LobanovYV",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false },
  connectTimeout: 10000,
};

let pool = null;
let currentPort = null;

async function connectToMySQL() {
  try {
    console.log("🔄 Подключение к MySQL...");
    pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    console.log("✅ Подключено к MySQL!");

    await createTables(connection);
    await seedInitialData(connection);

    connection.release();
    return true;
  } catch (error) {
    console.error("❌ Ошибка подключения к MySQL:", error.message);
    process.exit(1);
  }
}

async function createTables(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      phone VARCHAR(20),
      role ENUM('admin', 'manager', 'user') DEFAULT 'user',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP NULL
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS components (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      category_id INT,
      power_rating VARCHAR(50),
      voltage VARCHAR(50),
      manufacturer VARCHAR(100),
      image_url VARCHAR(500),
      in_stock BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_number VARCHAR(50) UNIQUE NOT NULL,
      user_id INT,
      customer_name VARCHAR(200) NOT NULL,
      customer_email VARCHAR(100),
      customer_phone VARCHAR(20),
      customer_address TEXT,
      delivery_method ENUM('pickup', 'delivery') DEFAULT 'pickup',
      delivery_address TEXT,
      payment_method ENUM('cash', 'card', 'invoice') DEFAULT 'cash',
      status ENUM('new', 'processing', 'confirmed', 'manufacturing', 'ready', 'delivered', 'completed', 'cancelled') DEFAULT 'new',
      total_amount DECIMAL(10,2) DEFAULT 0.00,
      final_amount DECIMAL(10,2) DEFAULT 0.00,
      comments TEXT,
      manager_comments TEXT,
      manager_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS configurations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT UNIQUE,
      config_name VARCHAR(200) NOT NULL,
      total_price DECIMAL(10,2) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS configuration_components (
      id INT AUTO_INCREMENT PRIMARY KEY,
      config_id INT,
      component_id INT,
      quantity INT DEFAULT 1,
      unit_price DECIMAL(10,2),
      total_price DECIMAL(10,2),
      FOREIGN KEY (config_id) REFERENCES configurations(id) ON DELETE CASCADE,
      FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS configuration_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      config_id INT,
      service_id INT,
      quantity INT DEFAULT 1,
      unit_price DECIMAL(10,2),
      total_price DECIMAL(10,2),
      FOREIGN KEY (config_id) REFERENCES configurations(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS order_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT,
      old_status VARCHAR(50),
      new_status VARCHAR(50),
      changed_by INT,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS saved_configurations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(200) NOT NULL,
      components_json LONGTEXT,
      services_json LONGTEXT,
      total_amount DECIMAL(10,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  console.log("✅ Таблицы созданы");
}

async function seedInitialData(connection) {
  const [admin] = await connection.execute('SELECT * FROM users WHERE username = "admin"');
  if (admin.length === 0) {
    const adminPass = await bcrypt.hash("admin123", SALT_ROUNDS);
    await connection.execute(
      "INSERT INTO users (username, password, email, full_name, role) VALUES (?, ?, ?, ?, ?)",
      ["admin", adminPass, "admin@electroshield.ru", "Администратор", "admin"],
    );
  }

  const [manager] = await connection.execute('SELECT * FROM users WHERE username = "manager"');
  if (manager.length === 0) {
    const managerPass = await bcrypt.hash("manager123", SALT_ROUNDS);
    await connection.execute(
      "INSERT INTO users (username, password, email, full_name, role) VALUES (?, ?, ?, ?, ?)",
      ["manager", managerPass, "manager@electroshield.ru", "Менеджер", "manager"],
    );
  }

  const [user] = await connection.execute('SELECT * FROM users WHERE username = "user"');
  if (user.length === 0) {
    const userPass = await bcrypt.hash("user123", SALT_ROUNDS);
    await connection.execute(
      "INSERT INTO users (username, password, email, full_name, role) VALUES (?, ?, ?, ?, ?)",
      ["user", userPass, "user@electroshield.ru", "Пользователь", "user"],
    );
  }

  const [categories] = await connection.execute("SELECT COUNT(*) as count FROM categories");
  if (categories[0].count === 0) {
    await connection.execute(`
      INSERT INTO categories (name, description) VALUES
      ('Вводно-распределительные устройства', 'Устройства для ввода и распределения электроэнергии'),
      ('Силовые щиты', 'Щиты для распределения силовой нагрузки'),
      ('Щиты освещения', 'Щиты управления освещением'),
      ('Автоматические выключатели', 'Защитные устройства'),
      ('Устройства защитного отключения', 'УЗО для защиты от токов утечки'),
      ('Контакторы и пускатели', 'Устройства управления нагрузкой'),
      ('Шкафы и корпуса', 'Корпуса для оборудования')
    `);
  }

  const [components] = await connection.execute("SELECT COUNT(*) as count FROM components");
  if (components[0].count === 0) {
    await connection.execute(`
      INSERT INTO components (name, description, price, category_id, manufacturer, image_url, in_stock) VALUES
      ('Щит ВРУ-1', 'Вводно-распределительное устройство на 250А', 45000.00, 1, 'Электрощит-Самара', NULL, TRUE),
      ('Щит силовой ШР-11', 'Силовой распределительный щит на 12 групп', 32000.00, 2, 'Электрощит-Самара', NULL, TRUE),
      ('Щит освещения ЩО-31', 'Щит освещения на 6 групп', 18500.00, 3, 'Электрощит-Самара', NULL, TRUE),
      ('Автомат ABB S203 C25', 'Автоматический выключатель 25А', 1850.00, 4, 'ABB', NULL, TRUE),
      ('Автомат ABB S203 C40', 'Автоматический выключатель 40А', 2100.00, 4, 'ABB', NULL, TRUE),
      ('УЗО ABB F202 AC-40/0.03', 'Устройство защитного отключения 40А', 3200.00, 5, 'ABB', NULL, TRUE),
      ('Контактор ABB ESB24-40', 'Контактор 40А', 4500.00, 6, 'ABB', NULL, TRUE),
      ('Шкаф настенный 800x600x250', 'Металлический шкаф', 12000.00, 7, 'Электрощит-Самара', NULL, TRUE)
    `);
  }

   const [services] = await connection.execute("SELECT COUNT(*) as count FROM services");
  if (services[0].count === 0) {
    await connection.execute(`
      INSERT INTO services (name, description, price, is_active) VALUES
      ('Проектирование', 'Разработка проектной документации', 15000.00, TRUE),
      ('Монтаж', 'Установка и подключение оборудования', 20000.00, TRUE),
      ('Пусконаладка', 'Пуско-наладочные работы', 18000.00, TRUE),
      ('Доставка по городу', 'Доставка по Самаре', 5000.00, TRUE),
      ('Сервисное обслуживание', 'Годовое обслуживание', 12000.00, TRUE)
    `);
  }
  console.log("✅ Начальные данные загружены");
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: false,
    },
  }),
);

function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ success: false, message: "Необходима авторизация" });
}

function isManagerOrAdmin(req, res, next) {
  if (req.session && req.session.userId && (req.session.userRole === "manager" || req.session.userRole === "admin")) {
    return next();
  }
  res.status(403).json({ success: false, message: "Недостаточно прав" });
}

function isAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.userRole === "admin") {
    return next();
  }
  res.status(403).json({ success: false, message: "Требуются права администратора" });
}

// ============ API ============

app.get("/api/test", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.execute("SELECT 1");
    connection.release();
    res.json({ success: true, message: "Сервер работает" });
  } catch (error) {
    res.json({ success: false, message: "Ошибка подключения" });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const { username, password, email, full_name, phone } = req.body;
    if (!username || !password || !email || !full_name) {
      return res.status(400).json({ success: false, message: "Заполните все поля" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Пароль должен быть не менее 6 символов" });
    }
    const connection = await pool.getConnection();
    const [existing] = await connection.execute("SELECT id FROM users WHERE username = ? OR email = ?", [username, email]);
    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ success: false, message: "Пользователь уже существует" });
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await connection.execute(
      'INSERT INTO users (username, password, email, full_name, phone, role) VALUES (?, ?, ?, ?, ?, "user")',
      [username, hashedPassword, email, full_name, phone || null],
    );
    connection.release();
    res.json({ success: true, message: "Регистрация успешна" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Один маршрут для получения пользователя
app.get("/api/users/:id", isAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT id, username, email, full_name, phone, role, is_active, created_at FROM users WHERE id = ?",
      [req.params.id]
    );
    connection.release();
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
    
    res.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error("Ошибка получения пользователя:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/users/:id", isAdmin, async (req, res) => {
  try {
    const { full_name, email, phone, role, password } = req.body;
    
    if (!full_name || !email) {
      return res.status(400).json({ success: false, message: "ФИО и Email обязательны" });
    }
    
    const connection = await pool.getConnection();
    
    let query = "UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?";
    let params = [full_name, email, phone || null, role || "user"];
    
    if (password && password.length >= 6) {
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      query += ", password = ?";
      params.push(hashedPassword);
    }
    
    query += " WHERE id = ?";
    params.push(req.params.id);
    
    const [result] = await connection.execute(query, params);
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка обновления пользователя:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/users/:id/role", isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!["user", "manager", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Некорректная роль" });
    }
    
    const connection = await pool.getConnection();
    
    if (role !== "admin") {
      const [adminCount] = await connection.execute(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND id != ?",
        [req.params.id]
      );
      if (adminCount[0].count === 0) {
        connection.release();
        return res.status(400).json({ 
          success: false, 
          message: "Нельзя изменить роль единственного администратора" 
        });
      }
    }
    
    const [result] = await connection.execute(
      "UPDATE users SET role = ? WHERE id = ?",
      [role, req.params.id]
    );
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Ошибка изменения роли:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/users/:id/toggle", isAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [users] = await connection.execute("SELECT is_active, role FROM users WHERE id = ?", [req.params.id]);
    
    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: "Пользователь не найден" });
    }
    
    if (users[0].role === "admin") {
      const [adminCount] = await connection.execute(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = true"
      );
      if (adminCount[0].count === 1 && users[0].is_active) {
        connection.release();
        return res.status(400).json({ 
          success: false, 
          message: "Нельзя заблокировать единственного активного администратора" 
        });
      }
    }
    
    const newStatus = users[0].is_active ? 0 : 1;
    
    await connection.execute(
      "UPDATE users SET is_active = ? WHERE id = ?",
      [newStatus, req.params.id]
    );
    connection.release();
    
    res.json({ success: true, is_active: newStatus === 1 });
  } catch (error) {
    console.error("Ошибка изменения статуса:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/users", isAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT id, username, email, full_name, phone, role, is_active, 
      DATE_FORMAT(created_at, '%d.%m.%Y') as created_at 
      FROM users ORDER BY created_at DESC`
    );
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Ошибка загрузки пользователей:", error);
    res.status(500).json([]);
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const connection = await pool.getConnection();
    const [users] = await connection.execute("SELECT * FROM users WHERE username = ? AND is_active = TRUE", [username]);
    if (users.length === 0) {
      connection.release();
      return res.json({ success: false, message: "Неверный логин или пароль" });
    }
    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      connection.release();
      return res.json({ success: false, message: "Неверный логин или пароль" });
    }
    await connection.execute("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id]);
    connection.release();
    req.session.userId = user.id;
    req.session.userName = user.full_name;
    req.session.userRole = user.role;
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get("/api/me", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ success: false, authenticated: false });
  }
  try {
    const connection = await pool.getConnection();
    const [users] = await connection.execute(
      "SELECT id, username, email, full_name, phone, role, is_active FROM users WHERE id = ?",
      [req.session.userId],
    );
    connection.release();
    if (users.length === 0 || !users[0].is_active) {
      req.session.destroy();
      return res.json({ success: false, authenticated: false });
    }
    res.json({ success: true, authenticated: true, user: users[0] });
  } catch (error) {
    res.json({ success: false, authenticated: false });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute("SELECT * FROM categories ORDER BY name");
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json([]);
  }
});

app.get("/api/categories/:id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute("SELECT * FROM categories WHERE id = ?", [req.params.id]);
    connection.release();
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Категория не найдена" });
    res.json({ success: true, category: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/categories", isAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Введите название" });
    const connection = await pool.getConnection();
    const [result] = await connection.execute("INSERT INTO categories (name, description) VALUES (?, ?)", [name, description || null]);
    connection.release();
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/categories/:id", isAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Введите название" });
    const connection = await pool.getConnection();
    const [result] = await connection.execute("UPDATE categories SET name = ?, description = ? WHERE id = ?", [name, description || null, req.params.id]);
    connection.release();
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Категория не найдена" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/categories/:id", isAdmin, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [components] = await connection.execute("SELECT COUNT(*) as count FROM components WHERE category_id = ?", [req.params.id]);
    if (components[0].count > 0) {
      connection.release();
      return res.status(400).json({ success: false, message: "Категория содержит компоненты" });
    }
    const [result] = await connection.execute("DELETE FROM categories WHERE id = ?", [req.params.id]);
    connection.release();
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Категория не найдена" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/components", async (req, res) => {
  try {
    const { category_id } = req.query;
    let sql = "SELECT c.*, cat.name as category_name FROM components c LEFT JOIN categories cat ON c.category_id = cat.id";
    const params = [];
    if (category_id) { sql += " WHERE c.category_id = ?"; params.push(category_id); }
    sql += " ORDER BY c.name";
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(sql, params);
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json([]);
  }
});

app.get("/api/components/:id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT c.*, cat.name as category_name FROM components c LEFT JOIN categories cat ON c.category_id = cat.id WHERE c.id = ?",
      [req.params.id],
    );
    connection.release();
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Компонент не найден" });
    res.json({ success: true, component: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/components", isAdmin, async (req, res) => {
  try {
    const { name, description, price, category_id, manufacturer, power_rating, voltage, in_stock } = req.body;
    if (!name || !price) return res.status(400).json({ success: false, message: "Заполните обязательные поля" });
    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      `INSERT INTO components (name, description, price, category_id, manufacturer, power_rating, voltage, in_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, price, category_id || null, manufacturer || null, power_rating || null, voltage || null, in_stock ? 1 : 0],
    );
    connection.release();
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/components/:id", isAdmin, async (req, res) => {
  try {
    const { name, description, price, category_id, manufacturer, power_rating, voltage, in_stock } = req.body;
    if (!name || !price) return res.status(400).json({ success: false, message: "Заполните обязательные поля" });
    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      `UPDATE components SET name = ?, description = ?, price = ?, category_id = ?, manufacturer = ?, power_rating = ?, voltage = ?, in_stock = ? WHERE id = ?`,
      [name, description || null, price, category_id || null, manufacturer || null, power_rating || null, voltage || null, in_stock ? 1 : 0, req.params.id],
    );
    connection.release();
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Компонент не найден" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/components/:id", isAdmin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [components] = await connection.execute("SELECT id, name FROM components WHERE id = ?", [req.params.id]);
    if (components.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: "Компонент не найден" });
    }
    
    const componentName = components[0].name;
    
    // Удаляем связи в configuration_components
    await connection.execute("DELETE FROM configuration_components WHERE component_id = ?", [req.params.id]);
    
    // Удаляем сам компонент
    const [result] = await connection.execute("DELETE FROM components WHERE id = ?", [req.params.id]);
    
    connection.release();
    
    console.log(`✅ Компонент "${componentName}" (ID: ${req.params.id}) удалён вместе со связями`);
    res.json({ success: true, message: "Компонент успешно удалён" });
    
  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Ошибка удаления компонента:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/components/:id/image", isAdmin, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Файл не загружен" });
    }
    const imageUrl = "/uploads/components/" + req.file.filename;
    const connection = await pool.getConnection();
    await connection.execute("UPDATE components SET image_url = ? WHERE id = ?", [imageUrl, req.params.id]);
    connection.release();
    res.json({ success: true, imageUrl: imageUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/services", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute("SELECT * FROM services WHERE is_active = TRUE ORDER BY name");
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error("Ошибка загрузки услуг:", error);
    res.status(500).json([]);
  }
});

app.post("/api/orders", isAuthenticated, async (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, customer_address, delivery_method, delivery_address, payment_method, config_name, components, services, total_amount, comments } = req.body;
    if (!customer_name || !components || components.length === 0) {
      return res.status(400).json({ success: false, message: "Заполните обязательные поля" });
    }
    const connection = await pool.getConnection();
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_phone, customer_address, delivery_method, delivery_address, payment_method, total_amount, final_amount, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, req.session.userId, customer_name, customer_email || null, customer_phone || null, customer_address || null, delivery_method || "pickup", delivery_address || null, payment_method || "cash", total_amount, total_amount, comments || null],
    );
    const orderId = orderResult.insertId;
    const [configResult] = await connection.execute(
      "INSERT INTO configurations (order_id, config_name, total_price, description) VALUES (?, ?, ?, ?)",
      [orderId, config_name || "Основная конфигурация", total_amount, comments || null],
    );
    const configId = configResult.insertId;
    for (const comp of components) {
      await connection.execute("INSERT INTO configuration_components (config_id, component_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)", [configId, comp.id, comp.quantity, comp.price, comp.price * comp.quantity]);
    }
    if (services && services.length > 0) {
      for (const serv of services) {
        await connection.execute("INSERT INTO configuration_services (config_id, service_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)", [configId, serv.id, 1, serv.price, serv.price]);
      }
    }
    await connection.execute('INSERT INTO order_history (order_id, new_status, changed_by, comment) VALUES (?, "new", ?, "Заказ создан")', [orderId, req.session.userId]);
    connection.release();
    res.json({ success: true, orderId, orderNumber, totalAmount: total_amount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/my-orders", isAuthenticated, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    let query, params = [];
    if (req.session.userRole === "admin" || req.session.userRole === "manager") {
      query = "SELECT o.*, u.full_name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC";
    } else {
      query = "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC";
      params = [req.session.userId];
    }
    const [rows] = await connection.execute(query, params);
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json([]);
  }
});

app.get("/api/orders/:id", isAuthenticated, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [orders] = await connection.execute("SELECT o.*, u.full_name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?", [req.params.id]);
    if (orders.length === 0) { connection.release(); return res.status(404).json({ success: false, message: "Заказ не найден" }); }
    const order = orders[0];
    if (req.session.userRole !== "admin" && req.session.userRole !== "manager" && order.user_id !== req.session.userId) {
      connection.release();
      return res.status(403).json({ success: false, message: "Доступ запрещен" });
    }
    const [configs] = await connection.execute("SELECT * FROM configurations WHERE order_id = ?", [req.params.id]);
    let config = null, components = [], services = [];
    if (configs.length > 0) {
      config = configs[0];
      const [compRows] = await connection.execute("SELECT cc.*, c.name, c.description, c.manufacturer FROM configuration_components cc JOIN components c ON cc.component_id = c.id WHERE cc.config_id = ?", [config.id]);
      components = compRows;
      const [servRows] = await connection.execute("SELECT cs.*, s.name, s.description FROM configuration_services cs JOIN services s ON cs.service_id = s.id WHERE cs.config_id = ?", [config.id]);
      services = servRows;
    }
    const [history] = await connection.execute("SELECT h.*, u.full_name as changed_by_name FROM order_history h LEFT JOIN users u ON h.changed_by = u.id WHERE h.order_id = ? ORDER BY h.created_at DESC", [req.params.id]);
    connection.release();
    res.json({ success: true, order, config, components, services, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/orders/:id/status", isManagerOrAdmin, async (req, res) => {
  try {
    const { status, comment } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "Укажите статус" });
    const connection = await pool.getConnection();
    const [orders] = await connection.execute("SELECT status, order_number FROM orders WHERE id = ?", [req.params.id]);
    if (orders.length === 0) { connection.release(); return res.status(404).json({ success: false, message: "Заказ не найден" }); }
    const oldStatus = orders[0].status;
    await connection.execute("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?", [status, req.params.id]);
    if (status === "completed") await connection.execute("UPDATE orders SET completed_at = NOW() WHERE id = ?", [req.params.id]);
    const historyComment = comment || `Статус изменен с ${oldStatus} на ${status}`;
    await connection.execute("INSERT INTO order_history (order_id, old_status, new_status, changed_by, comment) VALUES (?, ?, ?, ?, ?)", [req.params.id, oldStatus, status, req.session.userId, historyComment]);
    connection.release();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/orders/:id", isManagerOrAdmin, async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, customer_address, delivery_method, delivery_address, payment_method, status, comments, manager_comments } = req.body;
    if (!customer_name) return res.status(400).json({ success: false, message: "Имя клиента обязательно" });
    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      `UPDATE orders SET customer_name = ?, customer_phone = ?, customer_email = ?, customer_address = ?, delivery_method = ?, delivery_address = ?, payment_method = ?, status = ?, comments = ?, manager_comments = ? WHERE id = ?`,
      [customer_name, customer_phone || null, customer_email || null, customer_address || null, delivery_method, delivery_address || null, payment_method, status, comments || null, manager_comments || null, req.params.id],
    );
    connection.release();
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Заказ не найден" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// УДАЛЕНИЕ ЗАКАЗА (ФИЗИЧЕСКОЕ)
app.delete("/api/orders/:id", isManagerOrAdmin, async (req, res) => {
  console.log("=".repeat(50));
  console.log("🗑️ ПОЛУЧЕН DELETE ЗАПРОС на /api/orders/" + req.params.id);
  console.log("=".repeat(50));
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [orders] = await connection.execute(
      "SELECT id, order_number FROM orders WHERE id = ?", 
      [req.params.id]
    );
    
    if (orders.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: "Заказ не найден" });
    }
    
    const orderNumber = orders[0].order_number;
    console.log(`📦 Найден заказ: ${orderNumber}`);
    
    await connection.execute("DELETE FROM order_history WHERE order_id = ?", [req.params.id]);
    console.log("✅ Удалена история заказа");
    
    const [configs] = await connection.execute(
      "SELECT id FROM configurations WHERE order_id = ?", 
      [req.params.id]
    );
    
    if (configs.length > 0) {
      const configId = configs[0].id;
      console.log(`📋 Найдена конфигурация ID: ${configId}`);
      
      await connection.execute("DELETE FROM configuration_components WHERE config_id = ?", [configId]);
      console.log("✅ Удалены компоненты конфигурации");
      
      await connection.execute("DELETE FROM configuration_services WHERE config_id = ?", [configId]);
      console.log("✅ Удалены услуги конфигурации");
      
      await connection.execute("DELETE FROM configurations WHERE id = ?", [configId]);
      console.log("✅ Удалена конфигурация");
    }
    
    const [result] = await connection.execute("DELETE FROM orders WHERE id = ?", [req.params.id]);
    
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Заказ не найден" });
    }
    
    console.log(`✅ Заказ ${orderNumber} (ID: ${req.params.id}) полностью удалён из БД`);
    console.log("=".repeat(50));
    res.json({ success: true, message: "Заказ успешно удалён" });
    
  } catch (error) {
    if (connection) connection.release();
    console.error("❌ Ошибка удаления заказа:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [orderCount] = await connection.execute("SELECT COUNT(*) as count FROM orders");
    const [newOrders] = await connection.execute('SELECT COUNT(*) as count FROM orders WHERE status = "new"');
    const [componentCount] = await connection.execute("SELECT COUNT(*) as count FROM components");
    const [categoryCount] = await connection.execute("SELECT COUNT(*) as count FROM categories");
    connection.release();
    res.json({
      totalOrders: orderCount[0].count,
      newOrders: newOrders[0].count,
      totalComponents: componentCount[0].count,
      totalCategories: categoryCount[0].count,
    });
  } catch (error) {
    res.json({ totalOrders: 0, newOrders: 0, totalComponents: 0, totalCategories: 0 });
  }
});

app.get("/api/saved-configs", isAuthenticated, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute("SELECT * FROM saved_configurations WHERE user_id = ? ORDER BY created_at DESC", [req.session.userId]);
    connection.release();
    res.json(rows);
  } catch (error) {
    res.status(500).json([]);
  }
});

app.post("/api/saved-configs", isAuthenticated, async (req, res) => {
  try {
    const { name, components, services, total_amount } = req.body;
    if (!name || !components) return res.status(400).json({ success: false, message: "Нет данных" });
    const connection = await pool.getConnection();
    await connection.execute(
      "INSERT INTO saved_configurations (user_id, name, components_json, services_json, total_amount) VALUES (?, ?, ?, ?, ?)",
      [req.session.userId, name, JSON.stringify(components), JSON.stringify(services || []), total_amount],
    );
    connection.release();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/saved-configs/:id", isAuthenticated, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.execute("DELETE FROM saved_configurations WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId]);
    connection.release();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Статические файлы - в самом конце!
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

async function startServer() {
  console.clear();
  console.log("=".repeat(50));
  console.log("⚡ КОНФИГУРАТОР ЩИТОВОГО ОБОРУДОВАНИЯ");
  console.log("=".repeat(50));
  currentPort = await findFreePort(3001);
  console.log(`🔍 Порт: ${currentPort}`);
  await connectToMySQL();
  app.listen(currentPort, () => {
    console.log("=".repeat(50));
    console.log(`🚀 Сервер запущен: http://localhost:${currentPort}`);
    console.log(`📊 Админка: http://localhost:${currentPort}/admin.html`);
    console.log(`📦 Заказы: http://localhost:${currentPort}/orders.html`);
    console.log("=".repeat(50));
    console.log("🔑 Тестовые аккаунты:");
    console.log("   admin / admin123");
    console.log("   manager / manager123");
    console.log("   user / user123");
    console.log("=".repeat(50));
    console.log("🗑️ DELETE маршрут зарегистрирован: DELETE /api/orders/:id");
    console.log("=".repeat(50));
  });
}

startServer();