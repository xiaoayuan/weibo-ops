"use client";

// 内联 SVG 图标，替代 lucide-react（约 38MB），大幅减少 bundle 和镜像体积
// 每个图标保持与 lucide 相同的 24x24 viewBox 和 strokeWidth=2

function Icon({ path, size = 16, className = "" }: { path: string; size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}

export const LayoutDashboard = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>' />
);

export const Users = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' />
);

export const Tags = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<path d="m15 5 4 4"/><path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13"/><path d="m8 6 2-2"/><path d="m2 22 5.5-1.5L21.17 6.83a2.82 2.82 0 0 0-4-4L3.5 16.5z"/><path d="m18 16 2-2"/><path d="m17 11 4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17"/>' />
);

export const ClipboardList = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>' />
);

export const FileText = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>' />
);

export const CalendarRange = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<path d="M3 12V4"/><path d="M21 12V4"/><path d="M8 12V4"/><path d="M16 12V4"/><path d="M3 18H21"/><rect width="18" height="4" x="3" y="10" rx="1"/>' />
);

export const MessageCircleHeart = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<path d="M7 9.564C7 8.445 7.723 7.5 8.868 7.5c.388 0 .752.106 1.073.293"/><path d="M11.842 7.502C12.061 7 12.603 6.5 13.315 6.5c.71 0 1.254.5 1.473 1.002"/><path d="M13.315 6.5c1.75 0 3 1.75 3 3.5 0 2-1.5 3.5-3 5l-4.5 3-4.5-3c-1.5-1.5-3-3-3-5 0-1.75 1.25-3.5 3-3.5Z"/><path d="M11.25 15.5h.5"/><path d="M12.5 14.5h.5"/>' />
);

export const RefreshCw = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>' />
);

export const Bell = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>' />
);

export const BarChart3 = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>' />
);

export const Settings = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>' />
);

export const Shield = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>' />
);

export const Menu = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>' />
);

export const X = (p: { size?: number; className?: string }) => (
  <Icon size={p.size} className={p.className} path='<path d="M18 6 6 18"/><path d="m6 6 12 12"/>' />
);
