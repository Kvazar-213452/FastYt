"use client";

import { useState, useEffect } from 'react';
import { Download, Clock, Eye, User, Settings } from 'lucide-react';

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

interface DownloadSettings {
  format: 'mp4' | 'mp3' | 'webm';
  quality: 'highest' | 'high' | 'medium' | 'low' | 'audio_only';
  videoCodec: 'h264' | 'vp9' | 'av1';
  audioOnly: boolean;
}

export default function VideoDownloader() {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  const [settings, setSettings] = useState<DownloadSettings>({
    format: 'mp4',
    quality: 'highest',
    videoCodec: 'h264',
    audioOnly: false
  });

  useEffect(() => {
    const interval = setInterval(() => {
      videos.forEach(video => {
        if (video.status === 'downloading' || video.status === 'fetching_info' || video.status === 'processing') {
          checkProgress(video.id);
        }
      });
    }, 500);

    return () => clearInterval(interval);
  }, [videos]);

  const handleDownload = async (): Promise<void> => {
    if (!videoUrl.trim() || isDownloading) return;

    setIsDownloading(true);

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: videoUrl,
          settings: settings
        })
      });

      const data = await response.json();

      if (data.success && data.id) {
        const newVideo: Video = {
          id: data.id,
          url: videoUrl,
          timestamp: new Date().toLocaleString('en-US'),
          progress: 0,
          status: 'fetching_info',
          title: 'Fetching video information...'
        };
        setVideos([newVideo, ...videos]);
        setVideoUrl('');
      } else {
        alert('Error: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Server connection error');
    } finally {
      setIsDownloading(false);
    }
  };

  const checkProgress = async (id: string): Promise<void> => {
    if (!id || id === 'undefined') return;

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
      console.error('Progress check error:', error);
    }
  };

  const handleDownloadFile = async (videoId: string): Promise<void> => {
    if (!videoId) return;

    try {
      const response = await fetch(`/api/file/${videoId}`);
      
      if (!response.ok) {
        alert('File download error');
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `video_${videoId}.${settings.format}`;
      
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
      alert('File download error');
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

  const getQualityLabel = (quality: string): string => {
    const labels: Record<string, string> = {
      'highest': '4K/1080p (Highest)',
      'high': '1080p (High)',
      'medium': '720p (Medium)',
      'low': '480p (Low)',
      'audio_only': 'Audio Only'
    };
    return labels[quality] || quality;
  };

  return (
    <>
      {/* SEO Content Section */}
      <br /><br />
      <section className="seo-content" style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 24px 48px' }}>
        <article>
          <h1 style={{ fontSize: '48px', fontWeight: '800', marginBottom: '24px', color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: '1.1' }}>
            Free YouTube to MP3 & MP4 Converter
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '32px' }}>
            FastYt is the fastest and easiest way to download YouTube videos and convert them to MP3 or MP4 format. 
            No registration required, completely free, and unlimited downloads. Our advanced technology ensures 
            high-quality output and lightning-fast conversion speeds.
          </p>
        </article>
      </section>

      <main className="main">
        <div className="download-section">
          <h2 className="download-title">Download YouTube Videos</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>
            Paste any YouTube video URL below to download it as MP3 audio or MP4 video file
          </p>

          <div className="input-group">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleDownload()}
              placeholder="Paste YouTube video URL here..."
              className="url-input"
              disabled={isDownloading}
              aria-label="YouTube video URL input"
            />

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="settings-btn"
              title="Download settings"
              aria-label="Open download settings"
            >
              <Settings size={20} />
            </button>

            <button
              onClick={handleDownload}
              className="download-btn"
              disabled={isDownloading || !videoUrl.trim()}
              aria-label="Start download"
            >
              <Download size={22} />
              <span>{isDownloading ? 'Starting...' : 'Download'}</span>
            </button>
          </div>

          {showSettings && (
            <div className="settings-panel">
              <div className="settings-group">
                <label className="settings-label">
                  <span className="label-text">Format:</span>
                  <select
                    value={settings.format}
                    onChange={(e) => setSettings({...settings, format: e.target.value as any})}
                    className="settings-select"
                    aria-label="Select output format"
                  >
                    <option value="mp4">MP4 (Video)</option>
                    <option value="mp3">MP3 (Audio Only)</option>
                    <option value="webm">WebM (Video)</option>
                  </select>
                </label>
              </div>

              {settings.format !== 'mp3' && (
                <>
                  <div className="settings-group">
                    <label className="settings-label">
                      <span className="label-text">Video Quality:</span>
                      <select
                        value={settings.quality}
                        onChange={(e) => setSettings({...settings, quality: e.target.value as any})}
                        className="settings-select"
                        aria-label="Select video quality"
                      >
                        <option value="highest">4K/1080p (Highest)</option>
                        <option value="high">1080p (High)</option>
                        <option value="medium">720p (Medium)</option>
                        <option value="low">480p (Low)</option>
                        <option value="audio_only">Audio Only</option>
                      </select>
                    </label>
                  </div>

                  <div className="settings-group">
                    <label className="settings-label">
                      <span className="label-text">Video Codec:</span>
                      <select
                        value={settings.videoCodec}
                        onChange={(e) => setSettings({...settings, videoCodec: e.target.value as any})}
                        className="settings-select"
                        aria-label="Select video codec"
                      >
                        <option value="h264">H.264 (Compatible)</option>
                        <option value="vp9">VP9 (Quality)</option>
                        <option value="av1">AV1 (Modern)</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

              <div className="settings-group">
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.audioOnly || settings.format === 'mp3'}
                    onChange={(e) => setSettings({...settings, audioOnly: e.target.checked})}
                    disabled={settings.format === 'mp3'}
                    aria-label="Download audio only"
                  />
                  <span className="checkbox-text">Download audio only</span>
                </label>
              </div>

              <div className="settings-info">
                <p className="info-text">
                  <strong>Current settings:</strong> {settings.format.toUpperCase()} 
                  {settings.format !== 'mp3' && ` • ${getQualityLabel(settings.quality)}`}
                  {settings.audioOnly && ' • Audio Only'}
                </p>
              </div>
            </div>
          )}
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
                        alt={video.title || 'Video thumbnail'} 
                        className="thumbnail"
                        loading="lazy"
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
                        <div className="progress-bar" role="progressbar" aria-valuenow={video.progress} aria-valuemin={0} aria-valuemax={100}>
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
                      <p className="error-text">{video.error || 'Download error'}</p>
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
                        aria-label="Download completed file"
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
            <p className="empty-title">No videos yet</p>
            <p className="empty-subtitle">Paste a YouTube URL above and click Download to get started</p>
          </div>
        )}

        {/* Additional SEO Content */}
        <section style={{ marginTop: '64px', padding: '48px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>
            Why Choose FastYt?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '24px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                ⚡ Lightning Fast
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Our optimized servers ensure the fastest download and conversion speeds possible
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                🎵 High Quality
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Download videos in up to 4K resolution and audio in 320kbps MP3 quality
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                🔒 Safe & Secure
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                No malware, no ads, no tracking. Your privacy is our priority
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                💯 100% Free
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Unlimited downloads with no registration or payment required
              </p>
            </div>
          </div>
        </section>

        <section style={{ marginTop: '32px', padding: '48px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>
            How to Download YouTube Videos
          </h2>
          <ol style={{ listStyle: 'decimal', paddingLeft: '24px', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            <li style={{ marginBottom: '12px' }}>Copy the YouTube video URL from your browser's address bar</li>
            <li style={{ marginBottom: '12px' }}>Paste the URL into the input field above</li>
            <li style={{ marginBottom: '12px' }}>Select your preferred format (MP3 or MP4) and quality settings</li>
            <li style={{ marginBottom: '12px' }}>Click the "Download" button and wait for processing to complete</li>
            <li>Click the download button to save the file to your device</li>
          </ol>
        </section>

        <section style={{ marginTop: '32px', padding: '48px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                Is FastYt free to use?
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Yes! FastYt is completely free with unlimited downloads. No registration or payment is ever required.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                What formats are supported?
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                We support MP4 (video), MP3 (audio), and WebM formats. You can choose from various quality options including 4K, 1080p, 720p, and 480p.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                Is it legal to download YouTube videos?
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Downloading videos for personal use may be allowed, but redistributing copyrighted content is illegal. Always respect copyright laws and YouTube's terms of service.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                Do I need to install any software?
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                No installation needed! FastYt works directly in your browser on any device - desktop, mobile, or tablet.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}