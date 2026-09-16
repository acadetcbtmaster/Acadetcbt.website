import React, { useState } from 'react';
import mencoreAiAvatarImg from '../assets/mencore-ai-avatar.jpg';
import mencoreLogoImg from '../assets/mencore-logo.jpg';
import { Bot } from 'lucide-react';

interface MenCoreAvatarProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  src?: string;
}

export const MenCoreAvatar: React.FC<MenCoreAvatarProps> = ({
  className = '',
  size = 'md',
  src,
}) => {
  const validInitialSrc =
    src && src !== '/mencore-logo.svg' && !src.endsWith('.svg')
      ? src
      : mencoreAiAvatarImg;

  const [imgSrc, setImgSrc] = useState<string>(validInitialSrc);
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-14 h-14 text-lg',
  };

  const handleImageError = () => {
    if (imgSrc !== mencoreAiAvatarImg && imgSrc !== '/mencore-ai-avatar.jpg') {
      setImgSrc(mencoreAiAvatarImg || '/mencore-ai-avatar.jpg');
    } else {
      setHasError(true);
    }
  };

  return (
    <div className={`relative flex items-center justify-center shrink-0 rounded-full overflow-hidden border border-blue-500/30 shadow-xs bg-slate-900 ${sizeClasses[size]} ${className}`}>
      {!hasError ? (
        <img
          src={imgSrc}
          alt="MenCore Smart Assistant"
          className="w-full h-full object-cover rounded-full"
          onError={handleImageError}
        />
      ) : (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-blue-400">
          <Bot className="w-3/5 h-3/5 text-blue-400" />
        </div>
      )}
    </div>
  );
};

interface MenCoreFullLogoProps {
  className?: string;
  showSubtitle?: boolean;
}

export const MenCoreFullLogo: React.FC<MenCoreFullLogoProps> = ({
  className = '',
  showSubtitle = true,
}) => {
  const [imgSrc, setImgSrc] = useState<string>(mencoreLogoImg || '/mencore-logo.jpg');
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {!hasError ? (
        <img
          src={imgSrc}
          alt="Smart MenCore - Powered by Menmex"
          className="h-16 md:h-20 object-contain drop-shadow-lg"
          onError={() => {
            if (imgSrc !== '/mencore-logo.jpg') {
              setImgSrc('/mencore-logo.jpg');
            } else {
              setHasError(true);
            }
          }}
        />
      ) : (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-cyan-500/40 rounded-2xl shadow-lg">
          <Bot className="w-8 h-8 text-cyan-400" />
          <div className="text-left">
            <span className="font-black text-lg text-white tracking-wider block">MenCore AI</span>
            <span className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest block">Smart Tutor Studio</span>
          </div>
        </div>
      )}
      {showSubtitle && (
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 mt-1">
          Powered by Menmex
        </span>
      )}
    </div>
  );
};
