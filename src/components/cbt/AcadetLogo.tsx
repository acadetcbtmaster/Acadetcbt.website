import React from 'react';

export const AcadetCrest: React.FC<{ className?: string }> = ({ className = 'w-11 h-11' }) => (
  <svg
    viewBox="0 0 64 68"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M8 6C8 4.89543 8.89543 4 10 4H54C55.1046 4 56 4.89543 56 6V33C56 49.5 32 63 32 63C32 63 8 49.5 8 33V6Z"
      fill="#FFFFFF"
      stroke="#1E40AF"
      strokeWidth="3"
    />
    <path
      d="M12 8H52V32C52 45.2 32 57 32 57C32 57 12 45.2 12 32V8Z"
      fill="#EFF6FF"
    />
    <rect x="12" y="8" width="40" height="11" fill="#0B337A" />
    <text
      x="32"
      y="16.2"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="7.5"
      fontWeight="800"
      fontFamily="sans-serif"
      letterSpacing="0.5"
    >
      ACADET
    </text>
    {/* Laurel wreath */}
    <path
      d="M21 44C17.5 39.5 17 31.5 21 26M43 44C46.5 39.5 47 31.5 43 26"
      stroke="#15803D"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* Open book + torch */}
    <path
      d="M32 24V42M24 31C27 29.5 30 30 32 32C34 30 37 29.5 40 31V41C37 39.5 34 40 32 42C30 40 27 39.5 24 41V31Z"
      stroke="#0B337A"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="#DBEAFE"
    />
    <circle cx="32" cy="24" r="3.2" fill="#16A34A" />
  </svg>
);

export const HeroStudyGraphic: React.FC = () => (
  <svg
    viewBox="0 0 360 175"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full max-w-[330px] h-auto select-none"
    aria-hidden="true"
  >
    {/* Soft sky swirl background */}
    <path
      d="M30 160C70 80 150 20 330 10V165H30Z"
      fill="#93C5FD"
      fillOpacity="0.25"
    />
    {/* Desk shadow */}
    <ellipse cx="185" cy="158" rx="145" ry="9" fill="#1E3A8A" fillOpacity="0.14" />

    {/* Laptop Screen */}
    <g transform="translate(80, 18) rotate(-2)">
      <rect x="6" y="4" width="176" height="114" rx="10" fill="#1E293B" />
      <rect x="13" y="11" width="162" height="98" rx="5" fill="#FFFFFF" />
      {/* Green Check Circle */}
      <circle cx="94" cy="44" r="15" fill="#0D9488" />
      <path
        d="M87 44.5L92 49.5L102 39"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="94"
        y="76"
        textAnchor="middle"
        fill="#0B337A"
        fontSize="14"
        fontWeight="800"
        fontFamily="sans-serif"
      >
        CBT
      </text>
      <text
        x="94"
        y="92"
        textAnchor="middle"
        fill="#0052CC"
        fontSize="11.5"
        fontWeight="700"
        fontFamily="sans-serif"
      >
        Practice Exam
      </text>
    </g>

    {/* Laptop Base */}
    <path
      d="M52 135L82 128H264L296 141C298 142 297 146 293 146H56C51 146 49 137 52 135Z"
      fill="#CBD5E1"
      stroke="#64748B"
      strokeWidth="1.5"
    />
    <rect x="148" y="138" width="48" height="3.5" rx="1.5" fill="#64748B" />

    {/* Stack of Books + Pen Cup on right */}
    <g transform="translate(262, 62)">
      {/* Pen Cup */}
      <path d="M18 14L22 4H26L23 18" stroke="#1E3A8A" strokeWidth="3" strokeLinecap="round" />
      <path d="M29 14L31 2H35L33 18" stroke="#0052CC" strokeWidth="3" strokeLinecap="round" />
      <path d="M39 15L44 6H48L43 18" stroke="#0F172A" strokeWidth="2.8" strokeLinecap="round" />
      <rect x="13" y="16" width="38" height="36" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />

      {/* Top Book */}
      <rect x="0" y="52" width="76" height="16" rx="3" fill="#2563EB" />
      <rect x="6" y="55" width="64" height="10" rx="2" fill="#EFF6FF" />

      {/* Bottom Book */}
      <rect x="-4" y="69" width="84" height="18" rx="3" fill="#0B337A" />
      <rect x="4" y="73" width="68" height="10" rx="2" fill="#DBEAFE" />
    </g>
  </svg>
);
