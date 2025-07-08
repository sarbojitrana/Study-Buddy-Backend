const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const requireAuth = require('./middleware/requireAuth');
const methodOverride = require('method-override');

dotenv.config();

const app = express();

const cors = require('cors');
app.use(cors({
    origin: 'https://study-buddy-one.vercel.app',
    credentials: true
}));


// Debug logs
app.use((req, res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.originalUrl}`);
    next();
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../studybuddy/client/views'));

app.use('/styles', express.static(path.join(__dirname, '../studybuddy/client/styles')));
app.use(express.static(path.join(__dirname, '../studybuddy/client/public')));




// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// Routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.get('/', (req, res) => res.render('home'));
app.get('/dashboard', requireAuth, (req, res) => res.redirect('/tasks'));

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('error', {
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { url: req.originalUrl });
});

// ✅ Always start server
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected successfully');
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });
