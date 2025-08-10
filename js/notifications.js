// إعداد إشعارات Firebase Cloud Messaging (أساس)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging.js';

// استخدم نفس إعدادات Firebase (يمكن استيرادها بدل إعادة كتابتها إذا لزم)
const firebaseConfig = {
  apiKey: "AIzaSyC4lRLZEIaHDfeoigFxvjqQhxbIkU9NUuE",
  authDomain: "hala9i.firebaseapp.com",
  projectId: "hala9i",
  storageBucket: "hala9i.appspot.com",
  messagingSenderId: "1068748204618",
  appId: "1:1068748204618:web:238df060c97d48a735d4b3",
  measurementId: "G-2Y45YBERGG"
};

const appNoti = initializeApp(firebaseConfig, 'noti');
const messaging = getMessaging(appNoti);

export async function requestFcmToken(vapidKey){
  try {
    const token = await getToken(messaging, { vapidKey });
    if(token){
      console.log('FCM Token:', token);
      // TODO: احفظ التوكن في users collection (حقل fcmTokens array)
    }
    return token;
  } catch(e){ console.error('فشل الحصول على FCM token', e); }
}

export function listenForegroundMessages(){
  onMessage(messaging, payload => {
    console.log('رسالة داخلية:', payload);
    if(Notification.permission==='granted'){
      new Notification(payload.notification?.title || 'إشعار', { body: payload.notification?.body || '' });
    }
  });
}
