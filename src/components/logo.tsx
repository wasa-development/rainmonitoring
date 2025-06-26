import React from 'react';
import Image from 'next/image';

/**
 * A component that renders the app logo from an image file.
 */
export const Logo = ({ className, width = 64, height = 64 }: { className?: string, width?: number, height?: number }) => (
  <Image
    src="/logo.jpg"
    alt="Punjab WASA Rain Monitoring Logo"
    width={width}
    height={height}
    className={className}
    priority // Load the logo quickly, as it's likely important for LCP
  />
);