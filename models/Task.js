const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    scheduledFor: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'missed'],
        default: 'pending'
    },
    completedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// 🔎 Indexes for performance
taskSchema.index({ userId: 1, scheduledFor: 1 });
taskSchema.index({ userId: 1, status: 1 });

// ⏱️ Middleware to track completion timestamp
taskSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        if (this.status === 'completed') {
            this.completedAt = this.completedAt || new Date();
        } else {
            this.completedAt = null;
        }
    }
    next();
});

// 🔮 Virtual: is task overdue?
taskSchema.virtual('isOverdue').get(function () {
    return this.status === 'pending' && this.scheduledFor < new Date();
});

// 🔁 Instance Method: auto-update status if time has passed
taskSchema.methods.updateStatus = async function () {
    if (this.status === 'pending' && this.scheduledFor < new Date()) {
        this.status = 'missed';
        await this.save();
    }
};

// 🧹 Static: clean tasks older than 30 days
taskSchema.statics.cleanupOldTasks = function () {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.deleteMany({ scheduledFor: { $lt: thirtyDaysAgo } });
};

// 📅 Static: get tasks in a date range
taskSchema.statics.getTasksForDateRange = function (userId, startDate, endDate) {
    return this.find({
        userId,
        scheduledFor: { $gte: startDate, $lte: endDate }
    }).sort({ scheduledFor: 1 });
};

module.exports = mongoose.model('Task', taskSchema);
