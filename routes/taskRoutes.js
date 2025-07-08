const express = require('express');
const Task = require('../models/Task');
const requireAuth = require('../middleware/requireAuth');
const cleanupOldTasks = require('../middleware/cleanupOldTasks');

const router = express.Router();
const isJsonRequest = (req) =>
    req.headers.accept && req.headers.accept.includes('application/json');


// Apply middleware to all routes
router.use(requireAuth);
router.use(cleanupOldTasks);

// Helper to generate status for each date
const getDayStatusMap = (tasks) => {
    const statusMap = {};

    const priority = { missed: 3, pending: 2, completed: 1 };
    const colorFor = (statuses) => {
        if (statuses.includes('missed')) return 'red';
        if (statuses.includes('pending')) return 'yellow';
        return 'green';
    };

    for (const task of tasks) {
        const key = new Date(task.scheduledFor).toISOString().split('T')[0];
        if (!statusMap[key]) statusMap[key] = [];
        statusMap[key].push(task.status);
    }

    const colorMap = {};
    for (const date in statusMap) {
        colorMap[date] = colorFor(statusMap[date]);
    }

    return colorMap;
};


// Auto-mark missed tasks helper
const updateMissedTasks = async (tasks) => {
    const now = new Date();
    const updates = [];

    for (const task of tasks) {
        if (task.status === 'pending' && new Date(task.scheduledFor) < now) {
            task.status = 'missed';
            updates.push(task.save());
        }
    }

    await Promise.all(updates);
    return tasks;
};

// DASHBOARD VIEW - Main tasks page
router.get('/', async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.user._id }).sort({ scheduledFor: 1 });
        await updateMissedTasks(tasks);

        // Check if request expects JSON (AJAX call) or HTML
        if (isJsonRequest(req)) {
            res.json({
                success: true,
                tasks,
                user: req.user
            });
        } else {
            res.render('dashboard', { user: req.user, tasks });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// MONTHLY CALENDAR VIEW

router.get('/calendar', async (req, res) => {
    try {
        let userId = req.user._id;

        // Fetch all tasks for the user
        let tasks = await Task.find({ userId });

        tasks = await updateMissedTasks(tasks) ;

        // Convert to date-string -> status[] mapping
        const taskMap = {};

        tasks.forEach(task => {
            const dateKey = new Date(task.scheduledFor).toISOString().split('T')[0]; // YYYY-MM-DD

            if (!taskMap[dateKey]) taskMap[dateKey] = [];

            taskMap[dateKey].push({ status: task.status });
        });

        res.render('calendar', { taskMap });

    } catch (err) {
        console.error("Calendar load error:", err);
        res.status(500).send("Server Error");
    }
});


function determineStatus(scheduledFor, currentStatus) {
    const now = new Date();
    const scheduled = new Date(scheduledFor);

    if (currentStatus === 'completed') return 'completed';
    if (scheduled < now) return 'missed';
    return 'pending';
}

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { title, description, status, scheduledFor } = req.body;

        const task = await Task.findById(req.params.id);

        if (!task) return res.status(404).send('Task not found');

        task.title = title;
        task.description = description;
        task.status = determineStatus(task.scheduledFor, status); // Use helper logic

        await task.save();

        const taskDate = new Date(task.scheduledFor).toISOString().split('T')[0];
        res.redirect(`/tasks/day/${taskDate}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


// DAILY TASK VIEW
router.get('/day/:date', async (req, res) => {
    try {
        const userId = req.user._id;
        const { date } = req.params; // Expected format: YYYY-MM-DD

        const startOfDay = new Date(`${date}T00:00:00.000Z`);
        const endOfDay = new Date(`${date}T23:59:59.999Z`);

        const tasks = await Task.find({
            userId,
            scheduledFor: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        });

        res.render('day', { date, tasks }); // ✅ Also make sure the path is 'tasks/day' if that's where the EJS is.

    } catch (err) {
        console.error("Day view error:", err);
        res.status(500).send("Server Error");
    }
});



// CREATE TASK
router.post('/create', async (req, res) => {
    try {
        const { title, description, scheduledFor } = req.body;

        const task = await Task.create({
            userId: req.user._id,
            title,
            description,
            scheduledFor: new Date(scheduledFor),
            status: 'pending'
        });

        // Return JSON response for AJAX calls
        if (isJsonRequest(req)) {
            res.json({
                success: true,
                task,
                message: 'Task created successfully'
            });
        } else {
            res.redirect('/tasks');
        }
    } catch (error) {
        if (isJsonRequest(req)) {
            res.status(400).json({ success: false, error: error.message });
        } else {
            res.redirect('/tasks?error=' + encodeURIComponent(error.message));
        }
    }
});

// UPDATE TASK STATUS
router.post('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { status },
            { new: true }
        );

        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        // Return JSON response for AJAX calls
        if (isJsonRequest(req)) {
            res.json({
                success: true,
                task,
                message: 'Task status updated successfully'
            });
        } else {
            res.redirect('/tasks');
        }
    } catch (error) {
        if (isJsonRequest(req)) {
            res.status(400).json({ success: false, error: error.message });
        } else {
            res.redirect('/tasks?error=' + encodeURIComponent(error.message));
        }
    }
});


// router.put('/tasks/:id', async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Update the task
//     await Task.findByIdAndUpdate(id, req.body, {
//       new: true,
//       runValidators: true,
//     });

//     // Optional logging
//     console.log("Redirecting to:", req.body.redirectTo);

//     // Redirect back
//     res.redirect(req.body.redirectTo || '/tasks');
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });



// DELETE TASK
router.delete('/:id', async (req, res) => {
    try {
        const task = await Task.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        // Return JSON response for AJAX calls
        if (isJsonRequest(req)) {
            res.json({
                success: true,
                message: 'Task deleted successfully'
            });
        } else {
            res.redirect('/tasks');
        }
    } catch (error) {
        if (isJsonRequest(req)) {
            res.status(400).json({ success: false, error: error.message });
        } else {
            res.redirect('/tasks?error=' + encodeURIComponent(error.message));
        }
    }
});

// GET SINGLE TASK (for editing)

router.get('/:id', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, error: 'Invalid Task ID' });
    }

    try {
        const task = await Task.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        res.json({
            success: true,
            task
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});
module.exports = router;