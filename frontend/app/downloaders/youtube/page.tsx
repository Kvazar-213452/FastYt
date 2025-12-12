"use client";

import { useState, useEffect } from 'react';
import { Download, Clock, Eye, User } from 'lucide-react';

interface Video {
  id: string;
  url: string;
  timestamp: string;
  progress: number;
  status: 'fetching_info' | 'downloading' | 'processing' | 'completed' | 'error';
  downloadUrl?: string;
  error?: string;
  title?: string;
  duration?: number;
  duration_string?: string;
  thumbnail?: string;
  uploader?: string;
  view_count?: number;
  filesize?: number;
  speed?: number;
  eta?: number;
}

export default function VideoDownloader() {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  useEffect(() => {
    const interval = setInterval(() => {
      videos.forEach(video => {
        if (video.status === 'downloading' || video.status === 'fetching_info' || video.status === 'processing') {
          checkProgress(video.id);
        }
      });
    }, 500); // Перевіряємо частіше для швидшого оновлення

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
          status: 'fetching_info',
          title: 'Завантаження інформації...'
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
    if (!id || id === 'undefined') return;

    try {
      const response = await fetch(`/api/progress/${id}`);
      const data = await response.json();

      // Логуємо дані для дебагу
      console.log(`Progress data for ${id}:`, data);

      setVideos(prevVideos =>
        prevVideos.map(video =>
          video.id === id
            ? {
                ...video,
                progress: data.progress || video.progress,
                status: data.status || video.status,
                title: data.title || video.title,
                duration: data.duration,
                duration_string: data.duration_string,
                thumbnail: data.thumbnail,
                uploader: data.uploader,
                view_count: data.view_count,
                filesize: data.filesize,
                speed: data.speed,
                eta: data.eta,
                downloadUrl: data.downloadUrl,
                error: data.error
              }
            : video
        ).filter(video => video.status !== 'completed' || !data.removed)
      );
    } catch (error) {
      console.error('Помилка перевірки прогресу:', error);
    }
  };

  const handleDownloadFile = async (videoId: string): Promise<void> => {
    if (!videoId) return;

    try {
      const response = await fetch(`/api/file/${videoId}`);
      
      if (!response.ok) {
        alert('Помилка завантаження файлу');
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `video_${videoId}.mp4`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Помилка завантаження файлу');
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
      return `${mb.toFixed(1)} MB`;
    }
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatSpeed = (bytesPerSec?: number): string => {
    if (!bytesPerSec) return '';
    const mbps = bytesPerSec / (1024 * 1024);
    return `${mbps.toFixed(1)} MB/s`;
  };

  const formatETA = (seconds?: number): string => {
    if (!seconds) return '';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViewCount = (count?: number): string => {
    if (!count) return '0';
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <main className="main">
      <div className="download-section">
        <h2 className="download-title">Download Video</h2>

        <div className="input-group">
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleDownload()}
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
          {videos.map((video) => (
            <div key={video.id} className="video-card">
              <div className="video-content">
                {video.thumbnail && (
                  <div className="thumbnail-wrapper">
                    <img 
                      src={video.thumbnail} 
                      alt={video.title} 
                      className="thumbnail"
                    />
                    {video.duration_string && (
                      <div className="duration-badge">{video.duration_string}</div>
                    )}
                  </div>
                )}

                <div className="video-info">
                  <h3 className="video-title">{video.title || 'Loading...'}</h3>
                  
                  {video.uploader && (
                    <div className="video-meta">
                      <span className="meta-item">
                        <User size={14} />
                        {video.uploader}
                      </span>
                      {video.view_count !== undefined && (
                        <span className="meta-item">
                          <Eye size={14} />
                          {formatViewCount(video.view_count)} views
                        </span>
                      )}
                    </div>
                  )}

                  {(video.status === 'downloading' || video.status === 'fetching_info') && (
                    <div className="progress-section">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${video.progress}%` }}
                        />
                        <span className="progress-text">{video.progress}%</span>
                      </div>
                      
                      {video.status === 'downloading' && (
                        <div className="download-stats">
                          {video.speed && <span>{formatSpeed(video.speed)}</span>}
                          {video.eta && <span>ETA: {formatETA(video.eta)}</span>}
                          {video.filesize && <span>{formatFileSize(video.filesize)}</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {video.status === 'processing' && (
                    <div className="processing-message">
                      Processing video... Almost done!
                    </div>
                  )}

                  {video.status === 'error' && (
                    <p className="error-text">{video.error || 'Помилка завантаження'}</p>
                  )}
                </div>

                <div className="video-actions">
                  {video.status === 'fetching_info' && (
                    <span className="status-badge status-fetching">
                      Getting info...
                    </span>
                  )}
                  
                  {video.status === 'downloading' && (
                    <span className="status-badge status-downloading">
                      Downloading...
                    </span>
                  )}

                  {video.status === 'processing' && (
                    <span className="status-badge status-processing">
                      Processing...
                    </span>
                  )}
                  
                  {video.status === 'completed' && (
                    <button
                      onClick={() => handleDownloadFile(video.id)}
                      className="download-file-btn"
                    >
                      <Download size={18} />
                      Download
                    </button>
                  )}

                  {video.status === 'error' && (
                    <span className="status-badge status-error">
                      Error
                    </span>
                  )}
                </div>
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


    </main>
  );
}