const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Utility: cookie options for JWT
const jwtCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
};

// Utility: sanitize input
function sanitize(str) {
    return str?.trim().toLowerCase();
}

// GET: login page
router.get('/login', (req, res) => {
    res.render('login');
});

// GET: register page
router.get('/register', (req, res) => {
    res.render('register');
});

// POST: register new user
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        if (!username || !email || !password) {
            return res.status(400).send('All fields are required');
        }

        if (password.length < 6) {
            return res.status(400).send('Password must be at least 6 characters');
        }

        const existing = await User.findOne({
            $or: [{ email: sanitize(email) }, { username: sanitize(username) }]
        });

        if (existing) {
            const field = existing.email === sanitize(email) ? 'Email' : 'Username';
            return res.status(400).send(`${field} already in use`);
        }

        const user = new User({
            username: sanitize(username),
            email: sanitize(email),
            password
        });

        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.cookie('token', token, jwtCookieOptions);

        res.redirect('/dashboard');
    } catch (err) {
        console.error('[Auth/Register] Error:', err.message);
        res.status(500).send('Server error');
    }
});

// POST: login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).send('Email and password are required');
        }

        const user = await User.findOne({ email: sanitize(email) });
        if (!user) {
            return res.status(400).send('Invalid email or password');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid email or password');
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.cookie('token', token, jwtCookieOptions);

        res.redirect('/dashboard');
    } catch (err) {
        console.error('[Auth/Login] Error:', err.message);
        res.status(500).send('Server error');
    }
});

// GET: logout
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/auth/login');
});

module.exports = router;
