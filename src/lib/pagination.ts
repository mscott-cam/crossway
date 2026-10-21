export const PAGE_SIZE = 24;

export function pageHref(
  base: string,
  page: number,
  numberedFirst = false,
): string {
  return page === 1 && !numberedFirst ? base : `${base}/${page}`;
}

export function pageItems(current: number, last: number): (number | null)[] {
  const wanted = new Set(
    [1, last, current - 1, current, current + 1].filter(
      (n) => n >= 1 && n <= last,
    ),
  );
  const pages = [...wanted].sort((a, b) => a - b);
  const items: (number | null)[] = [];
  pages.forEach((page, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined && page - previous === 2) items.push(page - 1);
    else if (previous !== undefined && page - previous > 2) items.push(null);
    items.push(page);
  });
  return items;
}
