"use client";

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

interface Video {
  id: string;
  url: string;
  timestamp: string;
  progress: number;
  status: 'downloading' | 'completed' | 'error';
  downloadUrl?: string;
  error?: string;
}

export default function VideoDownloader() {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Перевірка прогресу кожні 2 секунди
  useEffect(() => {
    const interval = setInterval(() => {
      videos.forEach(video => {
        if (video.status === 'downloading') {
          checkProgress(video.id);
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [videos]);

  const handleDownload = async (): Promise<void> => {
    if (!videoUrl.trim() || isDownloading) return;

    setIsDownloading(true);

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl })
      });

      const data = await response.json();

      if (data.success && data.id) {
        const newVideo: Video = {
          id: data.id,
          url: videoUrl,
          timestamp: new Date().toLocaleString('uk-UA'),
          progress: 0,
          status: 'downloading'
        };
        setVideos([newVideo, ...videos]);
        setVideoUrl('');
      } else {
        alert('Помилка: ' + (data.error || 'Невідома помилка'));
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Помилка з\'єднання з сервером');
    } finally {
      setIsDownloading(false);
    }
  };

  const checkProgress = async (id: string): Promise<void> => {
    if (!id || id === 'undefined') {
      console.error('Invalid video ID:', id);
      return;
    }

    try {
      const response = await fetch(`/api/progress/${id}`);
      const data = await response.json();

      setVideos(prevVideos =>
        prevVideos.map(video =>
          video.id === id
            ? {
                ...video,
                progress: data.progress || video.progress,
                status: data.status || video.status,
                downloadUrl: data.downloadUrl,
                error: data.error
              }
            : video
        ).filter(video => video.status !== 'completed' || !data.removed)
      );
    } catch (error) {
      console.error('Помилка перевірки прогресу для ID:', id, error);
    }
  };

  const handleDownloadFile = async (videoId: string): Promise<void> => {
    if (!videoId) {
      console.error('Invalid video ID');
      return;
    }

    try {
      console.log('Downloading file for ID:', videoId);
      
      const response = await fetch(`/api/file/${videoId}`);
      
      if (!response.ok) {
        alert('Помилка завантаження файлу');
        return;
      }

      // Отримуємо blob
      const blob = await response.blob();
      
      // Отримуємо ім'я файлу з headers
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `video_${videoId}.mp4`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Створюємо URL для blob
      const url = window.URL.createObjectURL(blob);
      
      // Створюємо тимчасове посилання та клікаємо по ньому
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Очищення
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('File downloaded successfully:', filename);
    } catch (error) {
      console.error('Download error:', error);
      alert('Помилка завантаження файлу');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleDownload();
    }
  };

  return (
    <main className="main">
      <div className="download-section">
        <h2 className="download-title">
          Download Video
        </h2>

        <div className="input-group">
          <input
            type="text"
            value={videoUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVideoUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Paste video URL here..."
            className="url-input"
            disabled={isDownloading}
          />

          <button
            onClick={handleDownload}
            className="download-btn"
            disabled={isDownloading || !videoUrl.trim()}
          >
            <Download size={22} />
            <span>{isDownloading ? 'Starting...' : 'Download'}</span>
          </button>
        </div>
      </div>

      {videos.length > 0 && (
        <div className="videos-list">
          {videos.map((video: Video) => (
            <div
              key={video.id}
              className="video-card"
            >
              <div className="video-content">
                <div className="video-info">
                  <p className="video-label">
                    Video URL:
                  </p>
                  <p className="video-url">
                    {video.url}
                  </p>
                  <p className="video-time">
                    Added: {video.timestamp}
                  </p>
                  
                  {video.status === 'downloading' && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${video.progress}%` }}
                      />
                      <span className="progress-text">{video.progress}%</span>
                    </div>
                  )}

                  {video.status === 'error' && (
                    <p className="error-text">{video.error || 'Помилка завантаження'}</p>
                  )}
                </div>

                {video.status === 'downloading' && (
                  <span className="status-badge status-downloading">
                    Завантаження...
                  </span>
                )}
                
                {video.status === 'completed' && (
                  <button
                    onClick={() => handleDownloadFile(video.id)}
                    className="download-file-btn"
                  >
                    <Download size={18} />
                    Скачати
                  </button>
                )}

                {video.status === 'error' && (
                  <span className="status-badge status-error">
                    Помилка
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {videos.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <Download size={40} style={{ opacity: 0.5 }} />
          </div>
          <p className="empty-title">No videos added yet</p>
          <p className="empty-subtitle">Paste a URL and click Download to get started</p>
        </div>
      )}

      <style jsx>{`
        :root {
          --surface: rgba(255, 255, 255, 0.9);
          --surface-elevated: rgba(255, 255, 255, 0.95);
          --border: rgba(203, 213, 225, 0.6);
          --border-secondary: rgba(203, 213, 225, 0.4);
          --text-primary: #0f172a;
          --text-secondary: #475569;
          --text-tertiary: #64748b;
          --text-muted: #94a3b8;
          --accent-primary: #2563eb;
          --accent-gradient-start: #2563eb;
          --accent-gradient-end: #9333ea;
          --focus-ring: rgba(37, 99, 235, 0.1);
          --success-start: #10b981;
          --success-end: #059669;
          --empty-bg: rgba(241, 245, 249, 0.5);
        }

        .main {
          flex: 1;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          padding: 48px 24px;
          min-height: 100vh;
        }

        .download-section {
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 32px;
          backdrop-filter: blur(16px);
          border: 1px solid var(--border-secondary);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          transition: all 0.3s ease;
          background-color: var(--surface);
        }

        .download-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 24px;
          transition: color 0.3s ease;
          color: var(--text-primary);
        }

        .input-group {
          display: flex;
          gap: 12px;
        }

        .url-input {
          flex: 1;
          padding: 16px 20px;
          border-radius: 12px;
          border: 2px solid var(--border);
          font-size: 16px;
          transition: all 0.3s ease;
          background-color: var(--surface-elevated);
          color: var(--text-primary);
        }

        .url-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .url-input::placeholder {
          color: var(--text-muted);
        }

        .url-input:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 4px var(--focus-ring);
        }

        .download-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 32px;
          background: linear-gradient(135deg, var(--accent-gradient-start) 0%, var(--accent-gradient-end) 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.3);
        }

        .download-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .download-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #1D4ED8 0%, #7E22CE 100%);
          box-shadow: 0 20px 40px -10px rgba(37, 99, 235, 0.4);
          transform: scale(1.05);
        }

        .videos-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .video-card {
          border-radius: 16px;
          padding: 24px;
          backdrop-filter: blur(16px);
          border: 1px solid var(--border-secondary);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
          background-color: var(--surface);
        }

        .video-card:hover {
          transform: scale(1.02);
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.15);
        }

        .video-content {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 16px;
        }

        .video-info {
          flex: 1;
          min-width: 0;
        }

        .video-label {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
          transition: color 0.3s ease;
          color: var(--text-secondary);
        }

        .video-url {
          font-size: 14px;
          word-break: break-all;
          margin-bottom: 12px;
          font-family: monospace;
          transition: color 0.3s ease;
          color: var(--text-tertiary);
        }

        .video-time {
          font-size: 12px;
          transition: color 0.3s ease;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .progress-bar {
          width: 100%;
          height: 28px;
          background: var(--surface-elevated);
          border-radius: 14px;
          margin-top: 12px;
          position: relative;
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%);
          transition: width 0.3s ease;
          box-shadow: 0 0 20px rgba(37, 99, 235, 0.3);
        }

        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
          text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          background: linear-gradient(135deg, var(--success-start) 0%, var(--success-end) 100%);
          color: white;
          box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.3);
          white-space: nowrap;
        }

        .status-downloading {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          box-shadow: 0 10px 25px -5px rgba(251, 191, 36, 0.3);
        }

        .status-error {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.3);
        }

        .download-file-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: linear-gradient(135deg, var(--success-start) 0%, var(--success-end) 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.3);
          white-space: nowrap;
        }

        .download-file-btn:hover {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          box-shadow: 0 20px 40px -10px rgba(16, 185, 129, 0.4);
          transform: scale(1.05);
        }

        .error-text {
          color: #ef4444;
          font-size: 13px;
          margin-top: 8px;
          font-weight: 500;
        }

        .empty-state {
          text-align: center;
          padding: 64px 0;
          transition: color 0.3s ease;
          color: var(--text-muted);
        }

        .empty-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 24px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.3s ease;
          background-color: var(--empty-bg);
        }

        .empty-title {
          font-size: 18px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .empty-subtitle {
          font-size: 14px;
          margin-top: 8px;
          color: var(--text-muted);
        }

        @media (max-width: 768px) {
          .main {
            padding: 24px 16px;
          }

          .download-section {
            padding: 24px;
          }

          .input-group {
            flex-direction: column;
          }

          .download-btn {
            width: 100%;
            justify-content: center;
          }

          .video-content {
            flex-direction: column;
          }

          .download-file-btn,
          .status-badge {
            align-self: flex-start;
          }
        }
      `}</style>
    </main>
  );
}