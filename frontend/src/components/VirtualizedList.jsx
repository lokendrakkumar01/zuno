const getIntrinsicHeight = (itemHeight) => {
      const numericHeight = Number(itemHeight);
      return Number.isFinite(numericHeight) && numericHeight > 0
            ? `${Math.round(numericHeight)}px`
            : '520px';
};

const VirtualizedList = ({
      items,
      itemHeight = 520,
      renderItem,
      className = '',
      itemClassName = ''
}) => {
      const containIntrinsicSize = getIntrinsicHeight(itemHeight);

      return (
            <div className={className}>
                  {items.map((item, index) => (
                        <div
                              key={item?._id || `${index}`}
                              className={itemClassName}
                              style={{
                                    contentVisibility: 'auto',
                                    containIntrinsicSize
                              }}
                        >
                              {renderItem(item, index)}
                        </div>
                  ))}
            </div>
      );
};

export default VirtualizedList;
