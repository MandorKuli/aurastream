from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import yt_dlp
import os
import subprocess
import tempfile
import asyncio
from pathlib import Path

app = FastAPI(title="AuraStream Audio Backend", version="2.0.0")

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache for extracted audio URLs (video_id -> {url, expires})
_url_cache = {}

@app.get("/")
def read_root():
    return {"status": "AuraStream Backend v2 is running 🚀", "engine": "yt-dlp"}

@app.get("/api/health")
def health_check():
    """Health check endpoint for the frontend to probe backend availability."""
    return {"status": "ok"}

@app.get("/api/stream/{video_id}")
async def get_audio_stream(video_id: str):
    """
    Extracts the direct audio URL from YouTube and proxies the audio stream
    back to the browser. This avoids CORS issues and the need for a YouTube
    iframe player entirely.
    
    The audio is streamed through our server so the browser sees it as a
    same-origin audio file — no CORS, no iframe, just pure HTML5 <audio>.
    """
    import time
    
    # Check cache first
    cached = _url_cache.get(video_id)
    if cached and cached.get('expires', 0) > time.time():
        audio_url = cached['url']
        content_type = cached.get('content_type', 'audio/webm')
    else:
        ydl_opts = {
            'format': 'bestaudio[ext=webm]/bestaudio/best',
            'noplaylist': True,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                audio_url = info.get('url', None)
                
                if not audio_url:
                    raise HTTPException(status_code=404, detail="Audio URL not found")
                
                # Determine content type
                ext = info.get('ext', 'webm')
                content_type_map = {
                    'webm': 'audio/webm',
                    'opus': 'audio/ogg',
                    'm4a': 'audio/mp4',
                    'mp3': 'audio/mpeg',
                }
                content_type = content_type_map.get(ext, 'audio/webm')
                
                # Cache for 30 minutes (YouTube URLs typically expire in ~6 hours)
                _url_cache[video_id] = {
                    'url': audio_url,
                    'content_type': content_type,
                    'expires': time.time() + 1800
                }
                
        except yt_dlp.utils.DownloadError as e:
            print(f"yt-dlp error for {video_id}: {e}")
            raise HTTPException(status_code=404, detail="Video not found or unavailable")
        except Exception as e:
            print(f"Error extracting audio for {video_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # Stream the audio through our server to avoid CORS
    import httpx
    
    async def audio_stream_generator():
        """Proxies the remote audio through our server in chunks."""
        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            async with client.stream("GET", audio_url) as response:
                async for chunk in response.aiter_bytes(chunk_size=65536):
                    yield chunk
    
    return StreamingResponse(
        audio_stream_generator(),
        media_type=content_type,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
        }
    )

@app.get("/api/search/{query}")
async def search_youtube(query: str):
    """
    Search YouTube for music videos and return metadata.
    This can be used as a fallback when Piped/Invidious are down.
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
        'default_search': 'ytsearch15',
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"ytsearch15:{query}", download=False)
            entries = info.get('entries', [])
            
            results = []
            for entry in entries:
                if entry:
                    results.append({
                        'id': f"youtube_{entry.get('id', '')}",
                        'title': entry.get('title', 'Unknown'),
                        'artist': entry.get('uploader', entry.get('channel', 'YouTube Artist')),
                        'album': 'YouTube Music',
                        'coverUrl': f"https://img.youtube.com/vi/{entry.get('id', '')}/hqdefault.jpg",
                        'streamUrl': entry.get('id', ''),
                        'duration': entry.get('duration', 0) or 0,
                        'source': 'youtube'
                    })
            
            return JSONResponse(content=results)
    except Exception as e:
        print(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"\n[*] AuraStream Audio Backend v2.0")
    print(f"   Streaming engine: yt-dlp (proxied audio)")
    print(f"   Server: http://localhost:{port}")
    print(f"   Health: http://localhost:{port}/api/health\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
