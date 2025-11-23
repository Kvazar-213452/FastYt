"use client";

import { useState } from 'react';
import { Download } from 'lucide-react';

interface Video {
  id: number;
  url: string;
  timestamp: string;
}

export default function VideoDownloader() {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videos, setVideos] = useState<Video[]>([]);

  const handleDownload = (): void => {
    if (videoUrl.trim()) {
      const newVideo: Video = {
        id: Date.now(),
        url: videoUrl,
        timestamp: new Date().toLocaleString()
      };
      setVideos([newVideo, ...videos]);
      setVideoUrl('');
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
          />

          <button
            onClick={handleDownload}
            className="download-btn"
          >
            <Download size={22} />
            <span>Download</span>
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
                </div>

                <span className="status-badge">
                  Ready
                </span>
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
