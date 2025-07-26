const express = require('express');
const bodyParser = require('body-parser');
const browserRoutes = require('./routes/browserRoutes'); // Import browser routes

const app = express();

// Middleware
app.use(bodyParser.json());

// Routes
// All routes under /browser will be handled by browserRoutes
app.use('/browser', browserRoutes);

// Basic error handling middleware (for uncaught errors in routes)
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

module.exports = app;
