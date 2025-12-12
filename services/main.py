# main.py
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import os
import uuid
import threading
from typing import Dict, Optional
import time
import glob

app = FastAPI()

# CORS налаштування
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Папка для завантажених відео
DOWNLOAD_FOLDER = os.path.join(os.getcwd(), "downloads")
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# Словник для зберігання інформації про завантаження
downloads: Dict[str, Dict] = {}


class DownloadRequest(BaseModel):
    url: str


class ProgressHook:
    def __init__(self, video_id: str):
        self.video_id = video_id

    def __call__(self, d):
        if d['status'] == 'downloading':
            try:
                # Розрахунок прогресу
                if 'total_bytes' in d:
                    total = d['total_bytes']
                    downloaded = d['downloaded_bytes']
                    progress = int((downloaded / total) * 100)
                elif 'total_bytes_estimate' in d:
                    total = d['total_bytes_estimate']
                    downloaded = d['downloaded_bytes']
                    progress = int((downloaded / total) * 100)
                else:
                    progress = 0

                downloads[self.video_id]['progress'] = min(progress, 99)
                downloads[self.video_id]['status'] = 'downloading'
                print(f"[{self.video_id}] Progress: {progress}%")
            except Exception as e:
                print(f"Помилка оновлення прогресу: {e}")

        elif d['status'] == 'finished':
            downloads[self.video_id]['progress'] = 100
            downloads[self.video_id]['status'] = 'processing'
            print(f"[{self.video_id}] Download finished, processing...")


def download_video(video_id: str, url: str):
    try:
        # Шаблон для збереження файлу
        output_template = os.path.join(DOWNLOAD_FOLDER, f"{video_id}.%(ext)s")
        
        ydl_opts = {
            'format': 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
            'outtmpl': output_template,
            'progress_hooks': [ProgressHook(video_id)],
            'no_warnings': True,
            'quiet': False,
            'no_color': True,
            'merge_output_format': 'mp4',  # Завжди конвертувати в mp4
        }

        print(f"[{video_id}] Starting download from: {url}")
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            # Отримуємо фактичне ім'я файлу
            filename = ydl.prepare_filename(info)
            
            # Якщо файл має інше розширення, шукаємо правильний файл
            if not os.path.exists(filename):
                # Шукаємо файл з таким же video_id
                possible_files = glob.glob(os.path.join(DOWNLOAD_FOLDER, f"{video_id}.*"))
                if possible_files:
                    filename = possible_files[0]
                    print(f"[{video_id}] Found file: {filename}")
            
            if os.path.exists(filename):
                downloads[video_id]['status'] = 'completed'
                downloads[video_id]['progress'] = 100
                downloads[video_id]['filename'] = filename
                downloads[video_id]['title'] = info.get('title', 'video')
                
                print(f"[{video_id}] Download completed: {filename}")
                print(f"[{video_id}] File size: {os.path.getsize(filename)} bytes")
                
                # Видалення через 1 годину
                threading.Timer(3600, lambda: cleanup_video(video_id)).start()
            else:
                raise Exception(f"File not found after download: {filename}")

    except Exception as e:
        downloads[video_id]['status'] = 'error'
        downloads[video_id]['error'] = str(e)
        print(f"[{video_id}] ERROR: {e}")


def cleanup_video(video_id: str):
    """Видалення відео та інформації про нього"""
    if video_id in downloads:
        filename = downloads[video_id].get('filename')
        if filename and os.path.exists(filename):
            try:
                os.remove(filename)
                print(f"[{video_id}] File deleted: {filename}")
            except Exception as e:
                print(f"[{video_id}] Error deleting file: {e}")
        
        downloads[video_id]['removed'] = True
        # Видаляємо з пам'яті через 5 хвилин
        threading.Timer(300, lambda: downloads.pop(video_id, None)).start()


@app.post("/download")
async def start_download(request: DownloadRequest):
    """Початок завантаження відео"""
    try:
        video_id = str(uuid.uuid4())
        
        print(f"[{video_id}] New download request: {request.url}")
        
        # Ініціалізація запису про завантаження
        downloads[video_id] = {
            'url': request.url,
            'progress': 0,
            'status': 'downloading',
            'filename': None,
            'title': None,
            'error': None,
            'removed': False,
            'created_at': time.time()
        }
        
        # Запуск завантаження в окремому потоці
        thread = threading.Thread(
            target=download_video,
            args=(video_id, request.url)
        )
        thread.daemon = True
        thread.start()
        
        return {
            "id": video_id,
            "message": "Завантаження розпочато"
        }
    
    except Exception as e:
        print(f"Error starting download: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/progress/{video_id}")
async def get_progress(video_id: str):
    """Отримання прогресу завантаження"""
    if video_id not in downloads:
        raise HTTPException(status_code=404, detail="Завантаження не знайдено")
    
    download_info = downloads[video_id]
    
    response = {
        "progress": download_info['progress'],
        "status": download_info['status'],
        "error": download_info.get('error'),
        "removed": download_info.get('removed', False)
    }
    
    # Додаємо URL для завантаження, якщо відео готове
    if download_info['status'] == 'completed' and not download_info.get('removed'):
        response['download_url'] = f"/api/file/{video_id}"
    
    return response


@app.get("/file/{video_id}")
async def download_file(video_id: str):
    """Завантаження файлу відео"""
    print(f"[{video_id}] File download requested")
    
    if video_id not in downloads:
        print(f"[{video_id}] ERROR: Download not found")
        raise HTTPException(status_code=404, detail="Завантаження не знайдено")
    
    download_info = downloads[video_id]
    
    if download_info['status'] != 'completed':
        print(f"[{video_id}] ERROR: Status is {download_info['status']}")
        raise HTTPException(status_code=400, detail="Відео ще не завантажено")
    
    filename = download_info.get('filename')
    
    print(f"[{video_id}] Filename from dict: {filename}")
    
    if not filename or not os.path.exists(filename):
        print(f"[{video_id}] ERROR: File not found or doesn't exist")
        print(f"[{video_id}] Files in download folder:")
        for f in os.listdir(DOWNLOAD_FOLDER):
            print(f"  - {f}")
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    
    # Визначаємо ім'я файлу для завантаження
    title = download_info.get('title', 'video')
    # Очищаємо ім'я від небезпечних символів
    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
    ext = os.path.splitext(filename)[1]
    download_name = f"{safe_title}{ext}"
    
    print(f"[{video_id}] Sending file: {filename} as {download_name}")
    
    return FileResponse(
        path=filename,
        filename=download_name,
        media_type='application/octet-stream'
    )


@app.get("/")
async def root():
    active = len([d for d in downloads.values() if d['status'] == 'downloading'])
    completed = len([d for d in downloads.values() if d['status'] == 'completed'])
    
    return {
        "message": "YouTube Video Downloader API",
        "status": "running",
        "active_downloads": active,
        "completed_downloads": completed,
        "total_downloads": len(downloads),
        "download_folder": DOWNLOAD_FOLDER
    }


@app.get("/debug/{video_id}")
async def debug_download(video_id: str):
    """Debug endpoint для перевірки статусу"""
    if video_id not in downloads:
        return {"error": "Not found"}
    
    info = downloads[video_id].copy()
    
    if info.get('filename'):
        info['file_exists'] = os.path.exists(info['filename'])
        if info['file_exists']:
            info['file_size'] = os.path.getsize(info['filename'])
    
    return info


if __name__ == "__main__":
    import uvicorn
    print(f"Download folder: {DOWNLOAD_FOLDER}")
    uvicorn.run(app, host="0.0.0.0", port=8000)