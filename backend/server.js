require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./database");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please log in first" });
  }

  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

app.get("/", (req, res) => {
  res.json({ message: "Blog Platform API is running" });
});

app.post("/api/auth/register", (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)"
    ).run(name.trim(), normalizedEmail, hashedPassword);

    res.status(201).json({
      message: "Registration successful",
      user: { id: result.lastInsertRowid, name: name.trim(), email: normalizedEmail }
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ message: "Email is already registered" });
    }

    res.status(500).json({ message: "Could not register user" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = db.prepare(
    "SELECT * FROM users WHERE email = ?"
  ).get(email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({
    message: "Login successful",
    token,
    user: { id: user.id, name: user.name, email: user.email }
  });
});

app.get("/api/posts", (req, res) => {
  const posts = db.prepare(`
    SELECT posts.id, posts.title, posts.content, posts.created_at,
           users.id AS user_id, users.name AS author,
           (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count
    FROM posts
    JOIN users ON users.id = posts.user_id
    ORDER BY posts.id DESC
  `).all();

  res.json(posts);
});

app.get("/api/posts/:id", (req, res) => {
  const post = db.prepare(`
    SELECT posts.id, posts.title, posts.content, posts.created_at,
           users.id AS user_id, users.name AS author
    FROM posts
    JOIN users ON users.id = posts.user_id
    WHERE posts.id = ?
  `).get(req.params.id);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  const comments = db.prepare(`
    SELECT comments.id, comments.content, comments.created_at,
           users.id AS user_id, users.name AS author
    FROM comments
    JOIN users ON users.id = comments.user_id
    WHERE comments.post_id = ?
    ORDER BY comments.id ASC
  `).all(req.params.id);

  res.json({ ...post, comments });
});

app.post("/api/posts", authenticate, (req, res) => {
  const { title, content } = req.body;

  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ message: "Title and content are required" });
  }

  const result = db.prepare(
    "INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)"
  ).run(req.user.id, title.trim(), content.trim());

  res.status(201).json({
    message: "Post created successfully",
    id: result.lastInsertRowid
  });
});

app.put("/api/posts/:id", authenticate, (req, res) => {
  const { title, content } = req.body;
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (post.user_id !== req.user.id) {
    return res.status(403).json({ message: "You can edit only your own posts" });
  }

  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ message: "Title and content are required" });
  }

  db.prepare(`
    UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title.trim(), content.trim(), req.params.id);

  res.json({ message: "Post updated successfully" });
});

app.delete("/api/posts/:id", authenticate, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (post.user_id !== req.user.id) {
    return res.status(403).json({ message: "You can delete only your own posts" });
  }

  db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);

  res.json({ message: "Post deleted successfully" });
});

app.post("/api/posts/:id/comments", authenticate, (req, res) => {
  const { content } = req.body;
  const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(req.params.id);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (!content?.trim()) {
    return res.status(400).json({ message: "Comment cannot be empty" });
  }

  const result = db.prepare(
    "INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)"
  ).run(req.params.id, req.user.id, content.trim());

  res.status(201).json({
    message: "Comment added successfully",
    id: result.lastInsertRowid
  });
});

app.delete("/api/comments/:id", authenticate, (req, res) => {
  const comment = db.prepare(
    "SELECT * FROM comments WHERE id = ?"
  ).get(req.params.id);

  if (!comment) {
    return res.status(404).json({ message: "Comment not found" });
  }

  if (comment.user_id !== req.user.id) {
    return res.status(403).json({ message: "You can delete only your own comments" });
  }

  db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.id);

  res.json({ message: "Comment deleted successfully" });
});

app.listen(PORT, () => {
  console.log(`Blog Platform API running at http://localhost:${PORT}`);
});
