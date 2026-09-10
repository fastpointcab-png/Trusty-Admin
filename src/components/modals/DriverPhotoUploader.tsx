import React, { useState, useEffect } from 'react';
import { Link2, X } from 'lucide-react';

interface DriverPhotoUploaderProps {
  photoUrl: string;
  onChange: (url: string) => void;
  driverName?: string;
}

export const DriverPhotoUploader: React.FC<DriverPhotoUploaderProps> = ({
  photoUrl,
  onChange,
}) => {
  const [customUrl, setCustomUrl] = useState(photoUrl || '');

  useEffect(() => {
    setCustomUrl(photoUrl || '');
  }, [photoUrl]);

  const handleUrlChange = (val: string) => {
    setCustomUrl(val);
    onChange(val);
  };

  const handleClear = () => {
    setCustomUrl('');
    onChange('');
  };

  return (
    <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between">
        <label className="block text-slate-700 font-bold text-xs">
          Driver Profile Photo (Web URL)
        </label>
        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
          <Link2 className="w-3 h-3 text-slate-400" /> Direct Image Link
        </span>
      </div>

      {/* Web URL Input */}
      <div className="space-y-1">
        <div className="relative flex items-center">
          <input
            type="url"
            placeholder="Enter image URL or leave blank"
            value={customUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-8 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400 font-mono"
          />
          {customUrl && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear photo URL"
              className="absolute right-2 text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-400">
          Paste any direct image URL (HTTPS / PNG / JPG / WEBP) or leave blank.
        </p>
      </div>
    </div>
  );
};
