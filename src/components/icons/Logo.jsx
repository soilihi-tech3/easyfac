import React from 'react';

/**
 * EasyfacLogo - Pixel-perfect reproduction of the brand logo
 * White squircle background, blue circle, white document, blue checkmark arrow, and a dollar sign.
 */
export function EasyfacLogo({ size = 48, className = '', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        display: 'block',
        filter: 'drop-shadow(0 4px 12px rgba(0, 102, 255, 0.15))',
        ...style
      }}
    >
      {/* Background rounded squircle */}
      <rect width="120" height="120" rx="30" fill="white" />
      
      {/* Inner vibrant blue circle */}
      <circle cx="60" cy="60" r="42" fill="#0066FF" />
      
      {/* White document sheet */}
      <path
        d="M42 42H64.5L74 51.5V78C74 80.2091 72.2091 82 70 82H42C39.7909 82 38 80.2091 38 78V46C38 43.7909 39.7909 42 42 42Z"
        fill="white"
      />
      
      {/* Folded paper corner */}
      <path d="M64 42V51.5H74L64 42Z" fill="#D2E3FC" />
      
      {/* Document horizontal lines */}
      <line x1="45" y1="54" x2="60" y2="54" stroke="#AECBFA" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="45" y1="62" x2="60" y2="62" stroke="#AECBFA" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="45" y1="70" x2="54" y2="70" stroke="#AECBFA" strokeWidth="2.5" strokeLinecap="round" />
      
      {/* Dollar symbol ($) */}
      <text
        x="77"
        y="72"
        fill="white"
        fontSize="13"
        fontWeight="800"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >
        $
      </text>
      
      {/* Checkmark Arrow */}
      {/* Draw the main check-and-shoot stroke */}
      <path
        d="M51 66.5L57.5 73L78.5 48.5"
        stroke="#0066FF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Draw the arrowhead pointing up-right */}
      <path
        d="M68 48.5H78.5V59"
        stroke="#0066FF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * EasyfacBrand - Full logo with typography below or next to it
 */
export function EasyfacBrand({
  size = 64,
  direction = 'column',
  textLight = false,
  subtitle = true,
  style = {}
}) {
  const isRow = direction === 'row';
  
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: direction,
        alignItems: 'center',
        gap: isRow ? 14 : 12,
        ...style
      }}
    >
      <EasyfacLogo size={size} />
      
      <div style={{ textAlign: isRow ? 'left' : 'center', userSelect: 'none' }}>
        <h1
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontWeight: '900',
            fontSize: isRow ? '22px' : '26px',
            color: textLight ? '#ffffff' : '#0F2C59',
            letterSpacing: '-0.03em',
            margin: 0,
            lineHeight: 1.1
          }}
        >
          easyfac
        </h1>
        {subtitle && (
          <p
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontWeight: '600',
              fontSize: isRow ? '11px' : '12px',
              color: textLight ? 'rgba(255, 255, 255, 0.75)' : '#6B7280',
              letterSpacing: '0.02em',
              margin: '3px 0 0 0',
              lineHeight: 1.2
            }}
          >
            Gestion de Reçus Simple
          </p>
        )}
      </div>
    </div>
  );
}
