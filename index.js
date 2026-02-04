const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔒 Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// 🌍 CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 📊 Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        status: false,
        error: 'Too many requests, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// 📝 Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📋 Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
});

// 🏠 Root endpoint
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: "🎬 CineSubz API is running!",
        version: "2.0.0",
        documentation: "/api",
        endpoints: [
            "GET /api - API documentation",
            "GET /api/home - Homepage content",
            "GET /api/search?q={query} - Search",
            "GET /api/movie?url={url} - Movie details",
            "GET /api/tvshow?url={url} - TV show details",
            "GET /api/episode?url={url} - Episode details",
            "GET /api/download?url={url} - Download links",
            "GET /api/genre/{genre}?page={page} - Browse by genre",
            "GET /api/info?url={url} - Auto-detect content"
        ],
        author: "CineSubz API",
        uptime: process.uptime()
    });
});

// 🔌 API Routes
app.use('/api', apiRoutes);

// 🏥 Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage()
    });
});

// ❌ 404 Handler
app.use((req, res) => {
    res.status(404).json({
        status: false,
        error: 'Endpoint not found',
        path: req.path,
        availableEndpoints: '/api'
    });
});

// 🚨 Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({
        status: false,
        error: 'Internal server error',
        message: err.message
    });
});

// 🚀 Start Server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║     🎬 CineSubz API Server Started!       ║
╠═══════════════════════════════════════════╣
║  🌐 URL: http://localhost:${PORT}            ║
║  📚 Docs: http://localhost:${PORT}/api       ║
║  🏥 Health: http://localhost:${PORT}/health  ║
╚═══════════════════════════════════════════╝
    `);
});

module.exports = app;
