const axios = require("axios");
const { load } = require("cheerio");

const baseUrl = "https://cinesubz.lk";

// 🔄 Axios instance with better config
const axiosInstance = axios.create({
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
});

// 📦 Download link, size, quality extract function
function extractLinks(dl2) {
    const regexLink = /dlLink:\s*\["(.*?)"]/g;
    const regexSize = /size:\s*"(.*?)"/g;
    const regexQuality = /resolution:\s*"(.*?)"/g;

    const links = [...dl2.matchAll(regexLink)].map(match => match[1]);
    const sizes = [...dl2.matchAll(regexSize)].map(match => match[1]);
    const qualities = [...dl2.matchAll(regexQuality)].map(match => match[1]);

    return links.map((link, index) => ({
        link: link.split('"')[0],
        size: sizes[index]?.split('"')[0] || "",
        quality: qualities[index]?.split('"')[0] || "",
    }));
}

// 🛠️ Enhanced HTML fetcher with retry
async function fetchHtml(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axiosInstance.get(url);
            return response.data;
        } catch (e) {
            console.error(`Attempt ${i + 1} failed for ${url}:`, e.message);
            if (i === retries - 1) throw new Error('Error fetching HTML after retries');
            await new Promise(r => setTimeout(r, 1000 * (i + 1))); // exponential backoff
        }
    }
}

// 📥 Get download URLs from page
async function getCineDownloadUrls($) {
    const downloadUrls = [];
    
    // Method 1: Table rows
    $('tr.clidckable-rowdd').each((index, element) => {
        const quality = $(element).find('td:nth-child(1)').text().trim();
        const size = $(element).find('td:nth-child(2)').text().trim();
        const language = $(element).find('td:nth-child(3)').text().trim();
        let link = $(element).attr('data-href');
        
        if (link) {
            link = link.replace("cinesubz.net", "cinesubz.lk");
            downloadUrls.push({ quality, size, language, link });
        }
    });

    // Method 2: Script extraction if no table found
    if (downloadUrls.length === 0) {
        const scripts = $('script').toArray();
        for (const script of scripts) {
            const scriptText = $(script).html() || "";
            if (scriptText.includes('dlLink')) {
                const extraData = extractLinks(scriptText);
                for (const data of extraData) {
                    downloadUrls.push({
                        quality: data.quality,
                        size: data.size,
                        language: "",
                        link: data.link
                    });
                }
            }
        }
    }

    // Method 3: Direct download buttons
    if (downloadUrls.length === 0) {
        $('.download-links a, .dwnlds a, a.download-btn').each((i, el) => {
            const link = $(el).attr('href');
            const text = $(el).text().trim();
            if (link && link.includes('api')) {
                downloadUrls.push({
                    quality: text || 'Download',
                    size: '',
                    language: '',
                    link: link.replace("cinesubz.net", "cinesubz.lk")
                });
            }
        });
    }

    return downloadUrls;
}

