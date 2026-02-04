const axios = require("axios");
const { load } = require("cheerio");

const baseUrl = "https://cinesubz.lk";

// 🔄 Axios instance with proper headers
const axiosInstance = axios.create({
    timeout: 30000,
    maxRedirects: 5,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
    }
});

// 🌐 Fetch HTML with retry
async function fetchHtml(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`📡 Fetching: ${url}`);
            const response = await axiosInstance.get(url);
            return response.data;
        } catch (e) {
            console.error(`❌ Attempt ${i + 1} failed:`, e.message);
            if (i === retries - 1) throw new Error(`Failed to fetch: ${url}`);
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
}

// 📦 Extract download links from script tags
function extractLinksFromScript(scriptContent) {
    const downloads = [];
    
    try {
        // Pattern 1: dlLink array
        const dlLinkMatches = scriptContent.matchAll(/dlLink:\s*\["([^"]+)"\]/g);
        const sizeMatches = scriptContent.matchAll(/size:\s*"([^"]+)"/g);
        const resolutionMatches = scriptContent.matchAll(/resolution:\s*"([^"]+)"/g);
        
        const links = [...dlLinkMatches].map(m => m[1]);
        const sizes = [...sizeMatches].map(m => m[1]);
        const resolutions = [...resolutionMatches].map(m => m[1]);
        
        links.forEach((link, i) => {
            downloads.push({
                quality: resolutions[i] || 'Unknown',
                size: sizes[i] || '',
                language: '',
                link: link.replace('cinesubz.net', 'cinesubz.lk')
            });
        });
    } catch (e) {
        console.error('Script extraction error:', e.message);
    }
    
    return downloads;
}

// 📥 Get download URLs from movie/episode page
async function getCineDownloadUrls($) {
    const downloadUrls = [];
    
    // ✅ Method 1: Table rows with data-href
    $('tr.clidckable-rowdd, tr[data-href]').each((i, el) => {
        const quality = $(el).find('td:nth-child(1)').text().trim();
        const size = $(el).find('td:nth-child(2)').text().trim();
        const language = $(el).find('td:nth-child(3)').text().trim();
        let link = $(el).attr('data-href');
        
        if (link) {
            downloadUrls.push({
                quality: quality || 'Download',
                size,
                language,
                link: link.replace('cinesubz.net', 'cinesubz.lk')
            });
        }
    });
    
    console.log(`📋 Method 1 (Table): Found ${downloadUrls.length} links`);
    
    // ✅ Method 2: Script extraction
    if (downloadUrls.length === 0) {
        $('script').each((i, el) => {
            const scriptText = $(el).html() || '';
            if (scriptText.includes('dlLink') || scriptText.includes('defined')) {
                const extracted = extractLinksFromScript(scriptText);
                downloadUrls.push(...extracted);
            }
        });
        console.log(`📋 Method 2 (Script): Found ${downloadUrls.length} links`);
    }
    
    // ✅ Method 3: Download buttons/links
    if (downloadUrls.length === 0) {
        $('a[href*="/api/"], a[href*="api/?id="]').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            
            if (href && !downloadUrls.some(d => d.link === href)) {
                downloadUrls.push({
                    quality: text.match(/\d+p/)?.[0] || text || 'Download',
                    size: text.match(/[\d.]+\s*[GM]B/i)?.[0] || '',
                    language: '',
                    link: href.replace('cinesubz.net', 'cinesubz.lk')
                });
            }
        });
        console.log(`📋 Method 3 (Buttons): Found ${downloadUrls.length} links`);
    }
    
    return downloadUrls;
}

// 🔗 Process API page to get sonic-cloud URL
async function getApiPageLinks(apiUrl) {
    try {
        console.log(`🔗 Processing API page: ${apiUrl}`);
        
        const html = await fetchHtml(apiUrl);
        const $ = load(html);
        
        // Get the redirect/download link
        let mainLink = $('#link').attr('href') || 
                       $('a#link').attr('href') ||
                       $('a.download-link').attr('href') ||
                       $('meta[http-equiv="refresh"]').attr('content')?.match(/url=(.+)/i)?.[1];
        
        console.log(`📎 Found main link: ${mainLink}`);
        
        return mainLink || null;
        
    } catch (e) {
        console.error('API page error:', e.message);
        return null;
    }
}

