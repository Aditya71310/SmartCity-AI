import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { DetectionBox } from '../types/smartcity';

interface BoundingBoxViewerProps {
  imageUrl: string;
  alt: string;
  boxes: DetectionBox[];
  accentColor?: 'green' | 'red' | 'amber' | 'cyan';
  className?: string;
}

const COLOR_MAP = {
  green: { border: '#00D69A', bg: 'rgba(0, 214, 154, 0.16)', text: '#070D18' },
  red: { border: '#FF5263', bg: 'rgba(255, 82, 99, 0.16)', text: '#FFFFFF' },
  amber: { border: '#FFB547', bg: 'rgba(255, 181, 71, 0.18)', text: '#070D18' },
  cyan: { border: '#00C8FF', bg: 'rgba(0, 200, 255, 0.16)', text: '#070D18' },
};

export function BoundingBoxViewer({
  imageUrl,
  alt,
  boxes,
  accentColor = 'green',
  className = 'w-full aspect-[4/3]',
}: BoundingBoxViewerProps) {
  const [failed, setFailed] = useState(false);
  const palette = COLOR_MAP[accentColor];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#82AAD2]/20 bg-[#070D18] ${className}`}
    >
      {!failed ? (
        <img
          src={imageUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover block"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#091321] to-[#14243A] text-[#91A2B8] p-6">
          <ImageOff className="w-8 h-8 text-[#00C8FF]/60" />
          <span className="text-xs font-medium text-center">{alt}</span>
        </div>
      )}

      {/* Computer Vision Bounding Box Overlays (0-1000 normalized coordinates) */}
      {!failed &&
        boxes.map((box, idx) => {
          const top = `${Math.max(0, Math.min(92, box.ymin / 10))}%`;
          const left = `${Math.max(0, Math.min(92, box.xmin / 10))}%`;
          const height = `${Math.max(8, Math.min(95, (box.ymax - box.ymin) / 10))}%`;
          const width = `${Math.max(8, Math.min(95, (box.xmax - box.xmin) / 10))}%`;

          return (
            <div
              key={`${box.label}-${idx}`}
              style={{
                top,
                left,
                width,
                height,
                borderColor: palette.border,
                backgroundColor: palette.bg,
              }}
              className="absolute border-2 rounded-md pointer-events-none transition-all duration-200"
            >
              <span
                style={{ backgroundColor: palette.border, color: palette.text }}
                className="absolute -top-6 left-0 px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap font-mono shadow-lg"
              >
                {box.label} ({box.confidence}%)
              </span>
            </div>
          );
        })}
    </div>
  );
}
