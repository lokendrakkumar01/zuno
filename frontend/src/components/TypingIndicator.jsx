const TypingIndicator = ({ visible }) => {
  if (!visible) return null;
  return <div className="px-4 py-2 text-sm text-slate-500">Typing...</div>;
};

export default TypingIndicator;
