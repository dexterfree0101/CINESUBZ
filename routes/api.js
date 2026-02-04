const express = require('express');
const router = express.Router();
const Cinesubz = require('../lib/cinesubz');

const cine = new Cinesubz();

// 📋 API Info
router.get('/', (req, res) => {
    res.json({
        status: true,
        name: "CineSubz API",
        version: "2.0.0",
        description: "CineSubz.lk Movie & TV Show Scraper API",
        endpoints: {
            home: {
                method: "GET",
                path: "/api/home",
                description: "Get homepage content (featured, latest movies & TV shows)"
            },
            search: {
                method: "GET",
                path: "/api/search?q={query}",
                description: "Search movies and TV shows",
                params: { q: "Search query (required)" }
            },
            movie: {
                method: "GET",
                path: "/api/movie?url={url}",
                description: "Get movie details and download links",
                params: { url: "Movie page URL (required)" }
            },
            tvshow: {
                method: "GET",
                path: "/api/tvshow?url={url}",
                description: "Get TV show details with episodes",
                params: { url: "TV show page URL (required)" }
            },
            episode: {
                method: "GET",
                path: "/api/episode?url={url}",
                description: "Get episode details and download links",
                params: { url: "Episode page URL (required)" }
            },
            download: {
                method: "GET",
                path: "/api/download?url={url}",
                description: "Get direct download links",
                params: { url: "Download page URL (required)" }
            },
            genre: {
                method: "GET",
                path: "/api/genre/{genre}?page={page}",
                description: "Get movies/shows by genre",
                params: { 
                    genre: "Genre name (e.g., action, comedy)",
                    page: "Page number (optional, default: 1)"
                }
            }
        },
        author: "CineSubz API",
        github: "https://github.com/yourusername/cinesubz-api"
    });
});

// 🏠 Home
router.get('/home', async (req, res) => {
    try {
        const data = await cine.getHome();
        res.json(data);
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

// 🔍 Search
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q || req.query.query;
        
        if (!query) {
            return res.status(400).json({
                status: false,
                error: "Query parameter 'q' is required",
                example: "/api/search?q=spider-man"
            });
        }

        const data = await cine.search(query);
        res.json(data);
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

// 🎬 Movie Data
router.get('/movie', async (req, res) => {
    try {
        const url = req.query.url;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                error: "URL parameter is required",
                example: "/api/movie?url=https://cinesubz.lk/movies/example"
            });
        }

        const data = await cine.movieData(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

// 📺 TV Show Data
router.get('/tvshow', async (req, res) => {
    try {
        const url = req.query.url;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                error: "URL parameter is required",
                example: "/api/tvshow?url=https://cinesubz.lk/tvshows/example"
            });
        }

        const data = await cine.tvshowData(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

// 📺 Episode Data
router.get('/episode', async (req, res) => {
    try {
        const url = req.query.url;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                error: "URL parameter is required",
                example: "/api/episode?url=https://cinesubz.lk/episodes/example"
            });
        }

        const data = await cine.episodeData(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

// 📥 Download
router.get('/download', async (req, res) => {
    try {
        const url = req.query.url;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                error: "URL parameter is required",
                example: "/api/download?url=https://cinesubz.lk/api/..."
            });
        }

        const data = await cine.download(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

// 📂 Genre
router.get('/genre/:genre', async (req, res) => {
    try {
        const genre = req.params.genre;
        const page = parseInt(req.query.page) || 1;
        
        const data = await cine.getGenre(genre, page);
        res.json(data);
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

// 🔄 Auto-detect content type
router.get('/info', async (req, res) => {
    try {
        const url = req.query.url;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                error: "URL parameter is required"
            });
        }

        let data;
        if (url.includes('/movies/')) {
            data = await cine.movieData(url);
        } else if (url.includes('/tvshows/')) {
            data = await cine.tvshowData(url);
        } else if (url.includes('/episodes/')) {
            data = await cine.episodeData(url);
        } else {
            return res.status(400).json({
                status: false,
                error: "Unknown content type. Use /movie, /tvshow, or /episode endpoint"
            });
        }
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ status: false, error: error.message });
    }
});

module.exports = router;
