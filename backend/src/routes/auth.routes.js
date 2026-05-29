// src/routes/auth.routes.js
const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const router   = express.Router();

const ALLOWED_DOMAIN  = 'ladybirdtaco.com';
const BCRYPT_ROUNDS   = 12;
const RESET_EXPIRES_H = 1; // horas

const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const isAllowedDomain = (email) => {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === ALLOWED_DOMAIN;
};

const isStrongPassword = (password) => {
  // Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número
  return password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = (pool, emailService) => {

  // ─── REGISTRO ─────────────────────────────────────────────────────────────
  router.post('/registro', async (req, res) => {
    const { email, contrasena, nombre } = req.body;

    if (!email || !contrasena)
      return res.status(400).json({ error: 'Email and password are required' });

    if (!isValidEmail(email))
      return res.status(400).json({ error: 'Invalid email format' });

    if (!isAllowedDomain(email))
      return res.status(403).json({ error: `Only @${ALLOWED_DOMAIN} email addresses are allowed` });

    if (!isStrongPassword(contrasena))
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number'
      });

    try {
      const exists = await pool.query(
        'SELECT id FROM usuarios WHERE email = $1',
        [email.toLowerCase()]
      );
      if (exists.rows.length > 0)
        return res.status(400).json({ error: 'Email already registered' });

      const hash   = await bcrypt.hash(contrasena, BCRYPT_ROUNDS);
      const result = await pool.query(
        `INSERT INTO usuarios (email, nombre, contrasena, role)
         VALUES ($1, $2, $3, 'staff')
         RETURNING id, email, nombre, role`,
        [email.toLowerCase(), nombre || email.split('@')[0], hash]
      );

      const user  = result.rows[0];
      const token = generateToken(user);

      res.status(201).json({
        mensaje:  'Account created successfully',
        token,
        usuario: { id: user.id, email: user.email, nombre: user.nombre, role: user.role },
      });
    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({ error: 'Error creating account' });
    }
  });

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  router.post('/login', async (req, res) => {
    const { email, contrasena } = req.body;

    if (!email || !contrasena)
      return res.status(400).json({ error: 'Email and password are required' });

    if (!isAllowedDomain(email))
      return res.status(403).json({ error: `Only @${ALLOWED_DOMAIN} email addresses are allowed` });

    try {
      const result = await pool.query(
        'SELECT * FROM usuarios WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0)
        return res.status(401).json({ error: 'Invalid email or password' });

      const user    = result.rows[0];
      const isMatch = await bcrypt.compare(contrasena, user.contrasena);

      if (!isMatch)
        return res.status(401).json({ error: 'Invalid email or password' });

      const token = generateToken(user);

      res.json({
        mensaje: 'Login successful',
        token,
        usuario: { id: user.id, email: user.email, nombre: user.nombre, role: user.role },
      });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ─── FORGOT PASSWORD ──────────────────────────────────────────────────────
  router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ error: 'Email is required' });

    // Siempre responder igual para no revelar si el email existe
    res.json({ mensaje: 'If that email exists, a reset link has been sent' });

    try {
      if (!isAllowedDomain(email)) return;

      const result = await pool.query(
        'SELECT id, email, nombre FROM usuarios WHERE email = $1',
        [email.toLowerCase()]
      );
      if (result.rows.length === 0) return;

      const user       = result.rows[0];
      const token      = crypto.randomBytes(32).toString('hex');
      const expires    = new Date(Date.now() + RESET_EXPIRES_H * 60 * 60 * 1000);

      await pool.query(
        `UPDATE usuarios
         SET reset_token = $1, reset_token_expires = $2
         WHERE id = $3`,
        [token, expires, user.id]
      );

      const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;
      await emailService.sendPasswordReset(user.email, resetUrl);
    } catch (error) {
      console.error('Error en forgot-password:', error);
    }
  });

  // ─── RESET PASSWORD ───────────────────────────────────────────────────────
  router.post('/reset-password', async (req, res) => {
    const { token, contrasena } = req.body;

    if (!token || !contrasena)
      return res.status(400).json({ error: 'Token and new password are required' });

    if (!isStrongPassword(contrasena))
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number'
      });

    try {
      const result = await pool.query(
        `SELECT id FROM usuarios
         WHERE reset_token = $1
           AND reset_token_expires > NOW()`,
        [token]
      );

      if (result.rows.length === 0)
        return res.status(400).json({ error: 'Invalid or expired reset token' });

      const hash = await bcrypt.hash(contrasena, BCRYPT_ROUNDS);
      await pool.query(
        `UPDATE usuarios
         SET contrasena = $1, reset_token = NULL, reset_token_expires = NULL
         WHERE id = $2`,
        [hash, result.rows[0].id]
      );

      res.json({ mensaje: 'Password updated successfully' });
    } catch (error) {
      console.error('Error en reset-password:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ─── VERIFY TOKEN ─────────────────────────────────────────────────────────
  router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result  = await pool.query(
        'SELECT id, email, nombre, role FROM usuarios WHERE id = $1',
        [decoded.id]
      );
      if (result.rows.length === 0)
        return res.status(401).json({ error: 'User not found' });

      res.json({ usuario: result.rows[0] });
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  });

  return router;
};