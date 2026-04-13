import { useEffect, useMemo, useRef, useState } from 'react';

const readWindowMetrics = () => ({
      scrollTop: typeof window !== 'undefined' ? window.scrollY : 0,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0
});

const getColumnCount = (width) => {
      if (width >= 1200) return 4;
      if (width >= 768) return 3;
      return 2;
};

const VirtualizedGrid = ({
      items,
      gap = 12,
      overscan = 2,
      renderItem,
      className = ''
}) => {
      const containerRef = useRef(null);
      const [{ scrollTop, viewportHeight }, setWindowMetrics] = useState(readWindowMetrics);
      const [containerTop, setContainerTop] = useState(0);
      const [containerWidth, setContainerWidth] = useState(0);

      useEffect(() => {
            const updateLayout = () => {
                  setWindowMetrics(readWindowMetrics());
                  if (!containerRef.current) return;

                  const rect = containerRef.current.getBoundingClientRect();
                  setContainerTop(rect.top + window.scrollY);
                  setContainerWidth(rect.width);
            };

            updateLayout();
            window.addEventListener('scroll', updateLayout, { passive: true });
            window.addEventListener('resize', updateLayout);

            const observer = typeof ResizeObserver !== 'undefined'
                  ? new ResizeObserver(updateLayout)
                  : null;
            if (observer && containerRef.current) {
                  observer.observe(containerRef.current);
            }

            return () => {
                  observer?.disconnect();
                  window.removeEventListener('scroll', updateLayout);
                  window.removeEventListener('resize', updateLayout);
            };
      }, []);

      const columnCount = Math.max(1, getColumnCount(containerWidth || 0));
      const itemSize = containerWidth > 0
            ? Math.max(120, Math.floor((containerWidth - (gap * (columnCount - 1))) / columnCount))
            : 160;
      const rowHeight = itemSize + gap;
      const rowCount = Math.ceil(items.length / columnCount);
      const totalHeight = Math.max(0, (rowCount * rowHeight) - gap);

      const viewportStart = Math.max(0, scrollTop - containerTop);
      const startRow = Math.max(0, Math.floor(viewportStart / rowHeight) - overscan);
      const visibleRows = Math.ceil((viewportHeight || rowHeight) / rowHeight) + (overscan * 2);
      const endRow = Math.min(rowCount, startRow + visibleRows);

      const visibleItems = useMemo(() => {
            const next = [];

            for (let rowIndex = startRow; rowIndex < endRow; rowIndex += 1) {
                  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
                        const itemIndex = (rowIndex * columnCount) + columnIndex;
                        const item = items[itemIndex];
                        if (!item) continue;

                        next.push({
                              item,
                              itemIndex,
                              columnIndex,
                              rowIndex
                        });
                  }
            }

            return next;
      }, [columnCount, endRow, items, startRow]);

      return (
            <div
                  ref={containerRef}
                  className={className}
                  style={{ position: 'relative', minHeight: totalHeight || 'auto', height: totalHeight || 'auto' }}
            >
                  {visibleItems.map(({ item, itemIndex, columnIndex, rowIndex }) => (
                        <div
                              key={item?._id || `${itemIndex}`}
                              style={{
                                    position: 'absolute',
                                    top: rowIndex * rowHeight,
                                    left: columnIndex * (itemSize + gap),
                                    width: itemSize,
                                    height: itemSize
                              }}
                        >
                              {renderItem(item, itemIndex)}
                        </div>
                  ))}
            </div>
      );
};

export default VirtualizedGrid;
