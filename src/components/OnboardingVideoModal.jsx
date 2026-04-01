import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { getVideoBlob } from '../utils/videoDB';

export default function OnboardingVideoModal({ activeVideoId, onClose }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (activeVideoId) {
      loadVideo();
    }
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [activeVideoId]);

  const loadVideo = async () => {
    try {
      setIsLoading(true);
      const blob = await getVideoBlob(activeVideoId);
      if (!blob) throw new Error('Vídeo não encontrado no banco local.');
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeVideoId) return null;

  return (
    <div className="overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content" style={{ maxWidth: '600px', padding: 0, overflow: 'hidden', background: '#000' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', color: '#fff', zIndex: 10, borderRadius: '50%', padding: '5px' }}>
          <X size={24} />
        </button>

        <div style={{ position: 'relative', paddingTop: '177.77%' /* 9:16 aspect ratio or 16:9? Common mobile is 9:16 */ }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isLoading ? (
              <div style={{ color: '#fff', textAlign: 'center' }}>
                <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #fff', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }}></div>
                <p>Carregando tutorial...</p>
              </div>
            ) : error ? (
              <div style={{ color: '#ff3b30', textAlign: 'center', padding: '2rem' }}>
                <p>{error}</p>
                <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={onClose}>Fechar</button>
              </div>
            ) : (
              <video 
                ref={videoRef}
                src={videoUrl} 
                controls 
                autoPlay 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}
          </div>
        </div>

        <div style={{ padding: '1rem', background: '#fff', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Assista ao tutorial para salvar o app no seu celular</p>
          <button className="btn" style={{ width: '100%', marginTop: '1rem', background: '#1d1d1f' }} onClick={onClose}>Já entendi, vamos começar!</button>
        </div>
      </div>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
