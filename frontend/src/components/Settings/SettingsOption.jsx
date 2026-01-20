const SettingsOption = ({ icon, label, value, badge, onClick, subtitle }) => {
      return (
            <div
                  className="settings-option"
                  onClick={onClick}
                  style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px',
                        cursor: onClick ? 'pointer' : 'default',
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'transparent',
                        minHeight: '60px'
                  }}
                  onMouseEnter={(e) => {
                        if (onClick) {
                              e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                        }
                  }}
                  onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                  }}
            >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        <span style={{ fontSize: '24px', lineHeight: 1 }}>{icon}</span>
                        <div style={{ flex: 1 }}>
                              <div style={{
                                    fontWeight: '400',
                                    fontSize: '16px',
                                    color: 'var(--color-text-primary)',
                                    lineHeight: '20px'
                              }}>
                                    {label}
                              </div>
                              {subtitle && (
                                    <div style={{
                                          fontSize: '14px',
                                          color: 'var(--color-text-secondary)',
                                          marginTop: '4px',
                                          lineHeight: '16px'
                                    }}>
                                          {subtitle}
                                    </div>
                              )}
                        </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {value && (
                              <span style={{
                                    fontSize: '14px',
                                    color: 'var(--color-text-secondary)',
                                    marginRight: '4px'
                              }}>
                                    {value}
                              </span>
                        )}
                        {badge && (
                              <span style={{
                                    fontSize: '12px',
                                    color: 'var(--color-text-secondary)',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    backgroundColor: 'var(--color-bg-tertiary)',
                                    whiteSpace: 'nowrap'
                              }}>
                                    {badge}
                              </span>
                        )}
                        {onClick && (
                              <span style={{
                                    fontSize: '20px',
                                    color: 'var(--color-text-muted)',
                                    lineHeight: 1
                              }}>
                                    ›
                              </span>
                        )}
                  </div>
            </div>
      );
};

export default SettingsOption;
