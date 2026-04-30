// src/routes/auth.routes.js
const express = require('express');
const router  = express.Router();

module.exports = (pool) => {
  router.post('/registro', async (req, res) => {
    const { usuario, contrasena } = req.body;
    if (!usuario || !contrasena)
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    if (contrasena.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    try {
      const exists = await pool.query('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);
      if (exists.rows.length > 0)
        return res.status(400).json({ error: 'El usuario ya existe' });
      const result = await pool.query(
        'INSERT INTO usuarios (usuario, contrasena) VALUES ($1, $2) RETURNING id, usuario',
        [usuario, contrasena]
      );
      res.status(201).json({ mensaje: 'Usuario registrado exitosamente', usuario: result.rows[0] });
    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({ error: 'Error al crear usuario' });
    }
  });

  router.post('/login', async (req, res) => {
    const { usuario, contrasena } = req.body;
    if (!usuario || !contrasena)
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    try {
      const result = await pool.query(
        'SELECT * FROM usuarios WHERE usuario = $1 AND contrasena = $2',
        [usuario, contrasena]
      );
      if (result.rows.length === 0)
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      const user = result.rows[0];
      res.json({ mensaje: 'Login exitoso', usuario: { id: user.id, usuario: user.usuario } });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  });

  return router;
};