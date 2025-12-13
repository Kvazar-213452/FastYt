from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pytubefix import YouTube
from pytubefix.cli import on_progress
import os
import uuid
import threading
from typing import Dict, Optional
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


class DownloadSettings(BaseModel):
    format: str = "mp4"
    quality: str = "highest"
    videoCodec: str = "h264"
    audioOnly: bool = False


class DownloadRequest(BaseModel):
    url: str
    settings: Optional[DownloadSettings] = None


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
        
        # Розрахунок швидкості та ETA
        elapsed = time.time() - downloads[video_id]['start_time']
        if elapsed > 0:
            speed = bytes_downloaded / elapsed
            eta = bytes_remaining / speed if speed > 0 else 0
            downloads[video_id]['speed'] = speed
            downloads[video_id]['eta'] = eta
        
        print(f"[{video_id}] Progress: {progress}%")
    except Exception as e:
        print(f"Помилка оновлення прогресу: {e}")


def select_stream_by_quality(yt: YouTube, settings: DownloadSettings):
    """Вибирає потік відповідно до налаштувань якості"""
    quality_map = {
        'highest': None,  # Найвища доступна
        'high': '1080',
        'medium': '720',
        'low': '480'
    }
    
    if settings.audioOnly or settings.format == 'mp3':
        # Тільки аудіо
        audio_stream = yt.streams.filter(
            only_audio=True,
            file_extension='mp4'
        ).order_by('abr').desc().first()
        return None, audio_stream
    
    # Вибираем формат файлу
    file_ext = 'mp4' if settings.format in ['mp4', 'mp3'] else settings.format
    
    # Фільтруємо відео потоки
    video_streams = yt.streams.filter(
        adaptive=True,
        file_extension=file_ext,
        only_video=True
    )
    
    # Вибираємо якість
    if settings.quality == 'highest':
        video_stream = video_streams.order_by('resolution').desc().first()
    elif settings.quality == 'audio_only':
        video_stream = None
    else:
        target_res = quality_map.get(settings.quality, '720')
        video_stream = video_streams.filter(
            resolution=f"{target_res}p"
        ).first()
        
        # Якщо не знайдено потрібну якість, беремо найближчу нижчу
        if not video_stream:
            video_stream = video_streams.order_by('resolution').desc().first()
    
    # Вибираємо аудіо потік
    audio_stream = yt.streams.filter(
        adaptive=True,
        only_audio=True,
        file_extension=file_ext
    ).order_by('abr').desc().first()
    
    return video_stream, audio_stream


def download_video(video_id: str, url: str, settings: Optional[DownloadSettings] = None):
    try:
        if settings is None:
            settings = DownloadSettings()
        
        print(f"[{video_id}] Starting download from: {url}")
        print(f"[{video_id}] Settings: format={settings.format}, quality={settings.quality}, audioOnly={settings.audioOnly}")
        
        downloads[video_id]['start_time'] = time.time()
        
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
        
        # Вибираємо потоки згідно налаштувань
        video_stream, audio_stream = select_stream_by_quality(yt, settings)
        
        downloads[video_id]['status'] = 'downloading'
        
        # Визначаємо розширення файлу
        file_extension = 'mp3' if settings.format == 'mp3' or settings.audioOnly else settings.format
        
        if settings.audioOnly or settings.format == 'mp3':
            # Завантажуємо тільки аудіо
            if not audio_stream:
                raise Exception("Не знайдено аудіо потік")
            
            print(f"[{video_id}] Downloading audio only: {audio_stream.abr}")
            
            audio_filename = f"{video_id}_audio.mp4"
            audio_path = audio_stream.download(
                output_path=DOWNLOAD_FOLDER,
                filename=audio_filename
            )
            
            downloads[video_id]['status'] = 'processing'
            
            # Конвертуємо в MP3 якщо потрібно
            if settings.format == 'mp3':
                import ffmpeg
                output_path = os.path.join(DOWNLOAD_FOLDER, f"{video_id}.mp3")
                
                try:
                    ffmpeg.input(audio_path).output(
                        output_path,
                        acodec='libmp3lame',
                        audio_bitrate='192k'
                    ).overwrite_output().run(capture_stdout=True, capture_stderr=True)
                    
                    os.remove(audio_path)
                    print(f"[{video_id}] Converted to MP3")
                except Exception as e:
                    print(f"[{video_id}] MP3 conversion failed: {e}")
                    output_path = audio_path
            else:
                output_path = audio_path
        
        elif not video_stream or not audio_stream:
            # Fallback на progressive (нижча якість, але відео+аудіо разом)
            stream = yt.streams.filter(
                progressive=True,
                file_extension=settings.format
            ).order_by('resolution').desc().first()
            
            if not stream:
                raise Exception(f"Не знайдено доступних {settings.format.upper()} форматів")
            
            print(f"[{video_id}] Selected progressive stream: {stream.resolution} - {stream.mime_type}")
            
            filename = f"{video_id}.{settings.format}"
            output_path = stream.download(
                output_path=DOWNLOAD_FOLDER,
                filename=filename
            )
        else:
            # Завантажуємо відео та аудіо окремо
            print(f"[{video_id}] Selected video: {video_stream.resolution} - {video_stream.mime_type}")
            print(f"[{video_id}] Selected audio: {audio_stream.abr} - {audio_stream.mime_type}")
            
            # Завантажуємо відео
            video_filename = f"{video_id}_video.{settings.format}"
            video_path = video_stream.download(
                output_path=DOWNLOAD_FOLDER,
                filename=video_filename
            )
            
            print(f"[{video_id}] Video downloaded, downloading audio...")
            
            # Завантажуємо аудіо
            audio_filename = f"{video_id}_audio.{settings.format}"
            audio_path = audio_stream.download(
                output_path=DOWNLOAD_FOLDER,
                filename=audio_filename
            )
            
            print(f"[{video_id}] Audio downloaded, merging...")
            downloads[video_id]['status'] = 'processing'
            
            # Об'єднуємо за допомогою ffmpeg
            import ffmpeg
            output_path = os.path.join(DOWNLOAD_FOLDER, f"{video_id}.{settings.format}")
            
            try:
                video_input = ffmpeg.input(video_path)
                audio_input = ffmpeg.input(audio_path)
                
                # Вибираємо кодеки згідно налаштувань
                if settings.format == 'webm':
                    vcodec = 'libvpx-vp9' if settings.videoCodec == 'vp9' else 'copy'
                    acodec = 'libopus'
                else:
                    vcodec = 'copy'
                    acodec = 'aac'
                
                ffmpeg.output(
                    video_input, audio_input, output_path,
                    vcodec=vcodec,
                    acodec=acodec,
                    strict='experimental'
                ).overwrite_output().run(capture_stdout=True, capture_stderr=True)
                
                # Видаляємо тимчасові файли
                os.remove(video_path)
                os.remove(audio_path)
                
                print(f"[{video_id}] Merge completed")
            except Exception as e:
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
            downloads[video_id]['format'] = file_extension
            
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
        if request.settings:
            print(f"[{video_id}] Settings: {request.settings}")
        
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
            'created_at': time.time(),
            'start_time': time.time(),
            'format': request.settings.format if request.settings else 'mp4'
        }
        
        # Запуск завантаження в окремому потоці
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
        "removed": download_info.get('removed', False),
        "format": download_info.get('format', 'mp4')
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
    file_format = download_info.get('format', 'mp4')
    download_name = f"{safe_title}.{file_format}"
    
    print(f"[{video_id}] Sending file: {filename} as {download_name}")
    
    # Визначаємо MIME тип
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