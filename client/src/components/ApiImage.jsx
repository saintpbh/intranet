import { useState, useEffect } from 'react';
import API_BASE from '../api';

const ApiImage = ({ src, alt, className, fallback, style, ...rest }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl = null;

    const fetchImage = async () => {
      if (!src) {
        setError(true);
        return;
      }

      // If it's a data URI or blob URI, just use it directly
      if (src.startsWith('data:') || src.startsWith('blob:')) {
        setImageSrc(src);
        return;
      }

      // Determine the URL to fetch
      if (!src.startsWith('/api/') && !src.startsWith('http')) {
        // It's a local static asset (like /assets/...)
        setImageSrc(src);
        return;
      }

      let fullUrl = src;
      if (src.startsWith('/api/') && API_BASE) {
        fullUrl = `${API_BASE}${src}`;
      }


      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          // The global interceptor will automatically add ngrok-skip-browser-warning,
          // but we can explicitly add it here just in case.
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        });

        if (!response.ok) {
          throw new Error('Image fetch failed');
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
        setError(false);
      } catch (err) {
        console.error('Failed to load ApiImage:', err);
        setError(true);
      }
    };

    fetchImage();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (error || !imageSrc) {
    // If a fallback is provided as a React element, render it (like an initial 'A')
    if (fallback) return fallback;
    return <div className={`bg-surface-variant flex items-center justify-center text-on-surface-variant ${className}`} style={style} {...rest}>{alt || '?'}</div>;
  }

  return <img src={imageSrc} alt={alt} className={className} style={style} {...rest} />;
};

export default ApiImage;
