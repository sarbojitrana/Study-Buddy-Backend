const Task = require('../models/Task');

// Middleware: delete tasks older than 1 month for this user
module.exports = async function cleanupOldTasks(req, res, next) {
    try {
        if (!req.user || !req.user.id) {
            return next(); // No authenticated user
        }

        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

        const result = await Task.deleteMany({
            userId: req.user.id,
            scheduledFor: { $lt: cutoffDate }
        });

        // Log only if needed — you can remove in prod
        if (result.deletedCount > 0) {
            console.log(`🧹 ${result.deletedCount} old tasks deleted for user ${req.user.id}`);
        }

        next();
    } catch (err) {
        console.error('[TaskCleanup] Error:', err.message);
        next(); // Let request continue even if cleanup fails
    }
};
