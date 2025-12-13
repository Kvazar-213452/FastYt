from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import uuid
import threading
from typing import Dict, Optional
import time
import yt_dlp

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_FOLDER = os.path.join(os.getcwd(), "downloads")
COOKIES_FILE = os.path.join(os.getcwd(), "cookies.txt")
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

downloads: Dict[str, Dict] = {}


class DownloadSettings(BaseModel):
    format: str = "mp4"
    quality: str = "highest"
    videoCodec: str = "h264"
    audioOnly: bool = False


class DownloadRequest(BaseModel):
    url: str
    settings: Optional[DownloadSettings] = None


def format_duration(seconds):
    if not seconds:
        return "Unknown"
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes}:{secs:02d}"


def progress_hook(d, video_id):
    """Hook для відстеження прогресу yt-dlp"""
    if video_id not in downloads:
        return
    
    try:
        if d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
            downloaded = d.get('downloaded_bytes', 0)
            
            if total > 0:
                progress = int((downloaded / total) * 100)
                downloads[video_id]['progress'] = min(progress, 99)
                downloads[video_id]['downloaded_bytes'] = downloaded
                downloads[video_id]['filesize'] = total
                
                # Швидкість та ETA
                speed = d.get('speed', 0)
                eta = d.get('eta', 0)
                if speed:
                    downloads[video_id]['speed'] = speed
                if eta:
                    downloads[video_id]['eta'] = eta
                
                print(f"[{video_id}] Progress: {progress}% ({downloaded}/{total} bytes)")
        
        elif d['status'] == 'finished':
            downloads[video_id]['status'] = 'processing'
            print(f"[{video_id}] Download finished, processing...")
            
    except Exception as e:
        print(f"[{video_id}] Progress hook error: {e}")


def download_video(video_id: str, url: str, settings: Optional[DownloadSettings] = None):
    try:
        if settings is None:
            settings = DownloadSettings()
        
        print(f"[{video_id}] Starting download: {url}")
        
        downloads[video_id]['start_time'] = time.time()
        downloads[video_id]['status'] = 'fetching_info'
        
        # Налаштування yt-dlp з обходом ботозахисту
        ydl_opts = {
            'outtmpl': os.path.join(DOWNLOAD_FOLDER, f'{video_id}.%(ext)s'),
            'progress_hooks': [lambda d: progress_hook(d, video_id)],
            'quiet': False,
            'no_warnings': False,
            # Використовуємо Android клієнт для обходу захисту
            'extractor_args': {
                'youtube': {
                    'player_client': ['android_creator'],
                    'player_skip': ['webpage'],
                }
            },
            # Додаткові налаштування для обходу
            'socket_timeout': 30,
        }
        
        # ЗАВЖДИ використовуємо cookies якщо файл існує
        if os.path.exists(COOKIES_FILE):
            ydl_opts['cookiefile'] = COOKIES_FILE
            print(f"[{video_id}] ✓ Using cookies from: {COOKIES_FILE}")
            
            # Перевірка вмісту файлу
            try:
                with open(COOKIES_FILE, 'r') as f:
                    cookie_content = f.read()
                    cookie_lines = [line for line in cookie_content.split('\n') if line.strip() and not line.startswith('#')]
                    print(f"[{video_id}] ✓ Loaded {len(cookie_lines)} cookies")
            except Exception as e:
                print(f"[{video_id}] ⚠ Warning reading cookies: {e}")
        else:
            print(f"[{video_id}] ✗ No cookies file found at: {COOKIES_FILE}")
            print(f"[{video_id}] Trying without cookies (may fail)...")
        
        # Налаштування формату
        if settings.audioOnly or settings.format == 'mp3':
            ydl_opts['format'] = 'bestaudio/best'
            if settings.format == 'mp3':
                ydl_opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }]
        else:
            # Вибір якості відео
            quality_map = {
                'highest': 'bestvideo+bestaudio/best',
                'high': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
                'medium': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
                'low': 'bestvideo[height<=480]+bestaudio/best[height<=480]'
            }
            ydl_opts['format'] = quality_map.get(settings.quality, 'bestvideo+bestaudio/best')
            
            # Налаштування для WebM
            if settings.format == 'webm':
                if settings.videoCodec == 'vp9':
                    ydl_opts['format'] = 'bestvideo[ext=webm][vcodec^=vp9]+bestaudio[ext=webm]/best[ext=webm]'
                ydl_opts['merge_output_format'] = 'webm'
            else:
                ydl_opts['merge_output_format'] = 'mp4'
        
        # Завантажуємо відео
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Спочатку отримуємо інформацію
            info = ydl.extract_info(url, download=False)
            
            # Зберігаємо метадані
            downloads[video_id]['title'] = info.get('title', 'Unknown')
            downloads[video_id]['duration'] = info.get('duration', 0)
            downloads[video_id]['duration_string'] = format_duration(info.get('duration', 0))
            downloads[video_id]['thumbnail'] = info.get('thumbnail', '')
            downloads[video_id]['uploader'] = info.get('uploader', 'Unknown')
            downloads[video_id]['view_count'] = info.get('view_count', 0)
            
            print(f"[{video_id}] Title: {info.get('title')}")
            print(f"[{video_id}] Duration: {format_duration(info.get('duration', 0))}")
            
            # Тепер завантажуємо
            downloads[video_id]['status'] = 'downloading'
            ydl.download([url])
        
        # Знаходимо завантажений файл
        file_extension = 'mp3' if settings.format == 'mp3' else settings.format
        expected_path = os.path.join(DOWNLOAD_FOLDER, f'{video_id}.{file_extension}')
        
        # Перевіряємо всі можливі розширення
        possible_extensions = [file_extension, 'mp4', 'webm', 'mkv', 'm4a']
        output_path = None
        
        for ext in possible_extensions:
            test_path = os.path.join(DOWNLOAD_FOLDER, f'{video_id}.{ext}')
            if os.path.exists(test_path):
                output_path = test_path
                break
        
        if not output_path:
            raise Exception("Файл не знайдено після завантаження")
        
        print(f"[{video_id}] Download completed: {output_path}")
        
        downloads[video_id]['status'] = 'completed'
        downloads[video_id]['progress'] = 100
        downloads[video_id]['filename'] = output_path
        downloads[video_id]['filesize'] = os.path.getsize(output_path)
        downloads[video_id]['format'] = file_extension
        
        # Видалення через 1 годину
        threading.Timer(3600, lambda: cleanup_video(video_id)).start()
        
    except Exception as e:
        downloads[video_id]['status'] = 'error'
        downloads[video_id]['error'] = str(e)
        downloads[video_id]['progress'] = 0
        print(f"[{video_id}] ERROR: {e}")


