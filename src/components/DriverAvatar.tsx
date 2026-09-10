import React, { useState } from 'react';
import { User, Car } from 'lucide-react';

interface DriverAvatarProps {
  photoUrl?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isOnline?: boolean;
  showStatusBadge?: boolean;
}

export const PRESET_DRIVER_AVATARS = [
  {
    id: 'avatar-1',
    name: 'Driver 1',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-2',
    name: 'Driver 2',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-3',
    name: 'Driver 3',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-4',
    name: 'Driver 4',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-5',
    name: 'Driver 5',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-6',
    name: 'Driver 6',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-7',
    name: 'Driver 7',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-8',
    name: 'Driver 8',
    url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
  },
];

export const getInitials = (name: string): string => {
  if (!name) return 'DR';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const DriverAvatar: React.FC<DriverAvatarProps> = ({
  photoUrl,
  name,
  size = 'md',
  className = '',
  isOnline,
  showStatusBadge = false,
}) => {
  const [hasError, setHasError] = useState(false);

  // Derive size classes
  const sizeClasses = {
    xs: 'w-6 h-6 text-[9px]',
    sm: 'w-8 h-8 text-[11px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-13 h-13 text-sm',
    xl: 'w-20 h-20 text-lg',
  }[size];

  const badgeSize = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
    xl: 'w-4 h-4',
  }[size];

  const initials = getInitials(name);
  const isValidPhoto = Boolean(photoUrl && photoUrl.trim().length > 0 && !hasError);

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      {isValidPhoto ? (
        <img
          src={photoUrl!}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className={`${sizeClasses} rounded-2xl object-cover border border-slate-200 shadow-xs`}
        />
      ) : (
        <div
          className={`${sizeClasses} rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-extrabold flex items-center justify-center border border-amber-300/60 shadow-xs tracking-wider select-none`}
          title={name}
        >
          {initials}
        </div>
      )}

      {showStatusBadge && typeof isOnline === 'boolean' && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${badgeSize} rounded-full border-2 border-white ${
            isOnline ? 'bg-emerald-500 ring-1 ring-emerald-300' : 'bg-slate-400'
          }`}
          title={isOnline ? 'Driver Online' : 'Driver Offline'}
        />
      )}
    </div>
  );
};
