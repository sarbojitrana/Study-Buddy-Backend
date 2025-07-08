const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long'],
        maxlength: [50, 'Username must be less than 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [EMAIL_REGEX, 'Please enter a valid email']
    }, 
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    profilePicture: {
        type: String,
        default: null
    },
    preferences: {
        timezone: {
            type: String,
            default: 'UTC'
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            taskReminders: {
                type: Boolean,
                default: true
            }
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// 🔎 Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

// 🪪 Virtual: Display name
userSchema.virtual('displayName').get(function () {
    return this.username;
});

// 📊 Virtual: Task count
userSchema.virtual('taskCount', {
    ref: 'Task',
    localField: '_id',
    foreignField: 'userId',
    count: true
});

// 🔐 Password hashing middleware
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        this.password = await bcrypt.hash(this.password, 12);
        next();
    } catch (err) {
        return next(err);
    }
});

// 🔑 Compare hashed password
userSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// 📅 Update last login timestamp
userSchema.methods.updateLastLogin = function () {
    this.lastLogin = new Date();
    return this.save({ validateBeforeSave: false });
};

// 🔎 Static: Find by email or username
userSchema.statics.findByEmailOrUsername = function (identifier) {
    const trimmed = identifier.trim().toLowerCase();
    return this.findOne({
        $or: [{ email: trimmed }, { username: trimmed }]
    });
};

// 📈 Static: Get user + task stats
userSchema.statics.getUserStats = async function (userId) {
    const user = await this.findById(userId);
    if (!user) return null;

    const Task = mongoose.model('Task');
    const stats = await Task.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const taskStats = {
        pending: 0,
        completed: 0,
        missed: 0,
        total: 0
    };

    stats.forEach(stat => {
        taskStats[stat._id] = stat.count;
        taskStats.total += stat.count;
    });

    return {
        user: user.toObject(),
        taskStats
    };
};

// 🚫 Strip password from responses
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    return user;
};

module.exports = mongoose.model('User', userSchema);
