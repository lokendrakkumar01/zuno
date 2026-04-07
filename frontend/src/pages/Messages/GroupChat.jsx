import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketContext } from '../../context/SocketContext';
import { API_URL } from '../../config';
import { useCallContext } from '../../context/CallContext';
import UserAvatar from '../../components/User/UserAvatar';

// Common emojis organized by category
const EMOJI_DATA = {
      '😀': ['😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😇', '🤗', '🤔', '😏', '😴', '🤤', '😋', '🤪', '😜', '😝'],
      '❤️': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💖', '💗', '💘', '💝', '💞', '💓', '💔', '🫶', '🤝', '👍', '👎'],
      '🎉': ['🎉', '🎊', '🎈', '🎁', '🎂', '🔥', '⭐', '✨', '💫', '🌟', '💯', '✅', '❌', '⚡', '💥', '💢', '💤', '🎵', '🎶', '🎯'],
      '🙏': ['🙏', '💪', '✌️', '🤞', '👋', '👏', '🙌', '👐', '🤲', '🫡', '🫣', '🫢', '🤫', '🤭', '🫠', '😐', '😑', '😶', '🙄', '😬'],
      '🍕': ['🍕', '🍔', '🍟', '🌮', '🍜', '🍩', '🍪', '🎂', '🧁', '🍰', '🍫', '🍬', '☕', '🧃', '🍷', '🍻', '🥤', '🍳', '🥗', '🍣']
};

