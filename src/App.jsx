import React, { useState, useEffect, useRef } from 'react';
import CryptoJS from 'crypto-js';
import { encryptMessage, decryptMessage } from './utils/crypto';
import { 
  Shield, Send, Trash2, Moon, Sun, Eye, Search, 
  MoreVertical, Volume2, VolumeX, Ban, Edit3, MapPin, Phone, Globe
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, off, set, remove, onDisconnect, onChildAdded, onChildRemoved } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCK-n-_VqT3tggUy_4WyjIg9h3U2xiFgWI",
  authDomain: "e2e-chat-hub.firebaseapp.com",
  databaseURL: "https://e2e-chat-hub-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "e2e-chat-hub",
  storageBucket: "e2e-chat-hub.firebasestorage.app",
  messagingSenderId: "913781539766",
  appId: "1:913781539766:web:9f0eccb91971f28610b717"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const AVATARS = Array.from({ length: 20 }, (_, i) => `/assets/avatar-${i + 1}.jpg`);
const BACKGROUNDS = Array.from({ length: 10 }, (_, i) => `/assets/bg-${i + 1}.jpg`);
const SOUNDS = Array.from({ length: 5 }, (_, i) => `/assets/notification-${i + 1}.mp3`);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [messages, setMessages] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [theme, setTheme] = useState('light');
  const [chatBg, setChatBg] = useState(''); 
  const [msgBgColor, setMsgBgColor] = useState('#2563eb'); 
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [nickname, setNickname] = useState('');
  
  const [isMuted, setIsMuted] = useState(false);
  const [selectedSound, setSelectedSound] = useState(SOUNDS[0]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  
  const messagesEndRef = useRef(null);
  const roomDisconnectRef = useRef(null);
  const sessionRef = useRef(`ss-${Date.now()}-${Math.floor(Math.random()*10000)}`);
  const serverTimeOffsetRef = useRef(0);
  const presenceCountRef = useRef(0);
  const hasCleanedUpRef = useRef(false);

  const prefsRef = useRef({ isMuted, selectedSound, blockedUsers, nickname, username });
  useEffect(() => {
    prefsRef.current = { isMuted, selectedSound, blockedUsers, nickname, username };
  }, [isMuted, selectedSound, blockedUsers, nickname, username]);

  useEffect(() => {
    if (!isLoggedIn || !password) return;

    hasCleanedUpRef.current = false;
    const offsetRef = ref(db, ".info/serverTimeOffset");
    onValue(offsetRef, (snap) => { serverTimeOffsetRef.current = snap.val() || 0; });

    const roomId = CryptoJS.SHA256(password).toString();
    const mySessionId = sessionRef.current; 
    
    const roomMsgRef = ref(db, `rooms/${roomId}/messages`);
    const presenceRef = ref(db, `rooms/${roomId}/presence`);
    const myPresenceRef = ref(db, `rooms/${roomId}/presence/${mySessionId}`);

    // 1. Đẩy tên lên Firebase (Dùng sessionRef.current làm ID duy nhất)
    const myName = String(nickname || username || "Thành viên HUB");
    const myId = sessionRef.current; 
    
    set(myPresenceRef, myName);
    onDisconnect(myPresenceRef).remove();

    // 2. Lắng nghe người mới
    const unsubJoin = onChildAdded(presenceRef, (snap) => {
      const userVal = snap.val();
      const userId = snap.key;

      // CHỐT CHẶN: Chỉ hiện nếu ID người mới khác hoàn toàn ID của mình
      if (userId !== myId) {
        // Kiểm tra xem có phải dữ liệu cũ (true) không, nếu là tên thật mới hiện
        const displayName = (userVal === true || userVal === "true") ? "Người dùng ẩn danh" : userVal;
        
        setSystemLogs(prev => [...prev, { 
          id: `join-${userId}-${Date.now()}`, 
          type: 'system', 
          timestamp: Date.now(), 
          text: `👋 ${displayName} vừa tham gia phòng bí mật.` 
        }]);
      }
    });

    // 3. Lắng nghe người rời đi
    const unsubLeave = onChildRemoved(presenceRef, (snap) => {
      const userVal = snap.val();
      if (snap.key !== myId) {
        const displayName = (userVal === true || userVal === "true") ? "Người dùng ẩn danh" : userVal;
        setSystemLogs(prev => [...prev, { 
          id: `leave-${snap.key}-${Date.now()}`, 
          type: 'system', 
          timestamp: Date.now(), 
          text: `🚪 ${displayName} đã rời đi.` 
        }]);
      }
    });

    const unsubPresence = onValue(presenceRef, (snap) => {
      const currentCount = snap.size; 
      if (currentCount <= 1) {
        roomDisconnectRef.current.remove(); 
      } else {
        roomDisconnectRef.current.cancel(); 
      }
    });

    onValue(roomMsgRef, (snapshot) => {
      const { blockedUsers, nickname: currentNick, username: currentUn, isMuted, selectedSound } = prefsRef.current;
      const currentMyId = currentNick || currentUn;
      const loadedMessages = [];

      snapshot.forEach((childSnapshot) => {
        const key = childSnapshot.key;
        const msgData = childSnapshot.val();

        if (msgData && !blockedUsers.includes(msgData.sender)) {
          try {
            const decryptedText = decryptMessage(msgData.text, password);
            let parsedTime = (typeof msgData.timestamp === 'number') ? msgData.timestamp : Date.now(); 

            loadedMessages.push({
              id: key,
              sender: msgData.sender,
              senderAvatar: msgData.avatar,
              text: decryptedText,
              timestamp: parsedTime,
              isMine: msgData.sender === currentMyId || msgData.sender === currentUn
            });
          } catch (error) {
             // Bỏ qua tin nhắn không giải mã được
          }
        }
      });

      setMessages(loadedMessages);
      const lastMsg = loadedMessages[loadedMessages.length - 1];
      if (lastMsg && !lastMsg.isMine && !isMuted) {
         new Audio(selectedSound).play().catch(() => {});
      }
    });

    const performCleanup = () => {
      if (hasCleanedUpRef.current) return;
      hasCleanedUpRef.current = true;
      remove(myPresenceRef);
      if (presenceCountRef.current <= 1) remove(roomMsgRef);
      off(roomMsgRef);
      off(presenceRef);
      if (roomDisconnectRef.current) roomDisconnectRef.current.cancel();
    };

    window.addEventListener('beforeunload', performCleanup);
    return () => {
      window.removeEventListener('beforeunload', performCleanup);
      performCleanup(); 
    };
  }, [isLoggedIn, password]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, systemLogs]);

  // FIX 3: Làm sạch dữ liệu đầu vào khi login
  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      const cleanName = username.trim();
      setUsername(cleanName);
      setNickname(cleanName);
      setIsLoggedIn(true);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const encryptedText = encryptMessage(inputMsg, password);
    const globalTimestamp = Date.now() + serverTimeOffsetRef.current;

    const msgPayload = {
      uid: sessionRef.current,
      sender: nickname || username,
      avatar: avatar,
      text: encryptedText,
      timestamp: globalTimestamp 
    };

    const roomId = CryptoJS.SHA256(password).toString();
    push(ref(db, `rooms/${roomId}/messages`), msgPayload);
    setInputMsg('');
  };

  const handleDeleteMessage = (id) => setMessages(messages.filter(msg => msg.id !== id));
  const handleClearChat = () => { if (window.confirm("Xóa bộ nhớ đệm hiển thị?")) setMessages([]); };
  const handleBlockUser = (senderName) => {
    if (senderName !== (nickname || username) && !blockedUsers.includes(senderName)) {
      if (window.confirm(`Chặn ID: ${senderName}?`)) setBlockedUsers(prev => [...prev, senderName]);
    }
  };

  const getThemeClass = () => {
    if (theme === 'dark') return 'bg-gray-900 text-gray-200 border-gray-700';
    if (theme === 'eyecare') return 'bg-[#f4ecd8] text-[#5c4b37] border-[#d1c6ab]';
    return 'bg-gray-50 text-gray-900 border-gray-200';
  };

  const filteredMessages = messages.filter(msg => msg.text.toLowerCase().includes(searchQuery.toLowerCase()));
  const displayMessages = [...filteredMessages, ...systemLogs].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
          <div className="flex justify-center mb-6">
            <img src="/assets/logo.png" alt="HUB Logo" className="w-24 h-24 object-contain" onError={(e) => { e.target.src = 'https://via.placeholder.com/100?text=HUB'; }} />
          </div>
          <h1 className="text-xl font-bold text-blue-900 mb-1">ĐẠI HỌC NGÂN HÀNG TP.HCM</h1>
          <p className="text-xs font-bold mb-8 text-blue-500 uppercase tracking-widest">Hệ thống nhắn tin nội bộ</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="Định danh người dùng" className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <input type="password" placeholder="Mật mã phòng chat" className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" className="w-full bg-blue-700 text-white py-3 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg">Bắt đầu phiên làm việc</button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-green-600 font-bold uppercase">
            <Shield size={14} /> Bảo mật đa tầng AES-256
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen overflow-hidden flex flex-col font-sans ${getThemeClass()}`}>
      <header className="p-3 border-b flex justify-between items-center bg-white/10 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <img src={avatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover" alt="avatar" />
          <div>
            <h2 className="font-bold text-sm flex items-center gap-2">
              {nickname || username}
              <Edit3 size={12} className="cursor-pointer opacity-50 hover:opacity-100" onClick={() => { const n = prompt("Tên mới:", nickname); if(n) setNickname(n); }} />
            </h2>
            <span className="text-[9px] text-green-500 flex items-center gap-1 font-bold italic"><Shield size={8} /> Kênh truyền an toàn</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search size={12} className="absolute left-3 top-2.5 opacity-40" />
            <input type="text" placeholder="Tìm tin nhắn..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-1.5 text-[11px] border rounded-full bg-white/50 w-32 focus:w-48 transition-all outline-none" />
          </div>
          <button onClick={() => setTheme('light')} className="p-1.5 hover:bg-gray-200/50 rounded-full"><Sun size={16} /></button>
          <button onClick={() => setTheme('dark')} className="p-1.5 hover:bg-gray-200/50 rounded-full"><Moon size={16} /></button>
          <button onClick={() => setTheme('eyecare')} className="p-1.5 hover:bg-gray-200/50 rounded-full"><Eye size={16} /></button>
          <div className="relative">
            <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 hover:bg-gray-200/50 rounded-full"><MoreVertical size={18} /></button>
            {showSettings && (
              <div className="absolute right-0 mt-2 w-64 bg-white text-gray-800 border shadow-2xl rounded-xl p-4 z-[100] text-xs">
                <p className="font-bold border-b pb-2 mb-3 text-blue-600">TÙY CHỈNH CÁ NHÂN</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center"><span>Màu tin nhắn:</span><input type="color" value={msgBgColor} onChange={(e) => setMsgBgColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-none" /></div>
                  <div className="flex justify-between items-center">
                    <span>Âm báo:</span>
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-1 rounded ${!isMuted ? 'text-green-600' : 'text-red-600'}`}>
                      {!isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                  </div>
                  <div className="max-h-24 overflow-y-auto grid grid-cols-5 gap-1 p-1 border rounded bg-gray-50">
                    {AVATARS.map((img, idx) => <img key={idx} src={img} onClick={() => setAvatar(img)} className={`w-full aspect-square object-cover rounded cursor-pointer border-2 ${avatar === img ? 'border-blue-500' : 'border-transparent'}`} alt="avt" />)}
                  </div>
                  <button onClick={handleClearChat} className="w-full py-2 text-red-600 font-bold border-t mt-2 flex items-center justify-center gap-2 hover:bg-red-50 rounded">
                    <Trash2 size={14} /> Xóa lịch sử tạm thời
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ 
          backgroundImage: chatBg, backgroundSize: 'cover', backgroundPosition: 'center',
          backgroundColor: theme === 'dark' ? '#111827' : (theme === 'eyecare' ? '#e8dfc8' : '#ffffff')
        }}
      >
        {displayMessages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="bg-black/5 dark:bg-white/5 text-[9px] px-3 py-1 rounded-full font-bold uppercase tracking-widest opacity-60">
                  {msg.text}
                </span>
              </div>
            );
          }
          return (
            <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'} group items-end gap-2 animate-fade-in-up`}>
              {!msg.isMine && <img src={msg.senderAvatar} className="w-8 h-8 rounded-full shadow-sm" alt="v" />}
              <div className={`flex flex-col max-w-[80%] ${msg.isMine ? 'items-end' : 'items-start'}`}>
                {!msg.isMine && <span className="text-[10px] font-bold mb-1 ml-1 opacity-50">{msg.sender}</span>}
                <div 
                  className="p-3 rounded-2xl text-sm shadow-sm relative group"
                  style={{ 
                    backgroundColor: msg.isMine ? msgBgColor : (theme === 'dark' ? '#374151' : '#ffffff'),
                    color: msg.isMine ? '#fff' : 'inherit',
                    borderRadius: msg.isMine ? '18px 18px 2px 18px' : '18px 18px 18px 2px'
                  }}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  <button 
                    onClick={() => handleDeleteMessage(msg.id)} 
                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 border-t bg-white/5 backdrop-blur-md">
        <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
          <input 
            type="text" value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} 
            placeholder="Gửi tin nhắn được mã hóa..." 
            className="flex-1 px-5 py-3 rounded-full border bg-white/80 focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-inner" 
          />
          <button type="submit" className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-transform active:scale-95 shadow-md">
            <Send size={18} />
          </button>
        </form>
        <div className="mt-4 flex justify-between items-center text-[9px] opacity-40 font-bold px-4">
           <span>HUB DATA SCIENCE - SECURE HUB v2.0</span>
           <span>AES-256 E2EE ACTIVE</span>
        </div>
      </footer>
    </div>
  );
}