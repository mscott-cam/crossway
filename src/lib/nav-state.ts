import type { NavItem } from './site';

export function isCurrent(pathname: string, href?: string): boolean {
  if (!href || href.startsWith('http')) return false;
  const path = pathname.replace(/\/$/, '') || '/';
  return path === href || path.startsWith(`${href}/`);
}

export function hasCurrentChild(pathname: string, item: NavItem): boolean {
  return !!item.children?.some((child) => isCurrent(pathname, child.href));
}
