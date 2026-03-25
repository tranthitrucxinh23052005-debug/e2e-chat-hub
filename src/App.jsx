import React, { useState, useEffect, useRef } from 'react';
import CryptoJS from 'crypto-js';
import { encryptMessage, decryptMessage } from './utils/crypto';
import { 
  Shield, Send, Trash2, User, Moon, Sun, Eye, Search, 
  MoreVertical, Volume2, VolumeX, Ban, Edit3, MapPin, Phone, Globe
} from 'lucide-react';

// Khởi tạo danh sách tài nguyên mẫu
const AVATARS = Array.from({ length: 20 }, (_, i) => `/assets/avatar-${i + 1}.jpg`);
const BACKGROUNDS = Array.from({ length: 10 }, (_, i) => `/assets/bg-${i + 1}.jpg`);
const SOUNDS = Array.from({ length: 5 }, (_, i) => `/assets/notification-${i + 1}.mp3`);

export default function App() {
  // Trạng thái xác thực
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Trạng thái dữ liệu chat
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Trạng thái cài đặt cá nhân (Preferences)
  const [theme, setTheme] = useState('light');
  const [chatBg, setChatBg] = useState(''); 
  const [msgBgColor, setMsgBgColor] = useState('#2563eb'); 
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [nickname, setNickname] = useState('');
  
  // Trạng thái âm thanh mới xịn xò nè
  const [isMuted, setIsMuted] = useState(false);
  const [selectedSound, setSelectedSound] = useState(SOUNDS[0]);
  
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  
  const channelRef = useRef(null);

  // Xử lý kênh truyền và nhận tin nhắn
  useEffect(() => {
    if (isLoggedIn && password) {
      const roomId = CryptoJS.SHA256(password).toString();
      channelRef.current = new BroadcastChannel(`e2e-room-${roomId}`);
      
      channelRef.current.onmessage = (event) => {
        const encryptedData = event.data;
        
        // Kiểm tra danh sách chặn
        if (blockedUsers.includes(encryptedData.sender)) return;

        const decryptedText = decryptMessage(encryptedData.text, password);
        
        setMessages((prev) => [...prev, {
          id: Date.now(),
          sender: encryptedData.sender,
          senderAvatar: encryptedData.avatar,
          text: decryptedText,
          rawEncrypted: encryptedData.text,
          isMine: false
        }]);

        // Phát đúng cái âm thanh TS đã chọn
        if (!isMuted) {
          const audio = new Audio(selectedSound);
          audio.play().catch(e => console.log("Trình duyệt chặn tự động phát âm thanh ", e));
        }
      };
    }
    
    return () => {
      if (channelRef.current) channelRef.current.close();
    };
  }, [isLoggedIn, password, blockedUsers, isMuted, selectedSound]);

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
      text: encryptedText
    };

    channelRef.current.postMessage(msgPayload);

    setMessages((prev) => [...prev, {
      id: Date.now(),
      sender: nickname || username,
      senderAvatar: avatar,
      text: inputMsg,
      rawEncrypted: encryptedText,
      isMine: true
    }]);
    
    setInputMsg('');
  };

  const handleDeleteMessage = (id) => {
    setMessages(messages.filter(msg => msg.id !== id));
  };

  const handleClearChat = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa sạch lịch sử trò chuyện không?")) {
      setMessages([]);
    }
  };

  const handleBlockUser = (senderName) => {
    if (senderName !== (nickname || username) && !blockedUsers.includes(senderName)) {
      if (window.confirm(`Bạn muốn chặn người dùng ${senderName} đúng không?`)) {
        setBlockedUsers(prev => [...prev, senderName]);
      }
    }
  };

  // Trình quản lý CSS Theme
  const getThemeClass = () => {
    if (theme === 'dark') return 'bg-gray-900 text-gray-200 border-gray-700';
    if (theme === 'eyecare') return 'bg-[#f4ecd8] text-[#5c4b37] border-[#d1c6ab]';
    return 'bg-gray-50 text-gray-900 border-gray-200';
  };

  // Bộ lọc tin nhắn theo từ khóa
  const filteredMessages = messages.filter(msg => 
    msg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // === GIAO DIỆN ĐĂNG NHẬP ===
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center transform transition-all hover:scale-[1.01]">
          <div className="flex justify-center mb-6">
            <img src="/assets/logo.png" alt="HUB Logo" className="w-28 h-28 object-contain bg-gray-50 rounded-full border-4 border-blue-100 p-2 shadow-sm" 
                 onError={(e) => { e.target.src = 'https://via.placeholder.com/100?text=LOGO'; }} />
          </div>
          <h1 className="text-2xl font-bold text-blue-900 mb-1">TRƯỜNG ĐẠI HỌC NGÂN HÀNG TP.HCM</h1>
          <h2 className="text-xs font-bold mb-8 text-blue-500 uppercase tracking-widest bg-blue-50 inline-block px-3 py-1 rounded-full">Hệ thống nhắn tin bảo mật</h2>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="text-left">
              <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Tên của bạn</label>
              <input
                type="text"
                className="w-full px-5 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="text-left">
              <label className="block text-sm font-semibold text-gray-700 mb-1 ml-1">Chìa khóa phòng chat</label>
              <input
                type="password"
                className="w-full px-5 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="w-full bg-blue-700 text-white py-3.5 rounded-xl hover:bg-blue-800 transition-colors font-bold text-lg shadow-md hover:shadow-lg mt-2">
              Vào phòng ngay
            </button>
          </form>
          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-green-600 bg-green-50 py-2 rounded-lg font-medium">
            <Shield size={16} /> Mã hóa đầu cuối AES-256
          </div>
        </div>
      </div>
    );
  }

  // === GIAO DIỆN CHAT CHÍNH ===
  return (
<div className={`h-screen overflow-hidden flex flex-col font-sans ${getThemeClass()} transition-colors duration-200`}>      {/* HEADER */}
      <header className="p-3 border-b flex justify-between items-center bg-white/5 shadow-sm backdrop-blur-md relative z-50">
        <div className="flex items-center gap-3">
          <img src={avatar} alt="Avatar" className="w-11 h-11 rounded-full border-2 border-white shadow-sm object-cover bg-white" 
               onError={(e) => { e.target.src = 'https://via.placeholder.com/40'; }}/>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base">{nickname || username}</h2>
              <button onClick={() => { const newName = prompt("Bạn muốn đổi biệt danh gì nè:", nickname); if(newName) setNickname(newName); }} className="text-gray-400 hover:text-blue-500 transition-colors" title="Đổi tên hiển thị">
                <Edit3 size={14} />
              </button>
            </div>
            <p className="text-[10px] opacity-70 flex items-center gap-1 text-green-500 font-medium"><Shield size={10} /> Đã kết nối an toàn</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Thanh tìm kiếm */}
          <div className="relative hidden md:block">
            <Search size={14} className="absolute left-3 top-2.5 opacity-40" />
            <input type="text" placeholder="Tìm tin nhắn..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                   className="pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white/50 w-48 transition-all focus:w-64" />
          </div>

          <div className="h-6 w-px bg-gray-300/50 mx-1"></div>

          {/* Công cụ theme */}
          <button onClick={() => setTheme('light')} title="Sáng rực rỡ" className="p-1.5 rounded-full hover:bg-gray-200/50 opacity-70 hover:opacity-100 transition-all"><Sun size={18} /></button>
          <button onClick={() => setTheme('dark')} title="Tối chill chill" className="p-1.5 rounded-full hover:bg-gray-200/50 opacity-70 hover:opacity-100 transition-all"><Moon size={18} /></button>
          <button onClick={() => setTheme('eyecare')} title="Bảo vệ mắt xinh" className="p-1.5 rounded-full hover:bg-gray-200/50 opacity-70 hover:opacity-100 text-amber-600 transition-all"><Eye size={18} /></button>
          
          <div className="h-6 w-px bg-gray-300/50 mx-1"></div>

          {/* Menu cài đặt (3 chấm) */}
          <div className="relative">
            <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 opacity-70 hover:opacity-100 rounded-full hover:bg-gray-200/50 transition-all">
              <MoreVertical size={20} />
            </button>
            
            {showSettings && (
              <div className="absolute right-0 mt-3 w-72 bg-white text-gray-800 border shadow-2xl rounded-xl p-4 z-50 text-sm max-h-[60vh] overflow-y-auto">
                <h3 className="font-bold mb-3 border-b pb-2 text-xs text-blue-600 tracking-wide">TÙY CHỈNH </h3>
                
                {/* Chọn màu tin nhắn */}
                <div className="mb-4 flex justify-between items-center">
                  <span className="font-medium">Màu tin nhắn của bạn:</span>
                  <input type="color" value={msgBgColor} onChange={(e) => setMsgBgColor(e.target.value)} className="w-8 h-8 border border-gray-200 rounded cursor-pointer p-0.5" />
                </div>

                {/* Chọn 5 âm thanh */}
                <div className="mb-4 bg-gray-50 p-2 rounded-lg border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-xs">Âm báo tin nhắn:</span>
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-1.5 rounded-md transition-colors ${!isMuted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {!isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                  </div>
                  {!isMuted && (
                    <div className="flex gap-1 justify-between">
                      {SOUNDS.map((snd, idx) => (
                        <button 
                          key={idx}
                          onClick={() => {
                            setSelectedSound(snd);
                            new Audio(snd).play().catch(e=>{}); // Nhấn là kêu liền để TS test thử nè
                          }}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded border transition-all ${selectedSound === snd ? 'bg-blue-500 text-white border-blue-600 shadow-inner' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                          title={`Nghe thử âm thanh số ${idx + 1}`}
                        >
                          Âm {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chọn Avatar (Grid 20 ảnh) */}
                <div className="mb-4">
                  <span className="block mb-2 font-medium text-xs">Thay đổi Avatar </span>
                  <div className="grid grid-cols-5 gap-1.5 max-h-28 overflow-y-auto border border-gray-100 p-1.5 rounded-lg bg-gray-50">
                    {AVATARS.map((img, idx) => (
                      <img key={idx} src={img} alt={`Avt ${idx+1}`} onClick={() => setAvatar(img)}
                           className={`w-full aspect-square object-cover rounded-md cursor-pointer border-2 transition-transform hover:scale-110 ${avatar === img ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent'}`}
                           onError={(e) => { e.target.src = 'https://via.placeholder.com/30'; }} />
                    ))}
                  </div>
                </div>

                {/* Chọn Hình nền (Grid 10 ảnh) */}
                <div className="mb-4">
                  <span className="block mb-2 font-medium text-xs">Background:</span>
                  <div className="grid grid-cols-4 gap-1.5 max-h-24 overflow-y-auto border border-gray-100 p-1.5 rounded-lg bg-gray-50">
                    <div onClick={() => setChatBg('')} className="w-full aspect-video bg-gray-200 cursor-pointer border rounded flex items-center justify-center text-[10px] font-bold text-gray-500 hover:bg-gray-300 transition-colors">Trơn</div>
                    {BACKGROUNDS.map((bg, idx) => (
                      <img key={idx} src={bg} alt={`Bg ${idx+1}`} onClick={() => setChatBg(`url(${bg})`)}
                           className={`w-full aspect-video object-cover rounded cursor-pointer border-2 hover:opacity-80 transition-opacity ${chatBg === `url(${bg})` ? 'border-blue-500' : 'border-transparent'}`}
                           onError={(e) => { e.target.src = 'https://via.placeholder.com/40x20'; }} />
                    ))}
                  </div>
                </div>

                {/* Xóa cuộc trò chuyện */}
                <button onClick={handleClearChat} className="w-full text-center text-red-600 font-bold flex items-center justify-center gap-2 pt-3 border-t mt-2 hover:bg-red-50 p-2 rounded-lg transition-colors">
                  <Trash2 size={16} /> Xóa đoạn chat
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* KHU VỰC CHAT CHÍNH */}
      <main 
        className="flex-1 overflow-y-auto p-4 space-y-4 relative" 
        style={{ 
          backgroundImage: chatBg, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          backgroundColor: theme === 'dark' ? '#111827' : (theme === 'eyecare' ? '#e8dfc8' : '#ffffff')
        }}
      >
        {chatBg && <div className="absolute inset-0 bg-white/70 dark:bg-black/70 pointer-events-none z-0"></div>}

        <div className="relative z-10 space-y-5">
          {filteredMessages.length === 0 && searchQuery && (
            <div className="text-center text-sm opacity-60 mt-10 bg-white/50 inline-block px-4 py-2 rounded-full mx-auto flex justify-center">Chà, không tìm thấy chữ "{searchQuery}" nào hết á!</div>
          )}
          
          {filteredMessages.map((msg) => (
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
                    <button onClick={() => handleBlockUser(msg.sender)} title="Cạch mặt người này luôn" className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                      <Ban size={12} />
                    </button>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  {msg.isMine && (
                    <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1 transition-all" title="Thu hồi tin nhắn">
                      <Trash2 size={14} />
                    </button>
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
                    <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1 transition-all" title="Xóa tin này bên phía mình">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* KHU VỰC NHẬP DỮ LIỆU */}
      <div className="p-4 border-t bg-white/5 backdrop-blur-md relative z-20">
        <form onSubmit={handleSendMessage} className="flex gap-2 max-w-5xl mx-auto">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1 px-5 py-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80 shadow-inner text-sm transition-all"
          />
          <button type="submit" className="bg-blue-600 text-white px-5 rounded-full hover:bg-blue-700 transition-all transform hover:scale-105 shadow-md flex items-center justify-center">
            <Send size={18} className="ml-1" />
          </button>
        </form>
      </div>

      {/* FOOTER THÔNG TIN TRƯỜNG */}
      <footer className="border-t p-5 text-xs opacity-80 bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-400 relative z-20">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <img src="/assets/logo.png" alt="HUB Logo" className="w-10 h-10 grayscale opacity-60" onError={(e) => { e.target.style.display = 'none'; }} />
            <div>
              <p className="font-bold text-sm mb-0.5 text-gray-900 dark:text-gray-200">Đại học Ngân hàng TP.HCM (HUB)</p>
              <p className="font-medium text-blue-700 dark:text-blue-400">Khoa Hệ thống Thông tin Quản lý</p>
              <p>Ngành Khoa học Dữ liệu trong Kinh doanh</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-right font-medium">
            <p className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-400" /> 36 Tôn Thất Đạm, Q.1 | 56 Hoàng Diệu 2, TP.Thủ Đức</p>
            <p className="flex items-center gap-1.5"><Phone size={12} className="text-gray-400" /> (028) 38 291 901</p>
            <p className="flex items-center gap-1.5"><Globe size={12} className="text-gray-400" /> <a href="https://hub.edu.vn" target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors">hub.edu.vn</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}