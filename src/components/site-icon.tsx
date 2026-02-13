'use client'

import { useBlog } from './blog-provider'

interface SiteIconProps {
  size?: number
  className?: string
}

export function SiteIcon({ size = 32, className = '' }: SiteIconProps) {
  const { settings } = useBlog()
  const icon = settings.site_icon
  const siteName = settings.site_name || 'Blog'
  const firstLetter = siteName.charAt(0).toUpperCase()

  if (icon) {
    return (
      <img
        src={icon}
        alt={siteName}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
      />
    )
  }

  const hue = siteName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360
  const bgColor = `hsl(${hue}, 70%, 50%)`

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        fontSize: size * 0.5
      }}
    >
      {firstLetter}
    </div>
  )
}
