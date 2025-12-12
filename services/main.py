from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pytubefix import YouTube
from pytubefix.cli import on_progress
import os
import uuid
import threading
from typing import Dict
import time

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


def format_duration(seconds):
    """Форматує тривалість у читабельний формат"""
    if not seconds:
        return "Unknown"
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes}:{secs:02d}"


def progress_callback(stream, chunk, bytes_remaining):
    """Callback для відстеження прогресу"""
    video_id = getattr(stream, '_video_id', None)
    if not video_id or video_id not in downloads:
        return
    
    try:
        total_size = stream.filesize
        bytes_downloaded = total_size - bytes_remaining
        progress = int((bytes_downloaded / total_size) * 100)
        
        downloads[video_id]['progress'] = min(progress, 99)
        downloads[video_id]['status'] = 'downloading'
        downloads[video_id]['downloaded_bytes'] = bytes_downloaded
        
        print(f"[{video_id}] Progress: {progress}%")
    except Exception as e:
        print(f"Помилка оновлення прогресу: {e}")


def download_video(video_id: str, url: str):
    try:
        print(f"[{video_id}] Starting download from: {url}")
        
        # Створюємо об'єкт YouTube
        yt = YouTube(url, on_progress_callback=progress_callback)
        
        # Додаємо video_id до потоку для callback
        for stream in yt.streams:
            stream._video_id = video_id
        
        # Отримуємо інформацію про відео
        downloads[video_id]['title'] = yt.title
        downloads[video_id]['duration'] = yt.length
        downloads[video_id]['duration_string'] = format_duration(yt.length)
        downloads[video_id]['thumbnail'] = yt.thumbnail_url
        downloads[video_id]['uploader'] = yt.author
        downloads[video_id]['view_count'] = yt.views
        
        print(f"[{video_id}] Title: {yt.title}")
        print(f"[{video_id}] Duration: {format_duration(yt.length)}")
        
        # Вибираємо найвищу якість (adaptive - окремо відео і аудіо)
        video_stream = yt.streams.filter(adaptive=True, file_extension='mp4', only_video=True).order_by('resolution').desc().first()
        audio_stream = yt.streams.filter(adaptive=True, file_extension='mp4', only_audio=True).order_by('abr').desc().first()
        
        if not video_stream or not audio_stream:
            # Fallback на progressive (нижча якість, але відео+аудіо разом)
            stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
            if not stream:
                raise Exception("Не знайдено доступних MP4 форматів")
            
            print(f"[{video_id}] Selected progressive stream: {stream.resolution} - {stream.mime_type}")
            
            downloads[video_id]['status'] = 'downloading'
            
            filename = f"{video_id}.mp4"
            output_path = stream.download(
                output_path=DOWNLOAD_FOLDER,
                filename=filename
            )
        else:
            print(f"[{video_id}] Selected video: {video_stream.resolution} - {video_stream.mime_type}")
            print(f"[{video_id}] Selected audio: {audio_stream.abr} - {audio_stream.mime_type}")
            
            downloads[video_id]['status'] = 'downloading'
            
            # Завантажуємо відео
            video_filename = f"{video_id}_video.mp4"
            video_path = video_stream.download(
                output_path=DOWNLOAD_FOLDER,
                filename=video_filename
            )
            
            print(f"[{video_id}] Video downloaded, downloading audio...")
            
            # Завантажуємо аудіо
            audio_filename = f"{video_id}_audio.mp4"
            audio_path = audio_stream.download(
                output_path=DOWNLOAD_FOLDER,
                filename=audio_filename
            )
            
            print(f"[{video_id}] Audio downloaded, merging...")
            downloads[video_id]['status'] = 'processing'
            
            # Об'єднуємо за допомогою ffmpeg-python
            import ffmpeg
            output_path = os.path.join(DOWNLOAD_FOLDER, f"{video_id}.mp4")
            
            try:
                # Об'єднуємо відео і аудіо
                video_input = ffmpeg.input(video_path)
                audio_input = ffmpeg.input(audio_path)
                
                ffmpeg.output(
                    video_input, audio_input, output_path,
                    vcodec='copy',  # Копіюємо відео без перекодування
                    acodec='aac',   # Кодуємо аудіо в AAC
                    strict='experimental'
                ).overwrite_output().run(capture_stdout=True, capture_stderr=True)
                
                # Видаляємо тимчасові файли
                os.remove(video_path)
                os.remove(audio_path)
                
                print(f"[{video_id}] Merge completed")
            except Exception as e:
                # Якщо щось пішло не так, використовуємо тільки відео
                print(f"[{video_id}] Merge failed, using video only: {e}")
                os.rename(video_path, output_path)
                if os.path.exists(audio_path):
                    os.remove(audio_path)
        
        print(f"[{video_id}] Download completed: {output_path}")
        
        if os.path.exists(output_path):
            downloads[video_id]['status'] = 'completed'
            downloads[video_id]['progress'] = 100
            downloads[video_id]['filename'] = output_path
            downloads[video_id]['filesize'] = os.path.getsize(output_path)
            
            print(f"[{video_id}] File size: {downloads[video_id]['filesize']} bytes")
            
            # Видалення через 1 годину
            threading.Timer(3600, lambda: cleanup_video(video_id)).start()
        else:
            raise Exception(f"File not found after download: {output_path}")
            
    except Exception as e:
        downloads[video_id]['status'] = 'error'
        downloads[video_id]['error'] = str(e)
        downloads[video_id]['progress'] = 0
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
            'status': 'fetching_info',
            'filename': None,
            'title': 'Fetching video info...',
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
            "success": True,
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
    
    if not filename or not os.path.exists(filename):
        print(f"[{video_id}] ERROR: File not found")
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    
    # Визначаємо ім'я файлу для завантаження
    title = download_info.get('title', 'video')
    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
    download_name = f"{safe_title}.mp4"
    
    print(f"[{video_id}] Sending file: {filename} as {download_name}")
    
    return FileResponse(
        path=filename,
        filename=download_name,
        media_type='application/octet-stream'
    )


@app.get("/")
async def root():
    active = len([d for d in downloads.values() if d['status'] in ['downloading', 'fetching_info', 'processing']])
    completed = len([d for d in downloads.values() if d['status'] == 'completed'])
    
    return {
        "message": "YouTube Video Downloader API",
        "status": "running",
        "active_downloads": active,
        "completed_downloads": completed,
        "total_downloads": len(downloads),
        "download_folder": DOWNLOAD_FOLDER
    }


if __name__ == "__main__":
    import uvicorn
    print(f"Download folder: {DOWNLOAD_FOLDER}")
    uvicorn.run(app, host="0.0.0.0", port=8000)