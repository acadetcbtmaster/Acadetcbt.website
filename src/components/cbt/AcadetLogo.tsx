import React, { createContext, useContext } from 'react';
import type { FounderProfileData, SiteBrandingData } from '../../types/cbt';

export const DEFAULT_CLIENT_BRANDING: SiteBrandingData = {
  siteName: 'Acadet CBT',
  tagline: '...Learn, Practice, Excel',
  siteDescription:
    'Acadet CBT is an online CBT practice and learning platform in Nigeria helping students prepare with JAMB UTME tests, 100 Level university tutorials, course study materials, and instant performance analytics.',
  seoTitle: 'Acadet CBT – Online CBT Practice and Learning Platform',
  seoDescription:
    'Acadet CBT is an online CBT practice and learning platform in Nigeria for JAMB UTME preparation, 100 Level university tutorials, courses, and study materials.',
  seoKeywords:
    'Acadet CBT, Acadet Learning Hub, online CBT practice Nigeria, JAMB CBT practice, UTME CBT practice, 100 Level university tutorials, computer-based test practice, university exam preparation Nigeria, online course registration, CBT study materials',
  logoUrl: '/acadet-logo.png',
  faviconUrl: '/favicon-48x48.png',
  contactEmail: 'support@acadetcbt.website',
  contactPhone: null,
  contactWhatsapp: null,
  socialLinks: {},
  updatedAt: new Date(0).toISOString(),
};

export const DEFAULT_CLIENT_FOUNDER: FounderProfileData = {
  fullName: 'ISAIAH (MENMEX)',
  positionTitle: 'Founder & Creator, Acadet CBT',
  biography:
    'Isaiah, popularly known as Menmex, is the Founder and Creator of Acadet CBT. He is a digital content creator and technology enthusiast interested in building practical digital solutions and supporting students through accessible educational resources and technology-driven learning.',
  founderMessage:
    'Acadet CBT was established to make learning, examination preparation and academic practice more accessible to students. Our goal is to provide a platform where students can improve their understanding, practise effectively and build confidence in their academic journey.',
  visionStatement:
    'To make structured academic preparation, computer-based testing practice, and accessible study materials available to every student preparing for success.',
  missionStatement:
    "To improve students' understanding of registered courses, provide reliable CBT simulations and educational resources, and build academic confidence through consistent practice and performance insight.",
  backgroundStory:
    'Acadet CBT was created under Acadet Learning Hub to bridge the gap between classroom study and realistic computer-based examination readiness, combining curated courses, study materials, verified assessments, and guided tutorial support.',
  photoUrl: null,
  socialLinks: {},
  updatedAt: new Date(0).toISOString(),
};

interface BrandingContextValue {
  branding: SiteBrandingData;
  founder: FounderProfileData;
  refreshBranding?: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_CLIENT_BRANDING,
  founder: DEFAULT_CLIENT_FOUNDER,
});

export const BrandingProvider: React.FC<{
  branding: SiteBrandingData;
  founder: FounderProfileData;
  refreshBranding?: () => Promise<void>;
  children: React.ReactNode;
}> = ({ branding, founder, refreshBranding, children }) => (
  <BrandingContext.Provider value={{ branding, founder, refreshBranding }}>
    {children}
  </BrandingContext.Provider>
);

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}

interface AcadetCrestProps {
  className?: string;
  src?: string;
  alt?: string;
  frameOnDark?: boolean;
  priority?: boolean;
}

export const AcadetCrest: React.FC<AcadetCrestProps> = ({
  className = 'w-11 h-11',
  src,
  alt,
  frameOnDark = true,
  priority = false,
}) => {
  const { branding } = useBranding();
  const rawSrc = src || branding.logoUrl || '/acadet-logo.png';
  // Use lightweight 192x192 crest (~60KB vs 901KB full 1024px PNG) for UI crest badges on mobile networks
  const resolvedSrc = rawSrc === '/acadet-logo.png' ? '/favicon-192x192.png' : rawSrc;
  const resolvedAlt = alt || `${branding.siteName} official logo`;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden select-none ${
        frameOnDark
          ? 'rounded-xl bg-white p-0.5 shadow-xs ring-1 ring-slate-200/70'
          : 'rounded-xl bg-transparent'
      } ${className}`}
    >
      <img
        src={resolvedSrc}
        alt={resolvedAlt}
        width={48}
        height={48}
        className="w-full h-full object-contain"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
      />
    </span>
  );
};

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
      <path d="M18 14L22 4H26L23 18" stroke="#1E3A8A" strokeWidth="3" strokeLinecap="round" />
      <path d="M29 14L31 2H35L33 18" stroke="#0052CC" strokeWidth="3" strokeLinecap="round" />
      <path d="M39 15L44 6H48L43 18" stroke="#0F172A" strokeWidth="2.8" strokeLinecap="round" />
      <rect x="13" y="16" width="38" height="36" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <rect x="0" y="52" width="76" height="16" rx="3" fill="#2563EB" />
      <rect x="6" y="55" width="64" height="10" rx="2" fill="#EFF6FF" />
      <rect x="-4" y="69" width="84" height="18" rx="3" fill="#0B337A" />
      <rect x="4" y="73" width="68" height="10" rx="2" fill="#DBEAFE" />
    </g>
  </svg>
);
