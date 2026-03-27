import React, { useState, useEffect, useRef } from 'react';
import CryptoJS from 'crypto-js';
import { encryptMessage, decryptMessage } from './utils/crypto';
import { 
  Shield, Send, Trash2, Moon, Sun, Eye, Search, 
  MoreVertical, Volume2, VolumeX, Ban, Edit3, MapPin, Phone, Globe
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
// THÊM serverTimestamp VÀO ĐÂY NÈ TS
import { getDatabase, ref, push, onValue, off, set, remove, onDisconnect, onChildAdded, onChildRemoved, serverTimestamp } from 'firebase/database';

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

  const prefsRef = useRef({ isMuted, selectedSound, blockedUsers, nickname, username });
  useEffect(() => {
    prefsRef.current = { isMuted, selectedSound, blockedUsers, nickname, username };
  }, [isMuted, selectedSound, blockedUsers, nickname, username]);

  useEffect(() => {
    if (!isLoggedIn || !password) return;

    const roomId = CryptoJS.SHA256(password).toString();
    const myId = username; 
    
    const roomMsgRef = ref(db, `rooms/${roomId}/messages`);
    const presenceRef = ref(db, `rooms/${roomId}/presence`);
    const myPresenceRef = ref(db, `rooms/${roomId}/presence/${myId}`);

    let currentCount = 0; 

    set(myPresenceRef, true);
    onDisconnect(myPresenceRef).remove();

    const unsubJoin = onChildAdded(presenceRef, (snap) => {
      if (snap.key !== myId) {
        setSystemLogs(prev => [...prev, { id: `join-${snap.key}-${Date.now()}`, type: 'system', timestamp: Date.now(), text: `👋 ${snap.key} vừa tham gia phòng bí mật.` }]);
      }
    });

    const unsubLeave = onChildRemoved(presenceRef, (snap) => {
      if (snap.key !== myId) {
        setSystemLogs(prev => [...prev, { id: `leave-${snap.key}-${Date.now()}`, type: 'system', timestamp: Date.now(), text: `🚪 ${snap.key} đã ngắt kết nối và rời đi.` }]);
      }
    });

    roomDisconnectRef.current = onDisconnect(roomMsgRef);
    
    const unsubPresence = onValue(presenceRef, (snap) => {
      currentCount = snap.size; 
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

      // Dùng forEach để bốc đúng thứ tự tự nhiên từ Firebase
      snapshot.forEach((childSnapshot) => {
        const key = childSnapshot.key;
        const msgData = childSnapshot.val();

        if (!blockedUsers.includes(msgData.sender)) {
          try {
            console.log("%c[INBOUND] - Dữ liệu tiếp nhận", "color: #047857; font-weight: bold; font-size: 11px;");
            console.log(`SENDER     : ${msgData.sender}`);
            console.log(`TIMESTAMP  : ${msgData.timestamp}`);
            console.log(`AES-256    : ${msgData.text}`);
            console.log("--------------------------------------------------");

            const decryptedText = decryptMessage(msgData.text, password);
            loadedMessages.push({
              id: key,
              sender: msgData.sender,
              senderAvatar: msgData.avatar,
              text: decryptedText,
              rawText: msgData.text,
              timestamp: msgData.timestamp || Date.now(),
              isMine: msgData.sender === currentMyId
            });
          } catch (error) {}
        }
      });

      setMessages(loadedMessages);
      
      const lastMsg = loadedMessages[loadedMessages.length - 1];
      if (lastMsg && !lastMsg.isMine && !isMuted) {
         const audio = new Audio(selectedSound);
         audio.play().catch(e => {});
      }
    });

    const handleUnload = () => {
      if (currentCount <= 1) {
        remove(roomMsgRef);
        remove(presenceRef);
      }
      remove(myPresenceRef);
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      off(roomMsgRef);
      off(presenceRef);
      window.removeEventListener('beforeunload', handleUnload);
      
      if (currentCount <= 1) {
        remove(roomMsgRef);
        remove(presenceRef);
      }
      remove(myPresenceRef);
      roomDisconnectRef.current.cancel();
    };
  }, [isLoggedIn, password]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, systemLogs]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      setNickname(username); 
      setIsLoggedIn(true);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const encryptedText = encryptMessage(inputMsg, password);
    
    const msgPayload = {
      sender: nickname || username,
      avatar: avatar,
      text: encryptedText,
      timestamp: serverTimestamp() // GIẢI PHÁP TỐI THƯỢNG: Trả quyền chốt giờ cho Firebase
    };

    console.log("%c[OUTBOUND] - DỮ LIỆU ĐÃ MÃ HÓA TẠI THIẾT BỊ GỬI", "color: #b45309; font-weight: bold; font-size: 11px;");
    console.log(`SENDER     : ${msgPayload.sender}`);
    console.log(`TIMESTAMP  : Hệ thống Firebase tự động cấp`);
    console.log(`AES-256    : ${msgPayload.text}`);
    console.log("--------------------------------------------------");

    const roomId = CryptoJS.SHA256(password).toString();
    const roomRef = ref(db, `rooms/${roomId}/messages`);
    push(roomRef, msgPayload);
    
    setInputMsg('');
  };

  const handleDeleteMessage = (id) => setMessages(messages.filter(msg => msg.id !== id));
  const handleClearChat = () => { if (window.confirm("Xác nhận lệnh xóa bộ nhớ đệm cục bộ?")) setMessages([]); };
  const handleBlockUser = (senderName) => {
    if (senderName !== (nickname || username) && !blockedUsers.includes(senderName)) {
      if (window.confirm(`Xác nhận chặn ID: ${senderName}?`)) setBlockedUsers(prev => [...prev, senderName]);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center transform transition-all hover:scale-[1.01]">
          <div className="flex justify-center mb-6">
            <img src="/assets/logo.png" alt="HUB Logo" className="w-28 h-28 object-contain bg-gray-50 rounded-full border-4 border-blue-100 p-2 shadow-sm" onError={(e) => { e.target.src = 'https://via.placeholder.com/100?text=LOGO'; }} />
          </div>
          <h1 className="text-2xl font-bold text-blue-900 mb-1">TRƯỜNG ĐẠI HỌC NGÂN HÀNG TP.HCM</h1>
          <h2 className="text-xs font-bold mb-8 text-blue-500 uppercase tracking-widest bg-blue-50 inline-block px-3 py-1 rounded-full">Hệ thống nhắn tin bảo mật</h2>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="text-left">
              <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Tên đăng nhập </label>
              <input type="text" className="w-full px-5 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="text-left">
              <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Khóa phòng</label>
              <input type="password" className="w-full px-5 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="w-full bg-blue-700 text-white py-3.5 rounded-xl hover:bg-blue-800 transition-colors font-bold text-lg shadow-md hover:shadow-lg mt-2">Truy cập hệ thống</button>
          </form>
          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-green-600 bg-green-50 py-2 rounded-lg font-medium">
            <Shield size={16} /> Thuật toán mã hóa AES-256
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen overflow-hidden flex flex-col font-sans ${getThemeClass()} transition-colors duration-200`}>
      <header className="p-3 border-b flex justify-between items-center bg-white/5 shadow-sm backdrop-blur-md relative z-50">
        <div className="flex items-center gap-3">
          <img src={avatar} alt="Avatar" className="w-11 h-11 rounded-full border-2 border-white shadow-sm object-cover bg-white" onError={(e) => { e.target.src = 'https://via.placeholder.com/40'; }}/>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base">{nickname || username}</h2>
              <button onClick={() => { const newName = prompt("Đổi tên đăng nhập:", nickname); if(newName) setNickname(newName); }} className="text-gray-400 hover:text-blue-500 transition-colors"><Edit3 size={14} /></button>
            </div>
            <p className="text-[10px] opacity-70 flex items-center gap-1 text-green-500 font-medium"><Shield size={10} /> Đã mã hóa kênh truyền</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search size={14} className="absolute left-3 top-2.5 opacity-40" />
            <input type="text" placeholder="Tìm kiếm tin nhắn..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white/50 w-48 transition-all focus:w-64" />
          </div>
          <div className="h-6 w-px bg-gray-300/50 mx-1"></div>
          <button onClick={() => setTheme('light')} className="p-1.5 rounded-full hover:bg-gray-200/50 opacity-70 hover:opacity-100 transition-all"><Sun size={18} /></button>
          <button onClick={() => setTheme('dark')} className="p-1.5 rounded-full hover:bg-gray-200/50 opacity-70 hover:opacity-100 transition-all"><Moon size={18} /></button>
          <button onClick={() => setTheme('eyecare')} className="p-1.5 rounded-full hover:bg-gray-200/50 opacity-70 hover:opacity-100 text-amber-600 transition-all"><Eye size={18} /></button>
          <div className="h-6 w-px bg-gray-300/50 mx-1"></div>
          <div className="relative">
            <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 opacity-70 hover:opacity-100 rounded-full hover:bg-gray-200/50 transition-all"><MoreVertical size={20} /></button>
            {showSettings && (
              <div className="absolute right-0 mt-3 w-72 bg-white text-gray-800 border shadow-2xl rounded-xl p-4 z-50 text-sm max-h-[60vh] overflow-y-auto">
                <h3 className="font-bold mb-3 border-b pb-2 text-xs text-blue-600 tracking-wide">THÔNG SỐ MÔI TRƯỜNG</h3>
                <div className="mb-4 flex justify-between items-center"><span className="font-medium">Mã màu nhận diện:</span><input type="color" value={msgBgColor} onChange={(e) => setMsgBgColor(e.target.value)} className="w-8 h-8 border border-gray-200 rounded cursor-pointer p-0.5" /></div>
                <div className="mb-4 bg-gray-50 p-2 rounded-lg border">
                  <div className="flex justify-between items-center mb-2"><span className="font-medium text-xs">Cảnh báo đa phương tiện:</span><button onClick={() => setIsMuted(!isMuted)} className={`p-1.5 rounded-md transition-colors ${!isMuted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{!isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}</button></div>
                  {!isMuted && (
                    <div className="flex gap-1 justify-between">
                      {SOUNDS.map((snd, idx) => (
                        <button key={idx} onClick={() => { setSelectedSound(snd); new Audio(snd).play().catch(e=>{}); }} className={`flex-1 py-1.5 text-[10px] font-bold rounded border transition-all ${selectedSound === snd ? 'bg-blue-500 text-white border-blue-600 shadow-inner' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Tệp {idx + 1}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mb-4">
                  <span className="block mb-2 font-medium text-xs">Avatar:</span>
                  <div className="grid grid-cols-5 gap-1.5 max-h-28 overflow-y-auto border border-gray-100 p-1.5 rounded-lg bg-gray-50">
                    {AVATARS.map((img, idx) => <img key={idx} src={img} alt={`Avt ${idx+1}`} onClick={() => setAvatar(img)} className={`w-full aspect-square object-cover rounded-md cursor-pointer border-2 transition-transform hover:scale-110 ${avatar === img ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent'}`} onError={(e) => { e.target.src = 'https://via.placeholder.com/30'; }} />)}
                  </div>
                </div>
                <div className="mb-4">
                  <span className="block mb-2 font-medium text-xs">Phông nền hiển thị:</span>
                  <div className="grid grid-cols-4 gap-1.5 max-h-24 overflow-y-auto border border-gray-100 p-1.5 rounded-lg bg-gray-50">
                    <div onClick={() => setChatBg('')} className="w-full aspect-video bg-gray-200 cursor-pointer border rounded flex items-center justify-center text-[10px] font-bold text-gray-500 hover:bg-gray-300 transition-colors">Tối giản</div>
                    {BACKGROUNDS.map((bg, idx) => <img key={idx} src={bg} alt={`Bg ${idx+1}`} onClick={() => setChatBg(`url(${bg})`)} className={`w-full aspect-video object-cover rounded cursor-pointer border-2 hover:opacity-80 transition-opacity ${chatBg === `url(${bg})` ? 'border-blue-500' : 'border-transparent'}`} onError={(e) => { e.target.src = 'https://via.placeholder.com/40x20'; }} />)}
                  </div>
                </div>
                <button onClick={handleClearChat} className="w-full text-center text-red-600 font-bold flex items-center justify-center gap-2 pt-3 border-t mt-2 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={16} /> Xóa bộ đệm cục bộ</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main 
        className="h-full flex-1 overflow-y-auto p-4 space-y-4 relative z-0" 
        style={{ 
          backgroundImage: chatBg, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          backgroundColor: theme === 'dark' ? '#111827' : (theme === 'eyecare' ? '#e8dfc8' : '#ffffff')
        }}
      >
        <div className="relative z-10 space-y-5">
          {displayMessages.length === 0 && searchQuery && (
            <div className="text-center text-sm opacity-60 mt-10 bg-white/50 inline-block px-4 py-2 rounded-full mx-auto flex justify-center">Truy vấn không trả về kết quả cho từ khóa "{searchQuery}"</div>
          )}
          
          {displayMessages.map((msg) => {
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-4 animate-fade-in-up">
                  <span className="bg-gray-200/70 dark:bg-gray-800/70 text-gray-600 dark:text-gray-400 text-[10px] px-3 py-1 rounded-full font-semibold uppercase tracking-wider backdrop-blur-sm shadow-sm border border-gray-300/30">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'} group animate-fade-in-up`}>
                {!msg.isMine && (
                  <div className="mr-3 flex flex-col items-center">
                    <img src={msg.senderAvatar} alt="avt" className="w-9 h-9 rounded-full border border-gray-200 shadow-sm bg-white object-cover" onError={(e) => { e.target.src = 'https://via.placeholder.com/30'; }}/>
                  </div>
                )}
                
                <div className="flex flex-col max-w-[75%]">
                  {!msg.isMine && (
                    <div className="flex items-center gap-2 mb-1 pl-1">
                      <span className="text-xs font-bold opacity-60">{msg.sender}</span>
                      <button onClick={() => handleBlockUser(msg.sender)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"><Ban size={12} /></button>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    {msg.isMine && (
                      <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1 transition-all"><Trash2 size={14} /></button>
                    )}

                    <div 
                      className="p-3.5 rounded-2xl text-sm shadow-md"
                      style={{ 
                        backgroundColor: msg.isMine ? msgBgColor : (theme === 'dark' ? '#374151' : '#ffffff'),
                        color: msg.isMine ? '#ffffff' : 'inherit',
                        borderRadius: msg.isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                        border: msg.isMine ? 'none' : '1px solid #e5e7eb'
                      }}
                    >
                      <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>

                    {!msg.isMine && (
                      <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1 transition-all"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <div className="p-4 border-t bg-white/5 backdrop-blur-md relative z-20">
        <form onSubmit={handleSendMessage} className="flex gap-2 max-w-5xl mx-auto">
          <input type="text" value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} placeholder="Nhập văn bản truyền tải..." className="flex-1 px-5 py-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80 shadow-inner text-sm transition-all" />
          <button type="submit" className="bg-blue-600 text-white px-5 rounded-full hover:bg-blue-700 transition-all transform hover:scale-105 shadow-md flex items-center justify-center"><Send size={18} className="ml-1" /></button>
        </form>
      </div>

      <footer className="border-t p-5 text-xs opacity-80 bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-400 relative z-20">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <img src="/assets/logo.png" alt="HUB Logo" className="w-10 h-10 grayscale opacity-60" onError={(e) => { e.target.style.display = 'none'; }} />
            <div>
              <p className="font-bold text-sm mb-0.5 text-gray-900 dark:text-gray-200">Trường Đại học Ngân hàng TP.HCM (HUB)</p>
              <p className="font-medium text-blue-700 dark:text-blue-400">Khoa Khoa học dữ liệu trong kinh doanh</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-right font-medium">
            <p className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-400" /> 36 Tôn Thất Đạm, Q.1 | 56 Hoàng Diệu 2, Thủ Đức TP. HCM</p>
            <p className="flex items-center gap-1.5"><Phone size={12} className="text-gray-400" /> (028) 38 291 901</p>
            <p className="flex items-center gap-1.5"><Globe size={12} className="text-gray-400" /> <a href="https://hub.edu.vn" target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors">hub.edu.vn</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}