// 📥 Get final download links from sonic-cloud page
async function getSonicCloudLinks(sonicUrl) {
    try {
        console.log(`☁️ Fetching sonic-cloud page: ${sonicUrl}`);
        
        const html = await fetchHtml(sonicUrl);
        const $ = load(html);
        
        const downloads = {
            fileName: '',
            fileSize: '',
            directCS: null,
            direct1: null,
            google1: null,
            google2: null,
            telegram: null,
            streamUrl: sonicUrl
        };
        
        // Extract file info
        downloads.fileName = $('body').text().match(/File Name:\s*([^\n]+)/i)?.[1]?.trim() || '';
        downloads.fileSize = $('body').text().match(/File Size:\s*([^\n]+)/i)?.[1]?.trim() || '';
        
        // Find all download buttons/links
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim().toLowerCase();
            
            if (!href) return;
            
            if (text.includes('direct download') && text.includes('cs')) {
                downloads.directCS = href;
            } else if (text.includes('direct download 1') || text.includes('direct 1')) {
                downloads.direct1 = href;
            } else if (text.includes('google download 1') || text.includes('google 1')) {
                downloads.google1 = href;
            } else if (text.includes('google download 2') || text.includes('google 2')) {
                downloads.google2 = href;
            } else if (text.includes('telegram')) {
                downloads.telegram = href;
            }
        });
        
        // Alternative: find by button classes
        if (!downloads.directCS) {
            downloads.directCS = $('a.btn-cs, a[href*="cscloud"]').first().attr('href');
        }
        if (!downloads.google1) {
            downloads.google1 = $('a[href*="drive.google"]').first().attr('href');
        }
        
        console.log(`✅ Sonic-cloud links extracted:`, downloads);
        
        return downloads;
        
    } catch (e) {
        console.error('Sonic-cloud error:', e.message);
        return null;
    }
}

