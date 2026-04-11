const createIcon = (path, viewBox = '0 0 24 24') => {
      const Icon = ({ size = 20, filled = false, className = '', ...props }) => (
            <svg
                  viewBox={viewBox}
                  width={size}
                  height={size}
                  fill={filled ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={className}
                  aria-hidden="true"
                  {...props}
            >
                  {path(filled)}
            </svg>
      );

      return Icon;
};

export const HeartIcon = createIcon((filled) => (
      <>
            <path d="M12 20.5 4.9 13.8a4.8 4.8 0 0 1 0-6.9 4.9 4.9 0 0 1 6.9 0L12 8l.2-.2a4.9 4.9 0 0 1 6.9 0 4.8 4.8 0 0 1 0 6.9Z" />
            {filled ? <path d="M12 20.5 4.9 13.8a4.8 4.8 0 0 1 0-6.9 4.9 4.9 0 0 1 6.9 0L12 8l.2-.2a4.9 4.9 0 0 1 6.9 0 4.8 4.8 0 0 1 0 6.9Z" stroke="none" /> : null}
      </>
));

export const BookmarkIcon = createIcon((filled) => (
      <path d="M6.8 20.5V5.8A1.8 1.8 0 0 1 8.6 4h6.8a1.8 1.8 0 0 1 1.8 1.8v14.7L12 16.8Z" />
));

export const CommentIcon = createIcon(() => (
      <path d="M7 18.5 3.5 20V6.8A2.8 2.8 0 0 1 6.3 4h11.4a2.8 2.8 0 0 1 2.8 2.8v7.4a2.8 2.8 0 0 1-2.8 2.8H7Z" />
));

export const ShareIcon = createIcon(() => (
      <>
            <path d="m14 5 5-1v5" />
            <path d="m19 4-8.5 8.5" />
            <path d="M20 13.5v3.7a2.8 2.8 0 0 1-2.8 2.8H6.8A2.8 2.8 0 0 1 4 17.2V6.8A2.8 2.8 0 0 1 6.8 4H10" />
      </>
));

export const SendIcon = createIcon(() => (
      <>
            <path d="M21 3 10 14" />
            <path d="m21 3-7 18-4-7-7-4Z" />
      </>
));

export const TrashIcon = createIcon(() => (
      <>
            <path d="M4 7h16" />
            <path d="M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7" />
            <path d="m7.5 7 .7 11.1a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9L16.5 7" />
            <path d="M10 11.2v4.6" />
            <path d="M14 11.2v4.6" />
      </>
));

export const CheckIcon = createIcon(() => (
      <path d="m5 12.5 4.2 4.2L19 7" />
));

export const EditIcon = createIcon(() => (
      <>
            <path d="M12 20h8" />
            <path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z" />
      </>
));

export const DownloadIcon = createIcon(() => (
      <>
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
      </>
));

export const ClockIcon = createIcon(() => (
      <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
      </>
));

export const SettingsIcon = createIcon(() => (
      <>
            <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
            <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 1 1-1.7 1.7l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9v.3a1.2 1.2 0 0 1-2.4 0v-.2a1 1 0 0 0-.7-1 1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 1 1-1.7-1.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6h-.2a1.2 1.2 0 1 1 0-2.4h.2a1 1 0 0 0 1-.7 1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 1 1 1.7-1.7l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V5.2a1.2 1.2 0 1 1 2.4 0v.2a1 1 0 0 0 .7 1 1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 1 1 1.7 1.7l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.3a1.2 1.2 0 0 1 0 2.4h-.2a1 1 0 0 0-1 .7Z" />
      </>
));

export const BlockIcon = createIcon(() => (
      <>
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 8.5 7 7" />
      </>
));

export const UserPlusIcon = createIcon(() => (
      <>
            <path d="M15.5 19.5v-1.2a3.8 3.8 0 0 0-3.8-3.8H7.8A3.8 3.8 0 0 0 4 18.3v1.2" />
            <circle cx="9.8" cy="8" r="3.3" />
            <path d="M18 8v6" />
            <path d="M15 11h6" />
      </>
));

export const MessageIcon = createIcon(() => (
      <>
            <path d="M4.5 19.5 6 15.8h11.2a2.8 2.8 0 0 0 2.8-2.8V6.8A2.8 2.8 0 0 0 17.2 4H6.8A2.8 2.8 0 0 0 4 6.8v12.7Z" />
            <path d="M8 9.5h8" />
            <path d="M8 12.5h5" />
      </>
));