// ✅ URL Validator
function isValidUrl(url) {
    const httpsRegex = /^https:\/\/[^\s/$.?#].[^\s]*$/;
    return httpsRegex.test(url);
}

// 🌐 API Request helper
async function ApiReq(data, url) {
    try {
        const res = await axiosInstance.post(url, data, {
            headers: { "Content-Type": "application/json" }
        });
        return res.data;
    } catch (error) {
        console.error('API Request Error:', error.message);
        return null;
    }
}

// 🔗 URL Replacement function
async function replaceUrl(query) {
    try {
        if (!query) throw new Error("Query is empty!");

        const html = await fetchHtml(query);
        const $ = load(html);
        let link = $('#link').attr('href') || query;

        const urlMappings = [
            { patterns: ["google.com/server11/1:/", "google.com/server12/1:/", "google.com/server13/1:/"], replace: 'drive2.cscloud12.online/server1/' },
            { patterns: ["google.com/server21/1:/", "google.com/server22/1:/", "google.com/server23/1:/"], replace: 'drive2.cscloud12.online/server2/' },
            { patterns: ["google.com/server3/1:/"], replace: 'drive2.cscloud12.online/server3/' },
            { patterns: ["google.com/server4/1:/"], replace: 'drive2.cscloud12.online/server4/' },
            { patterns: ["google.com/server5/1:/"], replace: 'drive2.cscloud12.online/server5/' },
        ];

        for (const mapping of urlMappings) {
            for (const pattern of mapping.patterns) {
                if (link.includes(pattern)) {
                    link = link.replace(pattern, mapping.replace);
                    break;
                }
            }
        }

        // Extension fixes
        const extReplacements = [
            { from: ".mp4?bot=cscloud2bot&code=", to: "?ext=mp4&bot=cscloud2bot&code=" },
            { from: ".mp4", to: "?ext=mp4" },
            { from: ".mkv?bot=cscloud2bot&code=", to: "?ext=mkv&bot=cscloud2bot&code=" },
            { from: ".mkv", to: "?ext=mkv" },
            { from: ".zip", to: "?ext=zip" },
        ];

        for (const rep of extReplacements) {
            if (link.includes(rep.from)) {
                link = link.replace(rep.from, rep.to);
                break;
            }
        }

        return link;
    } catch (error) {
        console.error('Replace URL Error:', error.message);
        return query;
    }
}

// 🧹 Title cleaner helper
function cleanTitle(title) {
    return title
        .replace(/(Sinhala Subtitles?\s*\|\s*සිංහල උපසිරැසි සමඟ|Sinhala Subtitles?|with Sinhala Subtitles?|සිංහල උපසිරැසි\s*සමඟ|\|\s*සිංහල උපසිරැසි(?:\s*සමඟ)?)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// 🖼️ Image URL fixer
function fixImageUrl(url) {
    if (!url) return null;
    return url
        .replace("fit=", "fit")
        .replace(/-\d+x\d+\.jpg$/, '.jpg')
        .replace("cinesubz.net", "cinesubz.lk");
}

//====================================================================

class Cinesubz {
    constructor() {
        this.baseUrl = baseUrl;
    }

    // 🔍 Search Movies & TV Shows
    async search(query) {
        try {
            if (!query || query.trim() === '') {
                throw new Error("Search query cannot be empty!");
            }

            const html = await fetchHtml(`${baseUrl}?s=${encodeURIComponent(query)}`);
            const $ = load(html);

            let movies = [];
            
            // Primary search method
            $("#contenedor > div.module > div.content.rigth.csearch > div > div > article").each((i, el) => {
                const imdb = $(el).find("div.details > div.meta > span.rating:nth-child(1)").text().toUpperCase().replace("IMDB ", "").trim();
                const year = $(el).find("div.details > div.meta > span.year").text().trim();
                const title = $(el).find("div.details > div.title > a").text().trim();
                const link = $(el).find("div.details > div.title > a").attr("href")?.replace("cinesubz.net", "cinesubz.lk");
                const image = fixImageUrl($(el).find("div.image > div > a > img").attr("src"));
                const type = $(el).find("div.image > div > a > span").text().trim() || "Movie";
                const description = $(el).find("div.details > div.contenido > p").text().trim();
                
                if (title && link) {
                    movies.push({ 
                        title: cleanTitle(title), 
                        originalTitle: title,
                        imdb, 
                        year, 
                        link, 
                        image, 
                        type, 
                        description 
                    });
                }
            });

            // Alternative search - check different selectors
            if (movies.length === 0) {
                $("article.item").each((i, el) => {
                    const title = $(el).find(".data h3 a, .title a").text().trim();
                    const link = $(el).find(".data h3 a, .title a, a").first().attr("href")?.replace("cinesubz.net", "cinesubz.lk");
                    const image = fixImageUrl($(el).find("img").first().attr("src"));
                    const year = $(el).find(".data span, .year").text().trim();
                    const type = link?.includes("tvshows") ? "TV" : "Movie";
                    
                    if (title && link) {
                        movies.push({
                            title: cleanTitle(title),
                            originalTitle: title,
                            imdb: "",
                            year,
                            link,
                            image,
                            type,
                            description: ""
                        });
                    }
                });
            }

            // API fallback search
            if (movies.length === 0) {
                try {
                    const apiResponse = await axiosInstance.get(
                        `${baseUrl}/wp-json/dooplay/search/?keyword=${encodeURIComponent(query)}&nonce=03dfb5c5ca`
                    );
                    const jsonData = apiResponse.data;

                    if (jsonData && typeof jsonData === 'object') {
                        const jsonArray = Object.values(jsonData);
                        jsonArray.forEach(el => {
                            if (el && el.title) {
                                const type = el.url?.includes("movies") ? "Movie" : "TV";
                                movies.push({
                                    title: cleanTitle(el.title),
                                    originalTitle: el.title,
                                    imdb: el.extra?.imdb || "",
                                    year: el.extra?.date || "",
                                    link: el.url,
                                    image: el.img,
                                    type,
                                    description: ""
                                });
                            }
                        });
                    }
                } catch (apiError) {
                    console.error('API Search fallback failed:', apiError.message);
                }
            }

            const mvList = movies.filter(i => i.type === "Movie");
            const tvList = movies.filter(i => i.type === "TV");

            return {
                status: true,
                query,
                total: movies.length,
                all: movies,
                movies: mvList,
                tvshows: tvList
            };

        } catch (error) {
            console.error('Search Error:', error.message);
            return {
                status: false,
                error: error.message,
                query,
                total: 0,
                all: [],
                movies: [],
                tvshows: []
            };
        }
    }

    // 🎬 Get Movie Data
    async movieData(url) {
        try {
            if (!url) throw new Error("URL is required!");

            const html = await fetchHtml(url);
            const $ = load(html);

            const title = $("div.data > h1").text().trim();
            const maintitle = cleanTitle(title);
            const dateCreate = $(".extra span:nth-child(1)").text().trim();
            const country = $(".country").text().trim();
            const runtime = $(".runtime").text().trim();
            const mainImage = fixImageUrl($(".poster img").attr("src"));
            const titleLong = $(".tagline1").text().trim();
            
            // Categories
            const categorydata = $(".sgeneros a").map((i, el) => $(el).text().trim()).get();
            const category = categorydata.length > 0 ? categorydata : 
                $(".sgeneros").text().trim().match(/([A-Z][a-z]+|\d+\+?)/g) || [];

            // Director
            const directorName = $("#cast div:nth-child(3) div div.data div.name a").text().trim();
            const directorUrl = $("#cast div:nth-child(3) div div.data div.name a").attr("href");

            // Ratings
            const ratingValue = $('.sheader .starstruck-rating .dt_rating_vgs').text().trim() || "0";
            const ratingCount = $('.sheader .starstruck-rating .rating-count').text().trim() || "0";
            const imdbrating = $(".rating-number").text().trim() || "0";
            const imdbratingCount = $(".votes-count").text().trim().replace("votes", "").trim() || "0";

            // Description
            const description = $('#info div[itemprop="description"]').clone().find('script').remove().end().text().trim() ||
                                $('meta[property="og:description"]').attr('content') || "";

            // Cast
            const cast = [];
            $("#cast > div:nth-child(5) > div, #cast .person").each((i, el) => {
                const actorName = $(el).find("div.name a").text().trim();
                const actorUrl = $(el).find("div.name a").attr("href");
                const castName = $(el).find(".caracter").text().trim();
                if (actorName) {
                    cast.push({
                        actor: { name: actorName, link: actorUrl },
                        character: castName
                    });
                }
            });

            // Images
            const imageUrls = [];
            $('meta[property="og:image"]').each((i, el) => {
                const content = $(el).attr('content');
                if (content) imageUrls.push(content.trim());
            });

            // Trailer
            const trailer = $('#trailer iframe').attr('src') || 
                           $('iframe[src*="youtube"]').attr('src') || null;

            // Download URLs
            const downloadUrl = await getCineDownloadUrls($);

            return {
                status: true,
                type: "movie",
                maintitle,
                title,
                titleLong,
                dateCreate,
                country,
                runtime,
                category,
                mainImage,
                imageUrls,
                description,
                trailer,
                rating: { value: ratingValue, count: ratingCount },
                imdb: { value: imdbrating, count: imdbratingCount },
                director: { name: directorName, link: directorUrl },
                cast,
                downloadUrl,
                url
            };

        } catch (error) {
            console.error('Movie Data Error:', error.message);
            return { status: false, error: error.message, url };
        }
    }

    // 📺 Get TV Show Data
    async tvshowData(url) {
        try {
            if (!url) throw new Error("URL is required!");

            const html = await fetchHtml(url);
            const $ = load(html);

            const title = $("div.data > h1").text().trim();
            const maintitle = cleanTitle(title);
            const dateCreate = $(".extra span:nth-child(1)").text().trim();
            const dateEnd = $("#info div:nth-child(6) span").text().trim();
            const country = $("#dtcreator1 span a").text().trim() || $(".country").text().trim();
            const language = $("#dtstudio1 span a").text().trim();
            const mainImage = fixImageUrl($(".poster img").attr("src"));
            
            // Categories
            const categorydata = $(".sgeneros a").map((i, el) => $(el).text().trim()).get();
            const category = categorydata.length > 0 ? categorydata :
                $(".sgeneros").text().trim().match(/([A-Z][a-z]+|\d+\+?)/g) || [];

            // Director/Creator
            const directorName = $("#cast div:nth-child(2) div div.data div.name a").text().trim();
            const directorUrl = $("#cast div:nth-child(2) div div.data div.name a").attr("href");

            // Ratings
            const ratingValue = $('.sheader .starstruck-rating .dt_rating_vgs').text().trim() || "0";
            const ratingCount = $('.sheader .starstruck-rating .rating-count').text().trim() || "0";
            const imdbrating = $("#repimdb strong:nth-child(1)").text().trim() || 
                              $(".rating-number").text().trim() || "0";
            const imdbratingCount = $("#repimdb").text().replace(imdbrating, "").trim().replace("votes", "").trim() || "0";

            // Description
            const description = $("#info > div.wp-content > p").clone().find('script').remove().end().text().trim() ||
                               $('meta[property="og:description"]').attr('content') || "";

            // Cast
            const cast = [];
            $("#cast div:nth-child(4) div.person, #cast .person").each((i, el) => {
                const actorName = $(el).find("div.name a").text().trim();
                const actorUrl = $(el).find("div.name a").attr("href");
                const castName = $(el).find(".caracter").text().trim();
                if (actorName && actorUrl) {
                    cast.push({
                        actor: { name: actorName, link: actorUrl },
                        character: castName
                    });
                }
            });

            // Images
            const imageUrls = [];
            $('meta[property="og:image"]').each((i, el) => {
                const content = $(el).attr('content');
                if (content) imageUrls.push(content.trim());
            });

            // Trailer
            const trailer = $('#trailer iframe').attr('src') || 
                           $('iframe[src*="youtube"]').attr('src') || null;

            // Episodes & Seasons
            const episodesDetails = [];
            $('#seasons .se-q').each((index, element) => {
                const seasonNumber = $(element).find('.se-t').text().trim();
                const seasonDate = $(element).find('.title i').text().trim();
                const seasonTitle = $(element).find('.title').text().trim().replace(seasonDate, '').trim();

                const seasonEpisodes = [];
                $(element).next('.se-a').find('.episodios li').each((idx, elem) => {
                    let episodeNumber = $(elem).find('.numerando').text().trim();
                    const episodeTitleFull = $(elem).find('.episodiotitle a').text().trim();
                    const episodeURL = $(elem).find('.episodiotitle a, .episode-link').attr('href');
                    const episodeDate = $(elem).find('.episodiotitle .date').text().trim();
                    const episodeImage = $(elem).find('img').attr('src');

                    episodeNumber = episodeNumber.replace(/S(\d+)\s*E(\d+)/i, (match, s, e) => 
                        `${parseInt(s)} - ${parseInt(e)}`
                    );

                    if (episodeURL) {
                        seasonEpisodes.push({
                            number: episodeNumber,
                            title: cleanTitle(episodeTitleFull),
                            url: episodeURL.replace("cinesubz.net", "cinesubz.lk"),
                            date: episodeDate,
                            image: episodeImage
                        });
                    }
                });

                if (seasonNumber) {
                    episodesDetails.push({
                        season: {
                            number: seasonNumber,
                            title: seasonTitle,
                            date: seasonDate
                        },
                        episodes: seasonEpisodes,
                        totalEpisodes: seasonEpisodes.length
                    });
                }
            });

            return {
                status: true,
                type: "tvshow",
                maintitle,
                title,
                country,
                language,
                dateCreate,
                dateEnd,
                category,
                mainImage,
                imageUrls,
                description,
                trailer,
                rating: { value: ratingValue, count: ratingCount },
                imdb: { value: imdbrating, count: imdbratingCount },
                director: { name: directorName, link: directorUrl },
                cast,
                totalSeasons: episodesDetails.length,
                episodesDetails,
                url
            };

        } catch (error) {
            console.error('TV Show Data Error:', error.message);
            return { status: false, error: error.message, url };
        }
    }

    // 📺 Get Episode Data
    async episodeData(url) {
        try {
            if (!url) throw new Error("URL is required!");

            const html = await fetchHtml(url);
            const $ = load(html);

            const maintitle = cleanTitle($('#info .epih1').text().trim().replace(/\s*\[.*?\]\s*/, ''));
            const title = $('#info .epih1').text().trim().replace(/\s*\[.*?\]\s*/, '');
            const dateCreate = $("#info span").text().trim();
            const episodeTitle = $('#info .epih3').text().trim();

            // Episode navigation
            const prevEpisode = $('.navep a.prev').attr('href') || null;
            const nextEpisode = $('.navep a.next').attr('href') || null;

            // Images
            const imageUrls = [];
            $('meta[property="og:image"]').each((i, el) => {
                const content = $(el).attr('content');
                if (content) imageUrls.push(content.trim());
            });

            // Download URLs
            const downloadUrl = await getCineDownloadUrls($);

            return {
                status: true,
                type: "episode",
                maintitle,
                title,
                episodeTitle,
                dateCreate,
                imageUrls,
                navigation: {
                    previous: prevEpisode?.replace("cinesubz.net", "cinesubz.lk"),
                    next: nextEpisode?.replace("cinesubz.net", "cinesubz.lk")
                },
                downloadUrl,
                url
            };

        } catch (error) {
            console.error('Episode Data Error:', error.message);
            return { status: false, error: error.message, url };
        }
    }

    // 📥 Get Download Links
    async download(query) {
        try {
            if (!query) throw new Error("Download URL is required!");

            const link = query.includes(`${baseUrl}/api`) ? await replaceUrl(query) : query;
            const html = await fetchHtml(link);
            const $ = load(html);
            
            const title = $("#box > div.download-section > p:nth-child(2) > span").text().trim() ||
                         $("title").text().trim();

            // Parallel API requests
            const requests = {
                gdrive: ApiReq({ gdrive: true }, link),
                gdrive2: ApiReq({ gdrive: true, second: true }, link),
                direct: ApiReq({ direct: true }, link),
                mega: ApiReq({ mega: true }, link),
                pixel: ApiReq({ pix: true, nc: true }, link),
                pixel2: ApiReq({ pix: true }, link),
            };

            const responses = await Promise.allSettled(
                Object.entries(requests).map(([key, promise]) =>
                    promise.then(data => ({ key, data })).catch(() => ({ key, data: null }))
                )
            );

            const result = {
                status: true,
                title: title,
                mimetype: null,
                download: {
                    gdrive: null,
                    gdrive2: null,
                    direct: null,
                    mega: null,
                    pixel: null,
                    pixel2: null
                }
            };

            responses.forEach(({ status, value }) => {
                if (status === "fulfilled" && value?.data) {
                    const url = value.data?.url || value.data?.mega || null;
                    result.download[value.key] = url;
                    if (value.key === "gdrive" && value.data?.mime) {
                        result.mimetype = value.data.mime;
                    }
                }
            });

            // Check if any download available
            const hasDownloads = Object.values(result.download).some(v => v !== null);
            result.hasDownloads = hasDownloads;

            return result;

        } catch (error) {
            console.error('Download Error:', error.message);
            return {
                status: false,
                error: error.message,
                title: null,
                mimetype: null,
                download: {
                    gdrive: null,
                    gdrive2: null,
                    direct: null,
                    mega: null,
                    pixel: null,
                    pixel2: null
                },
                hasDownloads: false
            };
        }
    }

    // 🏠 Get Home Page Data (Latest Movies & TV Shows)
    async getHome() {
        try {
            const html = await fetchHtml(baseUrl);
            const $ = load(html);

            const latestMovies = [];
            const latestTvShows = [];
            const featured = [];

            // Featured/Slider
            $('.slider .item, #slider article').each((i, el) => {
                const title = $(el).find('.data h3, .title').text().trim();
                const link = $(el).find('a').first().attr('href')?.replace("cinesubz.net", "cinesubz.lk");
                const image = fixImageUrl($(el).find('img').first().attr('src'));
                const year = $(el).find('.year, .data span').text().trim();
                
                if (title && link) {
                    featured.push({
                        title: cleanTitle(title),
                        link,
                        image,
                        year
                    });
                }
            });

            // Latest Movies
            $('#archive-content article, .items article').each((i, el) => {
                const title = $(el).find('.data h3, .title').text().trim();
                const link = $(el).find('.data h3 a, .title a, a').first().attr('href')?.replace("cinesubz.net", "cinesubz.lk");
                const image = fixImageUrl($(el).find('img').first().attr('src'));
                const year = $(el).find('.year, .data span').text().trim();
                const type = $(el).find('.quality, span').text().trim();
                const imdb = $(el).find('.rating').text().trim();

                if (title && link) {
                    const item = {
                        title: cleanTitle(title),
                        link,
                        image,
                        year,
                        quality: type,
                        imdb
                    };

                    if (link.includes('tvshows')) {
                        latestTvShows.push(item);
                    } else {
                        latestMovies.push(item);
                    }
                }
            });

            return {
                status: true,
                featured,
                latestMovies,
                latestTvShows,
                totalFeatured: featured.length,
                totalMovies: latestMovies.length,
                totalTvShows: latestTvShows.length
            };

        } catch (error) {
            console.error('Home Data Error:', error.message);
            return {
                status: false,
                error: error.message,
                featured: [],
                latestMovies: [],
                latestTvShows: []
            };
        }
    }

    // 📂 Get Category/Genre
    async getGenre(genre, page = 1) {
        try {
            const url = `${baseUrl}/genre/${encodeURIComponent(genre)}/page/${page}/`;
            const html = await fetchHtml(url);
            const $ = load(html);

            const items = [];
            $('article.item').each((i, el) => {
                const title = $(el).find('.data h3, .title').text().trim();
                const link = $(el).find('.data h3 a, a').first().attr('href')?.replace("cinesubz.net", "cinesubz.lk");
                const image = fixImageUrl($(el).find('img').first().attr('src'));
                const year = $(el).find('.year').text().trim();
                const type = link?.includes('tvshows') ? 'TV' : 'Movie';

                if (title && link) {
                    items.push({
                        title: cleanTitle(title),
                        link,
                        image,
                        year,
                        type
                    });
                }
            });

            // Pagination
            const lastPage = $('.pagination a').last().attr('href');
            const hasNextPage = !!$('.pagination .next').length;

            return {
                status: true,
                genre,
                page,
                items,
                total: items.length,
                hasNextPage,
                lastPage
            };

        } catch (error) {
            console.error('Genre Error:', error.message);
            return {
                status: false,
                error: error.message,
                genre,
                items: []
            };
        }
    }
}

module.exports = Cinesubz;