const GroupChat = () => {
      const { groupId } = useParams();
      const { token, user } = useAuth();
      const { socket, onlineUsers } = useSocketContext();
      const navigate = useNavigate();
      const [messages, setMessages] = useState(() => {
            try {
                  const cached = localStorage.getItem(`zuno_group_chat_cache_${groupId}`);
                  return cached ? JSON.parse(cached) : [];
            } catch {
                  return [];
            }
      });
      const [groupInfo, setGroupInfo] = useState(() => {
            try {
                  const cached = localStorage.getItem(`zuno_group_info_cache_${groupId}`);
                  return cached ? JSON.parse(cached) : null;
            } catch {
                  return null;
            }
      });
      const [newMessage, setNewMessage] = useState('');
      const [loading, setLoading] = useState(!localStorage.getItem(`zuno_group_chat_cache_${groupId}`));
      const [loadingMore, setLoadingMore] = useState(false);
      const [page, setPage] = useState(1);
      const [hasMore, setHasMore] = useState(true);
      const [sending, setSending] = useState(false);
      const messagesEndRef = useRef(null);
      const chatAreaRef = useRef(null);
      const fileInputRef = useRef(null);
      const sentMsgIds = useRef(new Set()); 
      const sendSoundRef = useRef(null);
      const receiveSoundRef = useRef(null);

      // Edit & Delete states
      const [activeMenu, setActiveMenu] = useState(null);
      const [editingId, setEditingId] = useState(null);
      const [editText, setEditText] = useState('');

      // Emoji picker
      const [showEmoji, setShowEmoji] = useState(false);

      // Media preview
      const [mediaPreview, setMediaPreview] = useState(null);
      const [mediaFile, setMediaFile] = useState(null);

      // Customization
      const [showCustomizeModal, setShowCustomizeModal] = useState(false);
      const defaultCustomization = { themeColor: '#6366f1', bgImage: null };
      const [chatCustomization, setChatCustomization] = useState(defaultCustomization);

      // Group / Call features
      const { startGroupCall } = useCallContext();
      const [pinnedMessage, setPinnedMessage] = useState(null);

      // Group Info Modal
      const [showGroupInfo, setShowGroupInfo] = useState(false);
      const [showAddParticipants, setShowAddParticipants] = useState(false);
      const [addSearchQuery, setAddSearchQuery] = useState('');
      const [addSearchResults, setAddSearchResults] = useState([]);
      const [selectedUsers, setSelectedUsers] = useState([]);
      const [editingGroupInfo, setEditingGroupInfo] = useState(false);
      const [editGroupName, setEditGroupName] = useState('');
      const [editGroupFile, setEditGroupFile] = useState(null);
      const [editGroupPreview, setEditGroupPreview] = useState(null);
      const groupPhotoInputRef = useRef(null);
      const THEMES = [
            { id: 'indigo', color: '#6366f1' },
            { id: 'rose', color: '#f43f5e' },
            { id: 'emerald', color: '#10b981' },
            { id: 'amber', color: '#f59e0b' },
            { id: 'purple', color: '#a855f7' },
            { id: 'blue', color: '#3b82f6' },
            { id: 'dark', color: '#334155' }
      ];

      // Load customization on mount
      useEffect(() => {
            if (user && user._id) {
                  const saved = localStorage.getItem(`zuno_chat_prefs_${user._id}`);
                  if (saved) {
                        try {
                              setChatCustomization(JSON.parse(saved));
                        } catch (e) {
                              console.error('Failed to parse chat preferences');
                        }
                  }
            }
      }, [user]);

      // Save customization
      const saveCustomization = (newPrefs) => {
            setChatCustomization(newPrefs);
            if (user && user._id) {
                  localStorage.setItem(`zuno_chat_prefs_${user._id}`, JSON.stringify(newPrefs));
            }
      };

      const handleBgImageUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                  alert('Background image must be less than 5MB');
                  return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                  saveCustomization({ ...chatCustomization, bgImage: reader.result });
            };
            reader.readAsDataURL(file);
      };

      // Replies
      const [replyingTo, setReplyingTo] = useState(null);

      const currentUserIdStr = (user?._id || user?.id || '').toString();
      const adminIdStr = (groupInfo?.groupAdmin?._id || groupInfo?.groupAdmin || '').toString();
      const isAdmin = Boolean(currentUserIdStr && adminIdStr && currentUserIdStr === adminIdStr);
      const canPost = !groupInfo?.isChannel || isAdmin;

      useEffect(() => {
            try {
                  const cachedMsgs = localStorage.getItem(`zuno_group_chat_cache_${groupId}`);
                  if (cachedMsgs) {
                        setMessages(JSON.parse(cachedMsgs));
                        setLoading(false);
                  } else {
                        setMessages([]);
                        setLoading(true);
                  }

                  const cachedGroup = localStorage.getItem(`zuno_group_info_cache_${groupId}`);
                  if (cachedGroup) {
                        setGroupInfo(JSON.parse(cachedGroup));
                  } else {
                        setGroupInfo(null);
                  }
            } catch {
                  setMessages([]);
                  setGroupInfo(null);
                  setLoading(true);
            }

            fetchMessages(1);
            sentMsgIds.current = new Set();
      }, [groupId]);

      const handleScroll = (e) => {
            const el = e.target;
            if (el.scrollTop === 0 && hasMore && !loadingMore && !loading) {
                  fetchMessages(page + 1);
            }
      };

      // Initialize sounds
      useEffect(() => {
            sendSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            receiveSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
            sendSoundRef.current.load();
            receiveSoundRef.current.load();
      }, []);

      const playSound = (type) => {
            try {
                  const sound = type === 'send' ? sendSoundRef.current : receiveSoundRef.current;
                  if (sound) {
                        sound.currentTime = 0;
                        sound.play().catch(e => console.log('Audio play blocked or failed', e));
                  }
            } catch (e) { }
      };

      useEffect(() => {
            if (!socket) return;

            const handleNewGroupMessage = (newMsg) => {
                  if (newMsg.conversationId !== groupId) return;

                  const incomingSenderId = (newMsg.sender?._id || newMsg.sender || '').toString();
                  const currentUserId = (user?._id || user?.id || '').toString();
                  const isMyEcho = incomingSenderId === currentUserId;

                  if (isMyEcho) {
                        if (sentMsgIds.current.has(newMsg._id?.toString())) return;
                  }

                  setMessages((prev) => {
                        const newId = newMsg._id?.toString();
                        if (prev.some(m => (m._id?.toString()) === newId)) return prev;
                        if (!isMyEcho) playSound('receive');
                        return [...prev, newMsg];
                  });
            };

            const handleMessageReaction = (data) => {
                  if (data.conversationId !== groupId) return;
                  setMessages(prev => {
                        const updated = prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m);
                        return updated;
                  });
            };

            const handleGroupMessageDeletedForEveryone = (data) => {
                  if (data.conversationId && data.conversationId.toString() !== groupId) return;
                  setMessages(prev =>
                        prev.map(m =>
                              m._id?.toString() === data.messageId?.toString()
                                    ? { ...m, deletedForEveryone: true, text: '', media: null }
                                    : m
                        )
                  );
            };

            socket.on("newGroupMessage", handleNewGroupMessage);
            socket.on("messageReaction", handleMessageReaction);
            socket.on("messageDeletedForEveryone", handleGroupMessageDeletedForEveryone);

            return () => {
                  socket.off("newGroupMessage", handleNewGroupMessage);
                  socket.off("messageReaction", handleMessageReaction);
                  socket.off("messageDeletedForEveryone", handleGroupMessageDeletedForEveryone);
            };
      }, [socket, groupId, token, user]);

      useEffect(() => {
            const lastMsg = messages[messages.length - 1];
            const isMySent = lastMsg?.sender?._id === user?._id || lastMsg?.sender === user?._id;
            scrollToBottom(isMySent);
      }, [messages]);

      useEffect(() => {
            const handleClickOutside = (e) => {
                  if (!e.target.closest('.emoji-picker-container')) setShowEmoji(false);
                  setActiveMenu(null);
            };
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
      }, []);

      const scrollToBottom = (instant = false) => {
            if (instant) {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            } else {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
      };

      const fetchMessages = async (pageNum = 1) => {
            const hasCached = !!localStorage.getItem(`zuno_group_chat_cache_${groupId}`);
            if (!hasCached && pageNum === 1) setLoading(true);
            if (pageNum > 1) setLoadingMore(true);

            try {
                  const res = await fetch(`${API_URL}/messages/group/${groupId}?page=${pageNum}&limit=50`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        const newMsgs = data.data.messages;
                        if (newMsgs.length < 50) setHasMore(false);
                        else setHasMore(true);

                        if (pageNum === 1) {
                              setMessages(newMsgs);
                              setPage(1);
                              setGroupInfo(data.data.group);
                              try {
                                    localStorage.setItem(`zuno_group_chat_cache_${groupId}`, JSON.stringify(newMsgs.slice(-100)));
                                    localStorage.setItem(`zuno_group_info_cache_${groupId}`, JSON.stringify(data.data.group));
                              } catch (e) { }

                              requestAnimationFrame(() => {
                                    setTimeout(() => scrollToBottom(true), 80);
                              });
                        } else {
                              setMessages(prev => {
                                    const merged = [...newMsgs, ...prev];
                                    const map = new Map();
                                    merged.forEach(m => map.set(m._id?.toString(), m));
                                    return Array.from(map.values()).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
                              });
                              setPage(pageNum);
                              requestAnimationFrame(() => {
                                    if (chatAreaRef.current) chatAreaRef.current.scrollTop = 50; 
                              });
                        }
                  } else {
                        throw new Error(data.message || 'Failed to load messages');
                  }
            } catch (err) {
                  console.error('Failed to fetch messages:', err);
                  if (pageNum === 1) {
                        const cachedMsgs = localStorage.getItem(`zuno_group_chat_cache_${groupId}`);
                        if (cachedMsgs) setMessages(JSON.parse(cachedMsgs));
                  }
            } finally {
                  setLoading(false);
                  setLoadingMore(false);
            }
      };

      const fetchGroupInfo = async () => {
            try {
                  const res = await fetch(`${API_URL}/messages/group/${groupId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setGroupInfo(data.data.group);
                        try {
                              localStorage.setItem(`zuno_group_info_cache_${groupId}`, JSON.stringify(data.data.group));
                        } catch (e) { }
                  }
            } catch (err) {
                  console.error('Failed to fetch group info:', err);
            }
      };

      const handleAddParticipantSearch = async (query) => {
            setAddSearchQuery(query);
            if (query.trim().length < 2) {
                  setAddSearchResults([]);
                  return;
            }
            try {
                  const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setAddSearchResults(data.data.users.filter(u => u._id !== user?._id && !groupInfo?.participants?.some(p => (p._id || p) === u._id)));
                  }
            } catch (err) {
                  console.error(err);
            }
      };

      const confirmAddParticipants = async () => {
            if (selectedUsers.length === 0) return;
            try {
                  const res = await fetch(`${API_URL}/messages/group/${groupId}/participants/add`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ participants: selectedUsers.map(u => u._id) })
                  });
                  const data = await res.json();
                  if (data.success) {
                        setShowAddParticipants(false);
                        setSelectedUsers([]);
                        fetchGroupInfo();
                  } else {
                        alert(data.message);
                  }
            } catch (err) {
                  console.error('Failed to add participants:', err);
            }
      };

      const handleRemoveParticipant = async (userId) => {
            if (!window.confirm('Remove this user from the group?')) return;
            try {
                  const res = await fetch(`${API_URL}/messages/group/${groupId}/participants/remove`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ userId })
                  });
                  const data = await res.json();
                  if (data.success) {
                        fetchGroupInfo();
                  } else {
                        alert(data.message);
                  }
            } catch (err) {
                  console.error('Failed to remove participant:', err);
            }
      };

      const handleLeaveGroup = async () => {
            if (!window.confirm('Are you sure you want to leave this group?')) return;
            try {
                  const res = await fetch(`${API_URL}/messages/group/${groupId}/leave`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        navigate('/messages');
                  } else {
                        alert(data.message);
                  }
            } catch (err) {
                  console.error('Failed to leave group:', err);
            }
      };

      const initiateGroupCall = (type = 'video') => {
            if (!groupInfo || !groupInfo.participants) return;
            // Filter participants to ping (max 4 incl me in Mesh WebRTC)
            startGroupCall(groupId, groupInfo.groupName, groupInfo.participants, type);
      };

      const handlePinMessage = (msg) => {
            setPinnedMessage(msg);
            setActiveMenu(null);
            // Ideally save to backend, but local state works for current session UX demonstration 
      };

      const handleUpdateGroupInfo = async () => {
            if (!editGroupName.trim() && !editGroupFile) {
                  setEditingGroupInfo(false);
                  return;
            }
            try {
                  const formData = new FormData();
                  if (editGroupName.trim()) formData.append('groupName', editGroupName);
                  if (editGroupFile) formData.append('groupAvatar', editGroupFile);
                  
                  // if name didn't change and we only have a photo, we still need to send the request
                  if (editGroupName.trim() === groupInfo?.groupName && !editGroupFile) {
                        setEditingGroupInfo(false);
                        return;
                  }

                  const res = await fetch(`${API_URL}/messages/group/${groupId}/info`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                  });
                  const data = await res.json();
                  if (data.success) {
                        setEditingGroupInfo(false);
                        setEditGroupFile(null);
                        setEditGroupPreview(null);
                        fetchGroupInfo();
                  } else {
                        alert(data.message);
                  }
            } catch (err) {
                  console.error('Failed to update group info:', err);
            }
      };

      const compressImage = (file) => {
            return new Promise((resolve) => {
                  if (!file.type.startsWith('image')) {
                        resolve(file);
                        return;
                  }
                  const img = new Image();
                  const canvas = document.createElement('canvas');
                  const reader = new FileReader();

                  reader.onload = (e) => {
                        img.onload = () => {
                              let { width, height } = img;
                              const MAX = 800;
                              if (width > MAX || height > MAX) {
                                    if (width > height) {
                                          height = Math.round((height * MAX) / width);
                                          width = MAX;
                                    } else {
                                          width = Math.round((width * MAX) / height);
                                          height = MAX;
                                    }
                              }
                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx.drawImage(img, 0, 0, width, height);

                              canvas.toBlob(
                                    (blob) => {
                                          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                                                type: 'image/jpeg',
                                                lastModified: Date.now()
                                          });
                                          resolve(compressed);
                                    },
                                    'image/jpeg',
                                    0.6
                              );
                        };
                        img.src = e.target.result;
                  };
                  reader.readAsDataURL(file);
            });
      };

      const handleSend = async (e) => {
            if (e) e.preventDefault();
            if (!canPost) return;

            if ((!newMessage.trim() && !mediaFile) || (sending && !!mediaFile)) return;

            const msgText = newMessage.trim();
            const currentMedia = mediaFile;

            setNewMessage('');
            setMediaFile(null);
            setMediaPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

            const currentPreview = mediaPreview;
            const currentReplyTarget = replyingTo;
            setReplyingTo(null);

            const tempId = 'temp_' + Date.now();
            const optimisticMsg = {
                  _id: tempId,
                  sender: user?._id || user,
                  text: msgText,
                  media: currentPreview ? { url: currentPreview.url, type: currentPreview.type } : null,
                  replyTo: currentReplyTarget,
                  createdAt: new Date().toISOString(),
                  _sending: true
            };

            setMessages(prev => [...prev, optimisticMsg]);
            playSound('send');

            if (currentMedia) setSending(true);
            try {
                  let res;
                  if (currentMedia) {
                        const fileToSend = await compressImage(currentMedia);
                        const formData = new FormData();
                        formData.append('media', fileToSend);
                        if (msgText) formData.append('text', msgText);
                        if (currentReplyTarget) formData.append('replyTo', currentReplyTarget._id);

                        res = await fetch(`${API_URL}/messages/group/${groupId}`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${token}` },
                              body: formData
                        });
                  } else {
                        const payload = { text: msgText };
                        if (currentReplyTarget) payload.replyTo = currentReplyTarget._id;

                        res = await fetch(`${API_URL}/messages/group/${groupId}`, {
                              method: 'POST',
                              headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                              },
                              body: JSON.stringify(payload)
                        });
                  }
                  const data = await res.json();
                  if (data.success) {
                        const realMsgId = data.data.message._id?.toString();
                        sentMsgIds.current.add(realMsgId);

                        setMessages(prev => {
                              const alreadyHasReal = prev.some(m => m._id?.toString() === realMsgId);
                              if (alreadyHasReal) {
                                    return prev.filter(m => m._id !== tempId);
                              } else {
                                    return prev.map(m => m._id === tempId ? data.data.message : m);
                              }
                        });
                  } else {
                        setMessages(prev => prev.filter(m => m._id !== tempId));
                        alert(data.message);
                  }
            } catch (err) {
                  console.error('Failed to send message:', err);
                  setMessages(prev => prev.map(m => m._id === tempId ? { ...m, _failed: true, _sending: false } : m));
            }
            setSending(false);
      };

      const handleEdit = async (messageId) => {
            if (!editText.trim()) return;
            try {
                  const res = await fetch(`${API_URL}/messages/edit/${messageId}`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ text: editText.trim() })
                  });
                  const data = await res.json();
                  if (data.success) {
                        setMessages(prev => prev.map(m =>
                              m._id === messageId ? { ...m, text: editText.trim(), edited: true } : m
                        ));
                        setEditingId(null);
                        setEditText('');
                  } else {
                        alert(data.message);
                  }
            } catch (err) {
                  console.error('Failed to edit message:', err);
            }
      };

      const handleDelete = async (messageId, type = 'me') => {
            if (!window.confirm(`Delete this message for ${type === 'everyone' ? 'everyone' : 'me'}?`)) return;

            // Optimistic UI
            setMessages(prev => {
                  if (type === 'everyone') {
                        return prev.map(m => m._id === messageId ? { ...m, deletedForEveryone: true, text: '', media: null } : m);
                  } else {
                        return prev.filter(m => m._id !== messageId);
                  }
            });
            setActiveMenu(null);

            try {
                  const res = await fetch(`${API_URL}/messages/delete/${messageId}?type=${type}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (!data.success) {
                        console.error('Failed to delete:', data.message);
                        fetchGroupMessages();
                  }
            } catch (err) {
                  console.error('Failed to delete message:', err);
                  fetchGroupMessages();
            }
      };

      const handleReact = async (messageId, emoji) => {
            setMessages(prev => {
                  return prev.map(m => {
                        if (m._id === messageId) {
                               const reactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
                               const existingIdx = reactions.findIndex(r => r.emoji === emoji && (r.user?._id || r.user) === (user?._id || user?.id));
                               if (existingIdx > -1) {
                                     reactions.splice(existingIdx, 1);
                               } else {
                                     reactions.push({ emoji, user: { _id: user?._id || user?.id, username: user?.username } });
                               }
                               return { ...m, reactions };
                        }
                        return m;
                  });
            });
            setActiveMenu(null);

            try {
                  const res = await fetch(`${API_URL}/messages/react/${messageId}`, {
                        method: 'PUT',
                        headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ emoji })
                  });
                  const data = await res.json();
                  if (data.success) {
                        setMessages(prev => prev.map(m => m._id === messageId ? data.data.message : m));
                  }
            } catch (err) {
                  console.error('Failed to react:', err);
            }
      };
      const handleClearChat = async () => {
            if (!window.confirm('Are you sure you want to clear all messages in this group?')) return;
            try {
                  const res = await fetch(`${API_URL}/messages/clear/${groupId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setMessages([]);
                        setActiveMenu(null);
                  }
            } catch (err) {
                  console.error('Failed to clear chat:', err);
            }
      };

      const handleDeleteGroup = async () => {
            const type = groupInfo?.isChannel ? 'Channel' : 'Group';
            if (!window.confirm(`Are you sure you want to DELETE this ${type}? All messages and participants will be removed. This cannot be undone.`)) return;
            
            try {
                  const res = await fetch(`${API_URL}/messages/group/${groupId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        localStorage.removeItem(`zuno_group_chat_cache_${groupId}`);
                        localStorage.removeItem(`zuno_group_info_cache_${groupId}`);
                        navigate('/messages');
                        window.location.reload(); // Refresh to update conversation list
                  } else {
                        alert(data.message || `Failed to delete ${type}`);
                  }
            } catch (err) {
                  console.error(`Failed to delete ${type}`, err);
                  alert(`An error occurred while deleting the ${type.toLowerCase()}`);
            }
      };

      const handleDownloadMedia = async (url, type) => {
            try {
                  const res = await fetch(url);
                  const blob = await res.blob();
                  const objectUrl = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = objectUrl;
                  const extension = type === 'video' ? 'mp4' : 'jpg';
                  a.download = `zuno_media_${Date.now()}.${extension}`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(objectUrl);
                  setActiveMenu(null);
            } catch (err) {
                  console.error('Failed to download media:', err);
                  window.open(url, '_blank');
                  setActiveMenu(null);
            }
      };

      const startEditing = (msg) => {
            setEditingId(msg._id);
            setEditText(msg.text);
            setActiveMenu(null);
      };

      const toggleMenu = (e, messageId) => {
            e.stopPropagation();
            setActiveMenu(prev => prev === messageId ? null : messageId);
      };

      const handleEmojiClick = (emoji) => {
            setNewMessage(prev => prev + emoji);
      };

      const handleTyping = (e) => {
            setNewMessage(e.target.value);
      };

      const handleMediaSelect = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 25 * 1024 * 1024) {
                  alert('File must be less than 25MB');
                  return;
            }

            const reader = new FileReader();
            reader.onloadend = () => setMediaPreview({ url: reader.result, type: file.type.startsWith('video') ? 'video' : 'image' });
            reader.readAsDataURL(file);
            setMediaFile(file);
      };

      const cancelMedia = () => {
            setMediaFile(null);
            setMediaPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
      };

      const formatTime = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      };

      const formatDateSeparator = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';

            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));

            if (days === 0) return 'Today';
            if (days === 1) return 'Yesterday';
            return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
      };

      const shouldShowDateSeparator = (msg, index) => {
            if (index === 0) return true;
            if (!msg.createdAt || !messages[index - 1].createdAt) return false;

            const prev = new Date(messages[index - 1].createdAt).toDateString();
            const curr = new Date(msg.createdAt).toDateString();
            return prev !== curr;
      };

      return (
            <div className="chat-page">
                  {/* Chat Header */}
                  <div className="chat-header">
                        <button onClick={() => navigate('/messages')} className="chat-back-btn">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                              </svg>
                        </button>
                        <div className="chat-user-info" style={{ flex: 1, cursor: 'pointer' }} onClick={() => setShowGroupInfo(true)}>
                              <div className="msg-avatar msg-avatar-sm">
                                    <UserAvatar src={groupInfo?.groupAvatar} name={groupInfo?.groupName} size={38} />
                              </div>
                              <div>
                                    <div className="font-semibold">{groupInfo?.groupName || ''}</div>
                                    <div className="text-xs text-muted">
                                          {groupInfo?.isChannel ? 'Broadcast Channel' : `${groupInfo?.participants?.length || 0} participants`}
                                    </div>
                              </div>
                        </div>
                        <div className="chat-call-buttons" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {!groupInfo?.isChannel && (
                                    <>
                                          <button onClick={() => initiateGroupCall('voice')} className="chat-action-btn" title="Voice Call">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                                </svg>
                                          </button>
                                          <button onClick={() => initiateGroupCall('video')} className="chat-action-btn" title="Video Call">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                                                </svg>
                                          </button>
                                    </>
                              )}
                              <div style={{ position: 'relative' }}>
                                    <button
                                          className="chat-call-btn"
                                          onClick={(e) => toggleMenu(e, 'header-menu')}
                                          title="More Options"
                                          style={{ marginLeft: '4px' }}
                                    >
                                          ⋮
                                    </button>

                                    {activeMenu === 'header-menu' && (
                                          <div className="chat-msg-menu" style={{ right: 0, top: '100%', minWidth: '150px' }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                      onClick={() => { setActiveMenu(null); setShowCustomizeModal(true); }}
                                                      className="chat-msg-menu-item"
                                                >
                                                      🎨 Customize Chat
                                                </button>
                                                {isAdmin && (
                                                      <button
                                                            onClick={() => { setActiveMenu(null); handleClearChat(); }}
                                                            className="chat-msg-menu-item delete"
                                                      >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z" /></svg>
                                                            Clear Chat
                                                      </button>
                                                )}
                                                {isAdmin && (
                                                      <button
                                                            onClick={() => { setActiveMenu(null); handleDeleteGroup(); }}
                                                            className="chat-msg-menu-item delete"
                                                            style={{ color: '#ff4444' }}
                                                      >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                                                            {groupInfo?.isChannel ? 'Delete Channel' : 'Delete Group'}
                                                      </button>
                                                )}
                                          </div>
                                    )}
                              </div>
                        </div>
                  </div>

                  {/* Pinned Message Bar */}
                  {pinnedMessage && (
                        <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                    <div style={{ color: 'var(--color-primary)' }}>📌</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-primary)' }}>Pinned Message</div>
                                          <div style={{ fontSize: '13px', color: 'var(--text-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {pinnedMessage.text || (pinnedMessage.media ? 'Media attached' : '')}
                                          </div>
                                    </div>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); setPinnedMessage(null); }} className="btn btn-ghost" style={{ padding: '4px' }}>✕</button>
                        </div>
                  )}

                  {/* Messages Area */}
                  <div 
                        className="chat-messages" 
                        ref={chatAreaRef}
                        onScroll={handleScroll}
                        style={
                              chatCustomization.bgImage ? {
                                    backgroundImage: `url(${chatCustomization.bgImage})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    backgroundAttachment: 'fixed'
                              } : {}
                        }
                  >
                        {loadingMore && <div style={{ textAlign: 'center', padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Loading past messages...</div>}
                        {loading ? (
                              <div className="empty-state"></div>
                        ) : messages.length > 0 ? (
                              messages.map((msg, index) => {
                                    const senderId = (msg.sender?._id || msg.sender || '').toString();
                                    const isMine = senderId === (user?._id || user?.id).toString();

                                    return (
                                          <div key={msg._id}>
                                                {shouldShowDateSeparator(msg, index) && (
                                                      <div className="chat-date-separator">
                                                            <span>{formatDateSeparator(msg.createdAt)}</span>
                                                      </div>
                                                )}
                                                <div className={`chat-bubble-wrapper ${isMine ? 'sent' : 'received'}`} style={{ marginBottom: (msg.reactions && msg.reactions.length > 0) ? '18px' : '2px' }}>
                                                      {!isMine && (
                                                            <div className="msg-avatar msg-avatar-xs" style={{ marginRight: '8px', alignSelf: 'flex-end' }}>
                                                                  <UserAvatar user={msg.sender} size={24} />
                                                            </div>
                                                      )}
                                                      <div
                                                            className={`chat-bubble ${isMine ? 'sent' : 'received'}`}
                                                            style={{
                                                                  position: 'relative',
                                                                  zIndex: (msg.reactions && msg.reactions.length > 0) ? 1 : 'auto',
                                                                  ...(isMine && chatCustomization.themeColor !== '#6366f1' ? {
                                                                        background: chatCustomization.themeColor,
                                                                        borderColor: chatCustomization.themeColor
                                                                  } : {})
                                                            }}
                                                      >
                                                            {editingId === msg._id ? (
                                                                  <div className="chat-edit-form">
                                                                        <input
                                                                              type="text"
                                                                              value={editText}
                                                                              onChange={(e) => setEditText(e.target.value)}
                                                                              className="chat-edit-input"
                                                                              autoFocus
                                                                              onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') handleEdit(msg._id);
                                                                                    if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                                                                              }}
                                                                        />
                                                                        <div className="chat-edit-actions">
                                                                              <button onClick={() => handleEdit(msg._id)} className="chat-edit-save">✓</button>
                                                                              <button onClick={() => { setEditingId(null); setEditText(''); }} className="chat-edit-cancel">✕</button>
                                                                        </div>
                                                                  </div>
                                                            ) : msg.deletedForEveryone ? (
                                                                  <>
                                                                        {!isMine && (
                                                                              <div style={{ fontWeight: '600', fontSize: '0.75rem', marginBottom: '4px', opacity: 0.8 }}>
                                                                                    {msg.sender?.displayName || msg.sender?.username || 'User'}
                                                                              </div>
                                                                        )}
                                                                        <p className="chat-bubble-text" style={{ fontStyle: 'italic', opacity: 0.7, color: isMine ? '#e0e7ff' : 'inherit', padding: '4px' }}>
                                                                              🚫 This message was deleted
                                                                        </p>
                                                                  </>
                                                            ) : (
                                                                  <>
                                                                        {!isMine && (
                                                                              <div style={{ fontWeight: '600', fontSize: '0.75rem', marginBottom: '4px', opacity: 0.8 }}>
                                                                                    {msg.sender?.displayName || msg.sender?.username || 'User'}
                                                                              </div>
                                                                        )}
                                                                        {msg.replyTo && (
                                                                              <div className="chat-reply-quote">
                                                                                    <div className="chat-reply-quote-sender" style={{ fontWeight: 'bold', fontSize: '0.8rem', color: isMine ? '#e0e7ff' : '#4f46e5' }}>
                                                                                          {msg.replyTo.sender?.displayName || msg.replyTo.sender?.username || 'User'}
                                                                                    </div>
                                                                                    <div className="chat-reply-quote-text" style={{ fontSize: '0.85rem', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                          {msg.replyTo.deletedForEveryone ? '🚫 Deleted message' : (msg.replyTo.text || 'Embedded Media')}
                                                                                    </div>
                                                                              </div>
                                                                        )}

                                                                        {msg.media?.url && (
                                                                              <div className="chat-media">
                                                                                    {msg.media.type === 'video' ? (
                                                                                          <video src={msg.media.url} controls className="chat-media-content" />
                                                                                    ) : (
                                                                                          <img src={msg.media.url} alt="Shared media" className="chat-media-content" onClick={() => window.open(msg.media.url, '_blank')} />
                                                                                    )}
                                                                              </div>
                                                                        )}
                                                                        {msg.text && <p className="chat-bubble-text">{msg.text}</p>}
                                                                        <div className="chat-bubble-meta">
                                                                              {msg.edited && <span className="chat-edited-label" style={{ fontSize: '0.7rem', opacity: 0.6 }}>edited</span>}
                                                                              <span className="chat-bubble-time" style={{ fontSize: '0.7rem', opacity: 0.7 }}>{formatTime(msg.createdAt)}</span>
                                                                        </div>

                                                                        {msg.reactions && msg.reactions.length > 0 && (
                                                                              <div className="chat-bubble-reactions" style={{ zIndex: 1, display: 'flex', gap: '2px', position: 'absolute', bottom: '-12px', right: isMine ? '0' : 'auto', left: isMine ? 'auto' : '0', background: 'var(--bg-card)', padding: '2px 4px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.8rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                                                                    {msg.reactions.map((r, i) => (
                                                                                          <span key={i} title={r.user?.username || 'User'}>{r.emoji}</span>
                                                                                    ))}
                                                                              </div>
                                                                        )}
                                                                  </>
                                                            )}

                                                            {editingId !== msg._id && !msg.deletedForEveryone && (
                                                                  <button
                                                                        className="chat-msg-menu-btn"
                                                                        onClick={(e) => toggleMenu(e, msg._id)}
                                                                        title="Message options"
                                                                  >
                                                                        ⋮
                                                                  </button>
                                                            )}

                                                            {activeMenu === msg._id && (
                                                                  <div className="chat-msg-menu" style={{ [isMine ? 'right' : 'left']: 0 }} onClick={(e) => e.stopPropagation()}>
                                                                        <div className="chat-msg-menu-reactions" style={{ display: 'flex', gap: '8px', padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
                                                                              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                                                                    <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReact(msg._id, emoji); }} style={{ fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer' }}>{emoji}</button>
                                                                              ))}
                                                                        </div>
                                                                        <button onClick={() => { setReplyingTo(msg); setActiveMenu(null); }} className="chat-msg-menu-item">
                                                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" /></svg>
                                                                              Reply
                                                                        </button>
                                                                        <button onClick={() => { setReplyingTo(msg); setActiveMenu(null); }} className="chat-msg-menu-item">
                                                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" /></svg>
                                                                              Reply
                                                                        </button>
                                                                        <button onClick={() => { handlePinMessage(msg); }} className="chat-msg-menu-item">
                                                                              📌 Pin
                                                                        </button>
                                                                        {msg.text && (
                                                                              <button onClick={() => { navigator.clipboard?.writeText(msg.text).catch(() => { }); setActiveMenu(null); }} className="chat-msg-menu-item">
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>
                                                                                    Copy
                                                                              </button>
                                                                        )}
                                                                        {msg.media?.url && (
                                                                              <button
                                                                                    onClick={() => handleDownloadMedia(msg.media.url, msg.media.type)}
                                                                                    className="chat-msg-menu-item"
                                                                              >
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
                                                                                    Download
                                                                              </button>
                                                                        )}
                                                                        {isMine && (
                                                                              <button onClick={() => startEditing(msg)} className="chat-msg-menu-item">
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                                                                                    Edit
                                                                              </button>
                                                                        )}
                                                                        {isMine && !msg.deletedForEveryone && (
                                                                              <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(msg._id, 'everyone'); }}
                                                                                    className="chat-msg-menu-item delete"
                                                                              >
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                                                                                    Delete for everyone
                                                                              </button>
                                                                        )}
                                                                        {isAdmin && !isMine && !msg.deletedForEveryone && (
                                                                              <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(msg._id, 'everyone'); }}
                                                                                    className="chat-msg-menu-item delete"
                                                                              >
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                                                                                    Delete for everyone
                                                                              </button>
                                                                        )}
                                                                        <button
                                                                              onClick={(e) => { e.stopPropagation(); handleDelete(msg._id, 'me'); }}
                                                                              className="chat-msg-menu-item delete"
                                                                        >
                                                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                                                                              Delete for me
                                                                        </button>
                                                                  </div>
                                                            )}
                                                      </div>
                                                </div>
                                          </div>
                                    );
                              })
                        ) : (
                              <div className="empty-state" style={{ padding: '3rem 1rem' }}>
                                    <div className="empty-state-icon">👋</div>
                                    <h3 className="text-lg font-semibold mb-sm">Welcome to {groupInfo?.groupName}</h3>
                                    <p className="text-muted">
                                          {groupInfo?.isChannel ? 'Only admins can post here.' : 'Start a conversation with the group!'}
                                    </p>
                              </div>
                        )}
                        <div ref={messagesEndRef} />
                  </div>

                  {/* Media Preview */}
                  {mediaPreview && (
                        <div className="chat-media-preview">
                              <div className="chat-media-preview-inner">
                                    {mediaPreview.type === 'video' ? (
                                          <video src={mediaPreview.url} className="chat-media-preview-thumb" muted />
                                    ) : (
                                          <img src={mediaPreview.url} alt="Preview" className="chat-media-preview-thumb" />
                                    )}
                                    <span className="text-sm">{mediaFile?.name}</span>
                                    <button onClick={cancelMedia} className="chat-media-preview-close">✕</button>
                              </div>
                        </div>
                  )}

                  {/* Emoji Picker */}
                  {showEmoji && (
                        <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
                              <div className="emoji-grid">
                                    {Object.values(EMOJI_DATA).flat().map((emoji, i) => (
                                          <button key={i} className="emoji-btn" onClick={() => handleEmojiClick(emoji)}>
                                                {emoji}
                                          </button>
                                    ))}
                              </div>
                        </div>
                  )}

                  {/* Message Input Area */}
                  {!canPost ? (
                        <div className="chat-input-area" style={{ zIndex: 10, padding: '16px', textAlign: 'center', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
                              <p className="text-muted">Only admins can send messages to this channel.</p>
                        </div>
                  ) : (
                        <form className="chat-input-area" onSubmit={handleSend} style={{ zIndex: 10 }}>
                              <div className="chat-input-actions">
                                    <div className="emoji-picker-container" onClick={(e) => e.stopPropagation()}>
                                          <button type="button" className="chat-action-btn" onClick={() => setShowEmoji(!showEmoji)} title="Emojis">
                                                😊
                                          </button>
                                    </div>
                                    <button type="button" className="chat-action-btn" onClick={() => fileInputRef.current?.click()} title="Send Photo/Video">
                                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                                          </svg>
                                    </button>
                                    <input
                                          ref={fileInputRef}
                                          type="file"
                                          accept="image/*,video/*"
                                          onChange={handleMediaSelect}
                                          style={{ display: 'none' }}
                                    />
                              </div>

                              <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                    {mediaPreview && (
                                          <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px', zIndex: 20 }}>
                                                <div className="chat-media-preview" style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
                                                      {mediaPreview.type === 'video' ? (
                                                            <video src={mediaPreview.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                      ) : (
                                                            <img src={mediaPreview.url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                      )}
                                                      <button type="button" onClick={cancelMedia} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✕</button>
                                                </div>
                                          </div>
                                    )}

                                    {replyingTo && (
                                          <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '8px', zIndex: 15, background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: '8px', borderLeft: '3px solid var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-sm)' }}>
                                                <div className="flex-1 min-w-0">
                                                      <div className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                                                            Replying to {replyingTo.sender?.displayName || replyingTo.sender?.username}
                                                      </div>
                                                      <div className="text-xs truncate text-muted">{replyingTo.text || 'Media'}</div>
                                                </div>
                                                <button type="button" onClick={() => setReplyingTo(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                                          </div>
                                    )}

                                    <textarea
                                          className="chat-input"
                                          placeholder="Type a message..."
                                          value={newMessage}
                                          onChange={handleTyping}
                                          onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                      e.preventDefault();
                                                      handleSend(e);
                                                }
                                          }}
                                          rows={1}
                                          style={{ width: '100%', border: 'none', background: 'transparent', padding: '8px', resize: 'none', fontSize: '0.95rem' }}
                                    />
                              </div>

                              <button
                                    type="submit"
                                    className="chat-send-btn"
                                    disabled={(!newMessage.trim() && !mediaFile) || (sending && mediaFile)}
                                    style={{ background: chatCustomization.themeColor || 'var(--color-primary)', opacity: (!newMessage.trim() && !mediaFile) ? 0.6 : 1 }}
                              >
                                    {(sending && mediaFile) ? (
                                          <span style={{ fontSize: '18px' }}>⏳</span>
                                    ) : (
                                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                          </svg>
                                    )}
                              </button>
                        </form>
                  )}

                  {/* Group Info Modal */}
                  {showGroupInfo && (
                        <div className="modal-overlay" onClick={() => setShowGroupInfo(false)} style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                              <div className="card modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                                    <div className="flex items-center justify-between mb-lg" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                                          <h3 className="text-lg font-bold">{groupInfo?.isChannel ? 'Channel Info' : 'Group Info'}</h3>
                                          <button onClick={() => setShowGroupInfo(false)} className="btn btn-ghost" style={{ padding: '4px 8px' }}>✕</button>
                                    </div>

                                    <div style={{ padding: '16px 0', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
                                          <div style={{ position: 'relative', display: 'inline-block', margin: '0 auto 12px' }}>
                                                <div 
                                                      onClick={() => editingGroupInfo ? groupPhotoInputRef.current?.click() : null}
                                                      style={{ cursor: editingGroupInfo ? 'pointer' : 'default', opacity: editingGroupInfo ? 0.8 : 1 }}
                                                >
                                                      <UserAvatar src={editGroupPreview || groupInfo?.groupAvatar} name={groupInfo?.groupName} size={80} />
                                                </div>
                                                {editingGroupInfo && (
                                                      <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--color-primary)', borderRadius: '50%', padding: '4px', cursor: 'pointer' }} onClick={() => groupPhotoInputRef.current?.click()}>
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M4 4h3l2-2h6l2 2h3c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><circle cx="12" cy="12" r="3.2"/></svg>
                                                      </div>
                                                )}
                                                <input 
                                                      type="file" 
                                                      ref={groupPhotoInputRef} 
                                                      style={{ display: 'none' }} 
                                                      accept="image/*"
                                                      onChange={(e) => {
                                                            const file = e.target.files[0];
                                                            if (file) {
                                                                  setEditGroupFile(file);
                                                                  setEditGroupPreview(URL.createObjectURL(file));
                                                            }
                                                      }}
                                                />
                                          </div>
                                          {editingGroupInfo ? (
                                                <div className="flex flex-col items-center justify-center gap-2 mb-2">
                                                      <input
                                                            value={editGroupName}
                                                            onChange={(e) => setEditGroupName(e.target.value)}
                                                            className="input"
                                                            style={{ maxWidth: '200px', textAlign: 'center' }}
                                                      />
                                                      <button className="btn btn-primary btn-sm mt-2" onClick={handleUpdateGroupInfo}>Save Changes</button>
                                                </div>
                                          ) : (
                                                <div className="flex items-center justify-center gap-2 mb-2">
                                                      <h2 className="text-xl font-bold">{groupInfo?.groupName}</h2>
                                                      {isAdmin && (
                                                            <button className="btn btn-ghost btn-icon" onClick={() => { setEditGroupName(groupInfo?.groupName || ''); setEditGroupPreview(null); setEditGroupFile(null); setEditingGroupInfo(true); }}>✎</button>
                                                      )}
                                                </div>
                                          )}
                                          <p className="text-muted text-sm">{groupInfo?.participants?.length || 0} participants</p>
                                    </div>

                                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
                                          <div className="flex items-center justify-between mb-sm">
                                                <h4 className="font-semibold text-muted">Participants</h4>
                                                <button 
                                                      className="btn btn-secondary btn-sm" 
                                                      onClick={() => { setShowGroupInfo(false); setShowAddParticipants(true); }}
                                                >
                                                      + Add
                                                </button>
                                          </div>
                                          
                                          <div className="participants-list">
                                                {groupInfo?.participants?.map(p => (
                                                      <div key={p._id || p} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                                                            <div className="flex items-center gap-3">
                                                                  <UserAvatar user={p} size={36} />
                                                                  <div>
                                                                        <div className="font-semibold" style={{ fontSize: '0.95rem' }}>{p.displayName || p.username || 'User'}</div>
                                                                        <div className="text-xs text-muted">
                                                                              {p._id === groupInfo.groupAdmin ? 'Admin' : 'Member'}
                                                                        </div>
                                                                  </div>
                                                            </div>
                                                            {isAdmin && p._id !== user?._id && p._id !== groupInfo.groupAdmin && (
                                                                  <button 
                                                                        className="btn btn-ghost text-red-500 text-xs" 
                                                                        onClick={() => handleRemoveParticipant(p._id)}
                                                                        style={{ padding: '4px 8px' }}
                                                                  >
                                                                        Remove
                                                                  </button>
                                                            )}
                                                      </div>
                                                ))}
                                          </div>
                                    </div>

                                    <div className="pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                                          <button 
                                                className="btn btn-block" 
                                                onClick={handleLeaveGroup}
                                                style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                                          >
                                                Leave {groupInfo?.isChannel ? 'Channel' : 'Group'}
                                          </button>
                                    </div>
                              </div>
                        </div>
                  )}

                  {/* Add Participants Modal */}
                  {showAddParticipants && (
                        <div className="modal-overlay" onClick={() => { setShowAddParticipants(false); setShowGroupInfo(true); }} style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                              <div className="card modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                                    <div className="flex items-center justify-between mb-lg" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                                          <h3 className="text-lg font-bold">Add Participants</h3>
                                          <button onClick={() => { setShowAddParticipants(false); setShowGroupInfo(true); }} className="btn btn-ghost" style={{ padding: '4px 8px' }}>✕</button>
                                    </div>

                                    <div className="mb-4">
                                          <input
                                                type="text"
                                                className="input"
                                                placeholder="Search users..."
                                                value={addSearchQuery}
                                                onChange={(e) => handleAddParticipantSearch(e.target.value)}
                                                style={{ width: '100%' }}
                                                autoFocus
                                          />
                                    </div>

                                    <div style={{ flex: 1, overflowY: 'auto', minHeight: '200px' }}>
                                          {selectedUsers.length > 0 && (
                                                <div className="mb-3 flex gap-2 flex-wrap pb-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                      {selectedUsers.map(u => (
                                                            <div key={u._id} className="chip bg-primary/10 text-primary flex items-center gap-1" style={{ padding: '4px 8px', borderRadius: '16px', fontSize: '0.8rem' }}>
                                                                  {u.username}
                                                                  <button onClick={() => setSelectedUsers(prev => prev.filter(user => user._id !== u._id))} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                                                            </div>
                                                      ))}
                                                </div>
                                          )}

                                          {addSearchResults.map(u => (
                                                <div 
                                                      key={u._id} 
                                                      className="flex items-center justify-between py-2 border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                                                      style={{ borderColor: 'var(--border-color)', padding: '8px' }}
                                                      onClick={() => {
                                                            if (selectedUsers.some(su => su._id === u._id)) {
                                                                  setSelectedUsers(prev => prev.filter(su => su._id !== u._id));
                                                            } else {
                                                                  setSelectedUsers(prev => [...prev, u]);
                                                            }
                                                      }}
                                                >
                                                      <div className="flex items-center gap-3">
                                                            <UserAvatar user={u} size={36} />
                                                            <div>
                                                                  <div className="font-semibold">{u.displayName || u.username}</div>
                                                                  <div className="text-xs text-muted">@{u.username}</div>
                                                            </div>
                                                      </div>
                                                      <div style={{ 
                                                            width: '20px', height: '20px', borderRadius: '50%', 
                                                            border: '2px solid var(--color-primary)',
                                                            background: selectedUsers.some(su => su._id === u._id) ? 'var(--color-primary)' : 'transparent',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            color: 'white'
                                                      }}>
                                                            {selectedUsers.some(su => su._id === u._id) && '✓'}
                                                      </div>
                                                </div>
                                          ))}
                                          
                                          {addSearchQuery && addSearchResults.length === 0 && (
                                                <div className="text-center text-muted p-4">No users found</div>
                                          )}
                                    </div>

                                    <div className="pt-3 flex gap-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                                          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowAddParticipants(false); setShowGroupInfo(true); }}>Cancel</button>
                                          <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmAddParticipants} disabled={selectedUsers.length === 0}>
                                                Add ({selectedUsers.length})
                                          </button>
                                    </div>
                              </div>
                        </div>
                  )}

                  {/* Customize Chat Modal */}
                  {showCustomizeModal && (
                        <div className="modal-overlay" onClick={() => setShowCustomizeModal(false)} style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                              <div className="card modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto' }}>
                                    <div className="flex items-center justify-between mb-lg">
                                          <h3 className="text-lg font-bold">🎨 Customize Chat</h3>
                                          <button onClick={() => setShowCustomizeModal(false)} className="btn btn-ghost" style={{ padding: '4px 8px' }}>✕</button>
                                    </div>

                                    <div className="mb-lg">
                                          <h4 className="font-semibold mb-sm">Theme Color</h4>
                                          <div className="flex gap-sm flex-wrap">
                                                {THEMES.map(theme => (
                                                      <div
                                                            key={theme.id}
                                                            onClick={() => saveCustomization({ ...chatCustomization, themeColor: theme.color })}
                                                            style={{
                                                                  width: '36px', height: '36px',
                                                                  borderRadius: '50%',
                                                                  backgroundColor: theme.color,
                                                                  cursor: 'pointer',
                                                                  border: chatCustomization.themeColor === theme.color ? '3px solid white' : 'none',
                                                                  outline: chatCustomization.themeColor === theme.color ? `2px solid ${theme.color}` : 'none',
                                                                  boxShadow: 'var(--shadow-sm)'
                                                            }}
                                                      />
                                                ))}
                                          </div>
                                    </div>

                                    <div className="mb-lg">
                                          <h4 className="font-semibold mb-sm">Background Image</h4>
                                          {chatCustomization.bgImage ? (
                                                <div style={{ position: 'relative', height: '150px', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '8px' }}>
                                                      <img src={chatCustomization.bgImage} alt="Background Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                      <button
                                                            onClick={() => saveCustomization({ ...chatCustomization, bgImage: null })}
                                                            style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                      >✕</button>
                                                </div>
                                          ) : (
                                                <div
                                                      style={{ height: '100px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--bg-secondary)' }}
                                                      onClick={() => document.getElementById('chat-bg-upload').click()}
                                                >
                                                      <span className="text-muted">+ Add Wallpaper</span>
                                                </div>
                                          )}
                                          <input type="file" id="chat-bg-upload" accept="image/*" style={{ display: 'none' }} onChange={handleBgImageUpload} />
                                    </div>

                                    <div className="flex mt-xl">
                                          <button
                                                onClick={() => {
                                                      saveCustomization(defaultCustomization);
                                                }}
                                                className="btn btn-ghost text-red-500" style={{ flex: 1 }}
                                          >
                                                Reset to Default
                                          </button>
                                          <button onClick={() => setShowCustomizeModal(false)} className="btn btn-primary" style={{ flex: 1 }}>Done</button>
                                    </div>
                              </div>
                        </div>
                  )}
            </div>
      );
};

export default GroupChat;