def cleanup_video(video_id: str):
    """Видалення відео"""
    if video_id in downloads:
        filename = downloads[video_id].get('filename')
        if filename and os.path.exists(filename):
            try:
                os.remove(filename)
                print(f"[{video_id}] File deleted")
            except Exception as e:
                print(f"[{video_id}] Error deleting: {e}")
        
        downloads[video_id]['removed'] = True
        threading.Timer(300, lambda: downloads.pop(video_id, None)).start()


@app.post("/upload-cookies")
async def upload_cookies(file: UploadFile = File(...)):
    """Завантаження cookies"""
    try:
        if not file.filename.endswith('.txt'):
            raise HTTPException(status_code=400, detail="Тільки .txt файли")
        
        content = await file.read()
        with open(COOKIES_FILE, 'wb') as f:
            f.write(content)
        
        print(f"Cookies uploaded: {COOKIES_FILE}")
        
        return {
            "success": True,
            "message": "Cookies завантажено",
            "filename": file.filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/cookies")
async def delete_cookies():
    """Видалення cookies"""
    try:
        if os.path.exists(COOKIES_FILE):
            os.remove(COOKIES_FILE)
            return {"success": True, "message": "Cookies видалено"}
        return {"success": False, "message": "Cookies не знайдено"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cookies/status")
async def cookies_status():
    """Статус cookies"""
    exists = os.path.exists(COOKIES_FILE)
    
    if exists:
        size = os.path.getsize(COOKIES_FILE)
        
        # Читаємо та аналізуємо cookies
        try:
            with open(COOKIES_FILE, 'r') as f:
                content = f.read()
                lines = content.split('\n')
                cookie_lines = [line for line in lines if line.strip() and not line.startswith('#')]
                
                # Перевіряємо важливі cookies
                has_sid = any('SID' in line for line in cookie_lines)
                has_hsid = any('HSID' in line for line in cookie_lines)
                has_visitor = any('VISITOR' in line for line in cookie_lines)
                
                return {
                    "exists": True,
                    "size": size,
                    "path": COOKIES_FILE,
                    "total_cookies": len(cookie_lines),
                    "has_essential_cookies": has_sid and has_hsid,
                    "details": {
                        "has_SID": has_sid,
                        "has_HSID": has_hsid,
                        "has_VISITOR": has_visitor
                    },
                    "first_lines": lines[:5] if len(lines) > 0 else []
                }
        except Exception as e:
            return {
                "exists": True,
                "size": size,
                "path": COOKIES_FILE,
                "error": f"Could not read cookies: {str(e)}"
            }
    else:
        return {
            "exists": False,
            "size": 0,
            "path": COOKIES_FILE,
            "message": "Cookies file not found. Create cookies.txt in the root directory."
        }


@app.post("/download")
async def start_download(request: DownloadRequest):
    """Початок завантаження"""
    try:
        video_id = str(uuid.uuid4())
        
        print(f"[{video_id}] New request: {request.url}")
        
        downloads[video_id] = {
            'url': request.url,
            'progress': 0,
            'status': 'fetching_info',
            'filename': None,
            'title': 'Fetching info...',
            'duration': 0,
            'duration_string': '',
            'thumbnail': '',
            'uploader': '',
            'view_count': 0,
            'filesize': 0,
            'downloaded_bytes': 0,
            'speed': 0,
            'eta': 0,
            'error': None,
            'removed': False,
            'created_at': time.time(),
            'start_time': time.time(),
            'format': request.settings.format if request.settings else 'mp4'
        }
        
        thread = threading.Thread(
            target=download_video,
            args=(video_id, request.url, request.settings)
        )
        thread.daemon = True
        thread.start()
        
        return {
            "success": True,
            "id": video_id,
            "message": "Завантаження розпочато"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/progress/{video_id}")
async def get_progress(video_id: str):
    """Прогрес завантаження"""
    if video_id not in downloads:
        raise HTTPException(status_code=404, detail="Не знайдено")
    
    download_info = downloads[video_id]
    
    response = {
        "progress": download_info['progress'],
        "status": download_info['status'],
        "title": download_info.get('title', ''),
        "duration": download_info.get('duration', 0),
        "duration_string": download_info.get('duration_string', ''),
        "thumbnail": download_info.get('thumbnail', ''),
        "uploader": download_info.get('uploader', ''),
        "view_count": download_info.get('view_count', 0),
        "filesize": download_info.get('filesize', 0),
        "downloaded_bytes": download_info.get('downloaded_bytes', 0),
        "speed": download_info.get('speed', 0),
        "eta": download_info.get('eta', 0),
        "error": download_info.get('error'),
        "removed": download_info.get('removed', False),
        "format": download_info.get('format', 'mp4')
    }
    
    if download_info['status'] == 'completed' and not download_info.get('removed'):
        response['download_url'] = f"/api/file/{video_id}"
    
    return response


@app.get("/file/{video_id}")
async def download_file(video_id: str):
    """Завантаження файлу"""
    if video_id not in downloads:
        raise HTTPException(status_code=404, detail="Не знайдено")
    
    download_info = downloads[video_id]
    
    if download_info['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Ще не готово")
    
    filename = download_info.get('filename')
    
    if not filename or not os.path.exists(filename):
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    
    title = download_info.get('title', 'video')
    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
    file_format = download_info.get('format', 'mp4')
    download_name = f"{safe_title}.{file_format}"
    
    mime_types = {
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'webm': 'video/webm'
    }
    media_type = mime_types.get(file_format, 'application/octet-stream')
    
    return FileResponse(
        path=filename,
        filename=download_name,
        media_type=media_type
    )


@app.get("/")
async def root():
    active = len([d for d in downloads.values() if d['status'] in ['downloading', 'fetching_info', 'processing']])
    completed = len([d for d in downloads.values() if d['status'] == 'completed'])
    
    # Перевірка версії yt-dlp
    try:
        import subprocess
        result = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True)
        ytdlp_version = result.stdout.strip()
    except:
        ytdlp_version = "unknown"
    
    # Перевірка cookies
    cookies_info = "Not loaded"
    if os.path.exists(COOKIES_FILE):
        try:
            with open(COOKIES_FILE, 'r') as f:
                content = f.read()
                cookie_count = len([line for line in content.split('\n') if line.strip() and not line.startswith('#')])
                cookies_info = f"Loaded ({cookie_count} cookies)"
        except:
            cookies_info = "Error reading file"
    
    return {
        "message": "YouTube Downloader API (yt-dlp)",
        "status": "running",
        "active_downloads": active,
        "completed_downloads": completed,
        "total_downloads": len(downloads),
        "cookies_status": cookies_info,
        "cookies_path": COOKIES_FILE,
        "ytdlp_version": ytdlp_version,
        "instructions": "Place cookies.txt file in the root directory or use /upload-cookies endpoint"
    }


@app.get("/update-ytdlp")
async def update_ytdlp():
    """Оновити yt-dlp до останньої версії"""
    try:
        import subprocess
        result = subprocess.run(
            ['pip', 'install', '--upgrade', 'yt-dlp'],
            capture_output=True,
            text=True
        )
        return {
            "success": True,
            "output": result.stdout,
            "message": "yt-dlp оновлено"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    print(f"Download folder: {DOWNLOAD_FOLDER}")
    print(f"Using yt-dlp for downloads")
    if os.path.exists(COOKIES_FILE):
        print("✓ Cookies loaded")
    uvicorn.run(app, host="0.0.0.0", port=20459)