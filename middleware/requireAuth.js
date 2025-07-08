const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return redirectToLogin(res);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select('-password -__v');
        if (!user || user.isActive === false) {
            return redirectToLogin(res);
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('[Auth Middleware] Invalid token or error:', err.message);
        return redirectToLogin(res);
    }
};

// 🔁 Utility function to handle token cleanup + redirect
function redirectToLogin(res) {
    res.clearCookie('token');
    return res.redirect('/auth/login');
}
