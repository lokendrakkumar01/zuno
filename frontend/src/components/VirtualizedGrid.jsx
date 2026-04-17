const VirtualizedGrid = ({
      items,
      gap = 12,
      renderItem,
      className = ''
}) => (
      <div
            className={className}
            style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: `${gap}px`
            }}
      >
            {items.map((item, itemIndex) => (
                  <div
                        key={item?._id || `${itemIndex}`}
                        style={{
                              aspectRatio: '1 / 1',
                              minWidth: 0,
                              contentVisibility: 'auto',
                              containIntrinsicSize: '180px'
                        }}
                  >
                        {renderItem(item, itemIndex)}
                  </div>
            ))}
      </div>
);

export default VirtualizedGrid;