// 🧹 Clean title
function cleanTitle(title) {
    return title
        .replace(/(Sinhala Subtitles?\s*\|\s*සිංහල උපසිරැසි සමඟ|Sinhala Subtitles?|with Sinhala Subtitles?|සිංහල උපසිරැසි\s*සමඟ|\|\s*සිංහල උපසිරැසි(?:\s*සමඟ)?)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

//====================================================================

class Cinesubz {
    constructor() {
        this.baseUrl = baseUrl;
    }

    // 🔍 Search
    async search(query) {
        try {
            if (!query?.trim()) throw new Error("Search query is required!");
            
            const html = await fetchHtml(`${baseUrl}/?s=${encodeURIComponent(query)}`);
            const $ = load(html);
            
            const results = [];
            
            // Main search results
            $('article.item, .result-item, #contenedor article').each((i, el) => {
                const titleEl = $(el).find('.data h3 a, .title a, h3 a').first();
                const title = titleEl.text().trim();
                const link = titleEl.attr('href')?.replace('cinesubz.net', 'cinesubz.lk');
                const image = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');
                const year = $(el).find('.year, .data span, .meta span').first().text().trim();
                const imdb = $(el).find('.rating, .imdb').text().replace(/[^\d.]/g, '') || '';
                const type = link?.includes('tvshows') ? 'TV' : 'Movie';
                const description = $(el).find('.contenido p, .text p').text().trim();
                
                if (title && link) {
                    results.push({
                        title: cleanTitle(title),
                        originalTitle: title,
                        link,
                        image,
                        year,
                        imdb,
                        type,
                        description
                    });
                }
            });
            
            return {
                status: true,
                query,
                total: results.length,
                movies: results.filter(r => r.type === 'Movie'),
                tvshows: results.filter(r => r.type === 'TV'),
                all: results
            };
            
        } catch (e) {
            console.error('Search error:', e.message);
            return { status: false, error: e.message, query, total: 0, all: [] };
        }
    }

    // 🎬 Movie Data
    async movieData(url) {
        try {
            if (!url) throw new Error("URL is required!");
            
            const html = await fetchHtml(url);
            const $ = load(html);
            
            const title = $('h1').first().text().trim();
            const image = $('.poster img').attr('src');
            const description = $('.wp-content p, [itemprop="description"] p').first().text().trim();
            const year = $('.extra .year, .year').first().text().trim();
            const runtime = $('.runtime').text().trim();
            const imdb = $('.rating-number, .imdb strong').first().text().trim();
            const genres = $('.sgeneros a').map((i, el) => $(el).text().trim()).get();
            const country = $('.country').text().trim();
            
            // Trailer
            const trailer = $('iframe[src*="youtube"]').attr('src') || null;
            
            // Cast
            const cast = [];
            $('#cast .person, .cast .person').each((i, el) => {
                const name = $(el).find('.name a').text().trim();
                const character = $(el).find('.caracter').text().trim();
                const photo = $(el).find('img').attr('src');
                if (name) cast.push({ name, character, photo });
            });
            
            // Download links
            const downloadUrl = await getCineDownloadUrls($);
            
            return {
                status: true,
                type: 'movie',
                title: cleanTitle(title),
                originalTitle: title,
                image,
                description,
                year,
                runtime,
                imdb,
                genres,
                country,
                trailer,
                cast,
                downloadUrl,
                totalDownloads: downloadUrl.length,
                url
            };
            
        } catch (e) {
            console.error('Movie data error:', e.message);
            return { status: false, error: e.message, url };
        }
    }

    // 📺 TV Show Data
    async tvshowData(url) {
        try {
            if (!url) throw new Error("URL is required!");
            
            const html = await fetchHtml(url);
            const $ = load(html);
            
            const title = $('h1').first().text().trim();
            const image = $('.poster img').attr('src');
            const description = $('.wp-content p').first().text().trim();
            const imdb = $('.rating-number').first().text().trim();
            const genres = $('.sgeneros a').map((i, el) => $(el).text().trim()).get();
            
            // Seasons & Episodes
            const seasons = [];
            $('#seasons .se-q').each((i, el) => {
                const seasonNum = $(el).find('.se-t').text().trim();
                const seasonTitle = $(el).find('.title').text().trim();
                const episodes = [];
                
                $(el).next('.se-a').find('li').each((j, ep) => {
                    const epNum = $(ep).find('.numerando').text().trim();
                    const epTitle = $(ep).find('.episodiotitle a').text().trim();
                    const epUrl = $(ep).find('.episodiotitle a').attr('href')?.replace('cinesubz.net', 'cinesubz.lk');
                    const epImage = $(ep).find('img').attr('src');
                    const epDate = $(ep).find('.date').text().trim();
                    
                    if (epUrl) {
                        episodes.push({
                            number: epNum,
                            title: cleanTitle(epTitle),
                            url: epUrl,
                            image: epImage,
                            date: epDate
                        });
                    }
                });
                
                if (seasonNum) {
                    seasons.push({
                        number: seasonNum,
                        title: seasonTitle,
                        episodes,
                        totalEpisodes: episodes.length
                    });
                }
            });
            
            return {
                status: true,
                type: 'tvshow',
                title: cleanTitle(title),
                originalTitle: title,
                image,
                description,
                imdb,
                genres,
                seasons,
                totalSeasons: seasons.length,
                url
            };
            
        } catch (e) {
            console.error('TV show error:', e.message);
            return { status: false, error: e.message, url };
        }
    }

    // 📺 Episode Data
    async episodeData(url) {
        try {
            if (!url) throw new Error("URL is required!");
            
            const html = await fetchHtml(url);
            const $ = load(html);
            
            const showTitle = $('.epih1, h1').first().text().trim();
            const episodeTitle = $('.epih3, h2').first().text().trim();
            const image = $('meta[property="og:image"]').attr('content');
            
            // Navigation
            const prevEp = $('.navep a.prev, a.prevep').attr('href')?.replace('cinesubz.net', 'cinesubz.lk');
            const nextEp = $('.navep a.next, a.nextep').attr('href')?.replace('cinesubz.net', 'cinesubz.lk');
            
            // Download links
            const downloadUrl = await getCineDownloadUrls($);
            
            return {
                status: true,
                type: 'episode',
                showTitle: cleanTitle(showTitle),
                episodeTitle: cleanTitle(episodeTitle),
                image,
                navigation: { prev: prevEp, next: nextEp },
                downloadUrl,
                totalDownloads: downloadUrl.length,
                url
            };
            
        } catch (e) {
            console.error('Episode error:', e.message);
            return { status: false, error: e.message, url };
        }
    }

    // 📥 Get Final Download Links
    async download(apiUrl) {
        try {
            if (!apiUrl) throw new Error("Download URL is required!");
            
            console.log(`\n🎬 Processing download: ${apiUrl}`);
            
            // Step 1: If it's a movie/episode page, get download links first
            if (apiUrl.includes('/movies/') || apiUrl.includes('/episodes/')) {
                const html = await fetchHtml(apiUrl);
                const $ = load(html);
                const downloadLinks = await getCineDownloadUrls($);
                
                if (downloadLinks.length === 0) {
                    return {
                        status: false,
                        error: "No download links found on page",
                        url: apiUrl
                    };
                }
                
                // Process first download link
                apiUrl = downloadLinks[0].link;
                console.log(`📎 Using first download link: ${apiUrl}`);
            }
            
            // Step 2: Get the sonic-cloud URL from API page
            const sonicUrl = await getApiPageLinks(apiUrl);
            
            if (!sonicUrl) {
                return {
                    status: false,
                    error: "Could not find download redirect URL",
                    url: apiUrl
                };
            }
            
            // Step 3: Get final download links from sonic-cloud
            const finalLinks = await getSonicCloudLinks(sonicUrl);
            
            if (!finalLinks) {
                // Return the sonic URL if we couldn't parse the page
                return {
                    status: true,
                    streamUrl: sonicUrl,
                    download: {
                        stream: sonicUrl,
                        direct: null,
                        google: null
                    },
                    url: apiUrl
                };
            }
            
            return {
                status: true,
                fileName: finalLinks.fileName,
                fileSize: finalLinks.fileSize,
                streamUrl: finalLinks.streamUrl,
                download: {
                    stream: finalLinks.streamUrl,
                    directCS: finalLinks.directCS,
                    direct1: finalLinks.direct1,
                    google1: finalLinks.google1,
                    google2: finalLinks.google2,
                    telegram: finalLinks.telegram
                },
                hasDownloads: !!(finalLinks.directCS || finalLinks.google1 || finalLinks.streamUrl),
                url: apiUrl
            };
            
        } catch (e) {
            console.error('Download error:', e.message);
            return { status: false, error: e.message, url: apiUrl };
        }
    }

    // 🏠 Home Page
    async getHome() {
        try {
            const html = await fetchHtml(baseUrl);
            const $ = load(html);
            
            const latestMovies = [];
            const latestTvShows = [];
            
            $('#archive-content article, .items article').each((i, el) => {
                const title = $(el).find('.data h3, .title').text().trim();
                const link = $(el).find('a').first().attr('href')?.replace('cinesubz.net', 'cinesubz.lk');
                const image = $(el).find('img').first().attr('src');
                const year = $(el).find('.year').text().trim();
                const quality = $(el).find('.quality').text().trim();
                
                if (title && link) {
                    const item = { title: cleanTitle(title), link, image, year, quality };
                    
                    if (link.includes('tvshows')) {
                        latestTvShows.push(item);
                    } else {
                        latestMovies.push(item);
                    }
                }
            });
            
            return {
                status: true,
                latestMovies,
                latestTvShows,
                totalMovies: latestMovies.length,
                totalTvShows: latestTvShows.length
            };
            
        } catch (e) {
            return { status: false, error: e.message };
        }
    }
}

module.exports = Cinesubz;
