import React, { useState, useEffect, useMemo } from 'react';

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
  userId?: string;
  onClick?: () => void;
}

// Deterministic color palette based on name/id hash
const COLOR_PALETTES = [
  { bg: 'bg-indigo-600', text: 'text-white' },
  { bg: 'bg-emerald-600', text: 'text-white' },
  { bg: 'bg-blue-600', text: 'text-white' },
  { bg: 'bg-violet-600', text: 'text-white' },
  { bg: 'bg-rose-600', text: 'text-white' },
  { bg: 'bg-amber-600', text: 'text-white' },
  { bg: 'bg-teal-600', text: 'text-white' },
  { bg: 'bg-cyan-600', text: 'text-white' },
  { bg: 'bg-purple-600', text: 'text-white' },
];

const SIZE_MAP = {
  xs: { box: 'w-6 h-6', text: 'text-[10px]', iconSize: 'text-[12px]' },
  sm: { box: 'w-8 h-8', text: 'text-xs', iconSize: 'text-[16px]' },
  md: { box: 'w-9 h-9', text: 'text-xs font-semibold', iconSize: 'text-[18px]' },
  lg: { box: 'w-12 h-12', text: 'text-base font-bold', iconSize: 'text-[22px]' },
  xl: { box: 'w-24 h-24', text: 'text-2xl font-bold', iconSize: 'text-[40px]' },
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = '',
  size = 'md',
  className = '',
  alt,
  userId,
  onClick
}) => {
  const [imageError, setImageError] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Compute initials deterministically
  const initials = useMemo(() => {
    if (!name || !name.trim()) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  // Select deterministic color palette
  const palette = useMemo(() => {
    const key = (userId || name || 'default').toLowerCase();
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % COLOR_PALETTES.length;
    return COLOR_PALETTES[index];
  }, [userId, name]);

  // Securely load avatar if it points to an authenticated backend route
  useEffect(() => {
    setImageError(false);
    let isCancelled = false;
    let createdUrl: string | null = null;

    if (!src) {
      setBlobUrl(null);
      return;
    }

    // If src is already a data URL or blob URL, use directly
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setBlobUrl(src);
      return;
    }

    // If src is a local API endpoint (e.g. /api/users/avatar/...), fetch with Auth token
    if (src.startsWith('/api/')) {
      const token = localStorage.getItem('sfp_auth_token');
      const fetchHeaders: Record<string, string> = {};
      if (token) {
        fetchHeaders['Authorization'] = `Bearer ${token}`;
      }

      fetch(src, { headers: fetchHeaders })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          if (!isCancelled) {
            createdUrl = URL.createObjectURL(blob);
            setBlobUrl(createdUrl);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setImageError(true);
            setBlobUrl(null);
          }
        });
    } else {
      // Standard URL
      setBlobUrl(src);
    }

    return () => {
      isCancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [src]);

  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  if (blobUrl && !imageError) {
    return (
      <img
        src={blobUrl}
        alt={alt || name || 'Avatar'}
        onError={() => setImageError(true)}
        onClick={onClick}
        className={`${sizeConfig.box} rounded-full object-cover shrink-0 border border-slate-200 select-none ${className}`}
      />
    );
  }

  // Fallback: high-contrast initials badge
  return (
    <div
      onClick={onClick}
      title={name || undefined}
      className={`${sizeConfig.box} ${palette.bg} ${palette.text} ${sizeConfig.text} rounded-full flex items-center justify-center shrink-0 border border-black/5 font-['Inter',sans-serif] tracking-wider select-none shadow-sm ${className}`}
    >
      {initials}
    </div>
  );
};
