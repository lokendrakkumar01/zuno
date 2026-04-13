import { useEffect, useMemo, useRef, useState } from 'react';

const getWindowMetrics = () => ({
      scrollTop: typeof window !== 'undefined' ? window.scrollY : 0,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0
});

const VirtualizedList = ({
      items,
      itemHeight = 520,
      overscan = 3,
      renderItem,
      className = '',
      itemClassName = ''
}) => {
      const containerRef = useRef(null);
      const [containerTop, setContainerTop] = useState(0);
      const [{ scrollTop, viewportHeight }, setWindowMetrics] = useState(getWindowMetrics);

      useEffect(() => {
            const updateMetrics = () => setWindowMetrics(getWindowMetrics());
            const measureContainer = () => {
                  if (!containerRef.current) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  setContainerTop(rect.top + window.scrollY);
            };

            const handleWindowChange = () => {
                  updateMetrics();
                  measureContainer();
            };

            handleWindowChange();
            window.addEventListener('scroll', handleWindowChange, { passive: true });
            window.addEventListener('resize', handleWindowChange);

            return () => {
                  window.removeEventListener('scroll', handleWindowChange);
                  window.removeEventListener('resize', handleWindowChange);
            };
      }, []);

      const totalHeight = items.length * itemHeight;
      const viewportStart = Math.max(0, scrollTop - containerTop);
      const startIndex = Math.max(0, Math.floor(viewportStart / itemHeight) - overscan);
      const visibleCount = Math.ceil((viewportHeight || itemHeight) / itemHeight) + (overscan * 2);
      const endIndex = Math.min(items.length, startIndex + visibleCount);

      const visibleItems = useMemo(
            () => items.slice(startIndex, endIndex),
            [endIndex, items, startIndex]
      );

      return (
            <div
                  ref={containerRef}
                  className={className}
                  style={{ position: 'relative', minHeight: totalHeight || 'auto', height: totalHeight || 'auto' }}
            >
                  {visibleItems.map((item, visibleIndex) => {
                        const index = startIndex + visibleIndex;

                        return (
                              <div
                                    key={item?._id || `${index}`}
                                    className={itemClassName}
                                    style={{
                                          position: 'absolute',
                                          top: index * itemHeight,
                                          left: 0,
                                          right: 0,
                                          minHeight: itemHeight
                                    }}
                              >
                                    {renderItem(item, index)}
                              </div>
                        );
                  })}
            </div>
      );
};

export default VirtualizedList;
