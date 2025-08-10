import { auth, db } from '../js/firebase-config.js';
import { getOptimizedImageUrl } from '../js/cloudinary-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// وظيفة لإظهار رسالة خطأ في الصفحة
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 15px;
        border-radius: 4px;
        z-index: 1000;
        direction: rtl;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// وظيفة لإظهار رسالة معلومات في الصفحة
function showInfo(message) {
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2196F3;
        color: white;
        padding: 15px;
        border-radius: 4px;
        z-index: 1000;
        direction: rtl;
    `;
    infoDiv.textContent = message;
    document.body.appendChild(infoDiv);
    setTimeout(() => {
        infoDiv.remove();
    }, 3000);
}

let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    showInfo('جاري التحقق من حالة تسجيل الدخول...');
    console.log('بدء تحميل صفحة لوحة التحكم...');

    // التحقق من وضع التصحيح
    const isDebugMode = localStorage.getItem('debugMode') === 'true';

    onAuthStateChanged(auth, async (user) => {
    console.log('حالة تسجيل الدخول:', user ? 'مسجل الدخول' : 'غير مسجل الدخول');
    
    if (!user) {
        console.log('لم يتم العثور على مستخدم مسجل، جاري التحويل إلى صفحة تسجيل الدخول...');
        // إضافة تأخير لنتمكن من رؤية رسائل Console
        setTimeout(() => {
            window.location.replace('../login.html');
        }, 2000);
        return;
    }

    // جلب بيانات المستخدم
    try {
        console.log('جاري جلب بيانات المستخدم من Firestore...');
        const userDoc = await getDoc(doc(db, "users", user.uid));
        console.log('تم جلب بيانات المستخدم:', userDoc.exists() ? 'موجود' : 'غير موجود');
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentUserId = user.uid;
            const role = userData.userType || 'customer';
            console.log('نوع المستخدم:', role);
            if (role === 'barber') {
                console.log('هذا المستخدم حلاق، جاري التحويل إلى واجهة الحلاق...');
                setTimeout(() => { window.location.replace('barber-dashboard.html'); }, 2000);
                return;
            }
            updateUIWithUserData({...userData, userType: role});
            loadPosts();
            // استماع لحظي للإشعارات بدل التحميل مرة واحدة
            listenNotifications();
            setupNotificationsPage();
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
        showError("حدث خطأ في جلب بيانات المستخدم");
    }
    });
});

// تحديث واجهة المستخدم ببيانات المستخدم
function updateUIWithUserData(userData) {
    // تحديث آخر حلاقة
    if (document.getElementById('lastHaircut') && userData.lastHaircut) {
        document.getElementById('lastHaircut').textContent = userData.lastHaircut;
    }
    // تحديث صورة الملف الشخصي
    if (document.getElementById('profileImage') && userData.profileImage) {
        document.getElementById('profileImage').src = userData.profileImage;
    }
    // تحديث اسم المستخدم (يدعم name أو fullName)
    const displayName = userData.name || userData.fullName || '';
    if (document.getElementById('userName') && displayName) {
        document.getElementById('userName').textContent = displayName;
    }
    // تحديث النقاط
    if (document.getElementById('userPoints') && userData.points !== undefined) {
        document.getElementById('userPoints').textContent = userData.points;
    }
    // تحديث رقم الهاتف في الملف الشخصي
    if (document.getElementById('profilePhone') && userData.phone) {
        document.getElementById('profilePhone').textContent = userData.phone;
    }
    // تحديث اسم المستخدم في الملف الشخصي (يدعم name أو fullName)
    if (document.getElementById('profileName') && displayName) {
        document.getElementById('profileName').textContent = displayName;
    }
    // تحديث عدد الإشعارات
    let notificationBadge = document.getElementById('notificationsBadge');
    if (!notificationBadge) {
        notificationBadge = document.querySelector('.notification-badge');
    }
    if (notificationBadge) {
        if (userData.unreadNotifications > 0) {
            notificationBadge.textContent = userData.unreadNotifications;
            notificationBadge.style.display = 'block';
        } else {
            notificationBadge.style.display = 'none';
        }
    }
}

// جلب وعرض المنشورات
async function loadPosts() {
    const postsContainer = document.querySelector('.posts-container');
    
    try {
        const postsSnapshot = await getDocs(collection(db, "posts"));
        
        if (postsSnapshot.empty) {
            postsContainer.innerHTML = `
                <div class="no-posts">
                    <i class="fas fa-inbox"></i>
                    <p>لا توجد منشورات حالياً</p>
                </div>
            `;
            return;
        }

        const posts = [];
        postsSnapshot.forEach(doc => {
            const raw = doc.data();
            // تحويل media القادمة من Firestore (إذا كانت على شكل arrayValue في API REST سابقاً) إلى مصفوفة عادية
            // في SDK 9 عادة ستأتي ككائن جاهز، نضمن فقط أنها مصفوفة صحيحة
            let media = [];
            if (raw.media && Array.isArray(raw.media)) {
                media = raw.media;
            } else if (raw.media && raw.media.values) { // حالة استعمال REST
                media = raw.media.values.map(v => {
                    const f = v.mapValue?.fields || {};
                    return { type: f.type?.stringValue || 'image', url: f.url?.stringValue || '' };
                }).filter(m => m.url);
            }
            // دعم عناصر media التي تحتوي كائنات داخلية ذات stringValue
            media = media.map(m => {
                const url = typeof m.url === 'object' && m.url?.stringValue ? m.url.stringValue : m.url;
                const type = typeof m.type === 'object' && m.type?.stringValue ? m.type.stringValue : m.type;
                return { type: type || 'image', url: url || '' };
            }).filter(m => m.url);
            // دعم الحقل القديم image
            if (!media.length && raw.image) {
                media = [{ type: 'image', url: raw.image }];
            }
            posts.push({ id: doc.id, ...raw, media });
        });

        // ترتيب المنشورات حسب التاريخ (الأحدث أولاً)
        posts.sort((a, b) => {
            try {
                const ta = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp?._seconds ? a.timestamp._seconds*1000 : 0);
                const tb = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp?._seconds ? b.timestamp._seconds*1000 : 0);
                return tb - ta;
            } catch(e) { return 0; }
        });

        // عرض المنشورات
        postsContainer.innerHTML = posts.map(post => createPostHTML(post)).join('');
        
        // تفعيل أزرار الإعجاب والتعليق
        setupPostInteractions();

    } catch (error) {
        console.error("Error loading posts:", error);
        showError("حدث خطأ في تحميل المنشورات");
    }
}

// إنشاء HTML للمنشور
function createPostHTML(post) {
    // دعم مصفوفة وسائط: post.media = [{type:'image', url:'...'},{type:'video', url:'...'}]
    let mediaHTML = '';
    if (post.media && Array.isArray(post.media) && post.media.length) {
        const normalized = post.media.map(m => {
            if(!m) return null;
            const url = typeof m.url === 'object' && m.url?.stringValue ? m.url.stringValue : m.url;
            const type = typeof m.type === 'object' && m.type?.stringValue ? m.type.stringValue : m.type;
            // إذا كانت صورة من Cloudinary، استخدم رابط مصغر
            const displayUrl = (url && url.includes('res.cloudinary.com')) ? getOptimizedImageUrl(url, 300, 300, 'auto') : url;
            return url ? { url: displayUrl, type: (type==='video'?'video':'image') } : null;
        }).filter(Boolean);
        if (normalized.length) {
            mediaHTML = `<div class="post-media">` + normalized.map(m => m.type==='video' ? `<video class="post-media-video" src="${m.url}" controls playsinline></video>` : `<img class="post-media-img" src="${m.url}" alt="media">`).join('') + `</div>`;
        }
    }
    return `
        <article class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <img src="${post.barberImage || '../images/default-avatar.jpg'}" alt="صورة الحلاق" class="barber-avatar" loading="lazy" width="44" height="44" style="width:44px;height:44px;object-fit:cover;border-radius:50%;border:2px solid #ffd600;flex-shrink:0;" />
                <div class="post-info">
                    <h3 class="barber-name">${post.barberName || ''}</h3>
                    <span class="post-time">${formatTimestamp(post.timestamp)}</span>
                </div>
            </div>
            <div class="post-content">
                ${mediaHTML}
                <p class="post-text">${post.content || ''}</p>
            </div>
            <div class="post-actions">
                <button class="action-button like-button" data-post-id="${post.id}">
                    <i class="far fa-heart"></i>
                    <span>${post.likes || 0}</span>
                </button>
                <button class="action-button comment-button" data-post-id="${post.id}">
                    <i class="far fa-comment"></i>
                    <span>${post.comments?.length || 0}</span>
                </button>
                <button class="action-button book-button" data-barber-id="${post.barberId}">
                    احجز موعد
                </button>
            </div>
        </article>
    `;
}

// تنسيق التاريخ
function formatTimestamp(timestamp) {
    if (!timestamp) return 'منذ قليل';
    
    const now = new Date();
    const postDate = timestamp.toDate();
    const diffInMinutes = Math.floor((now - postDate) / 1000 / 60);

    if (diffInMinutes < 1) return 'الآن';
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
    if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `منذ ${hours} ساعة`;
    }
    const days = Math.floor(diffInMinutes / 1440);
    return `منذ ${days} يوم`;
}

// إعداد التفاعلات مع المنشورات
function setupPostInteractions() {
    // زر الإعجاب
    document.querySelectorAll('.like-button').forEach(button => {
        button.addEventListener('click', handleLike);
    });

    // زر التعليق
    document.querySelectorAll('.comment-button').forEach(button => {
        button.addEventListener('click', handleComment);
    });

    // زر الحجز
    document.querySelectorAll('.book-button').forEach(button => {
        button.addEventListener('click', handleBooking);
    });
}

// معالجة الإعجاب
async function handleLike(event) {
    const button = event.currentTarget;
    const postId = button.dataset.postId;
    const icon = button.querySelector('i');
    const countSpan = button.querySelector('span');

    icon.classList.toggle('fas');
    icon.classList.toggle('far');
    
    // تحديث العدد مؤقتاً في الواجهة
    const currentCount = parseInt(countSpan.textContent);
    const isLiked = icon.classList.contains('fas');
    countSpan.textContent = isLiked ? currentCount + 1 : currentCount - 1;

    // هنا يمكن إضافة التفاعل مع Firebase
}

// معالجة التعليق
function handleComment(event) {
    const postId = event.currentTarget.dataset.postId;
    // هنا يمكن إضافة منطق فتح نافذة التعليقات
}

// معالجة الحجز
function handleBooking(event) {
    const barberId = event.currentTarget.dataset.barberId;
    window.location.href = `booking.html?barber=${barberId}`;
}


// --------- واجهة الهاتف: تنقل وزر عائم وبيانات تجريبية ---------
document.addEventListener('DOMContentLoaded', function() {
    // Navigation switching
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            const pageId = this.getAttribute('data-page');
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');
        });
    });

    // Floating booking button
    const bookBtn = document.getElementById('bookAppointment');
    if(bookBtn) {
        bookBtn.addEventListener('click', function() {
            showInfo('سيتم فتح صفحة حجز الموعد قريباً!');
        });
    }

    // Example: Set user name and points (replace with real data)
    // تم حذف الكود التجريبي الذي يضع اسم المستخدم ونقاط ثابتة. الآن ستظهر بيانات المستخدم الحقيقية فقط.

    // Example: Set notification badge (replace with real data)
    if(document.getElementById('notificationsBadge'))
        document.getElementById('notificationsBadge').textContent = '2';
});

async function loadNotifications(){
  // تم الإبقاء على الدالة كخيار يدوي، لكن الآن نستخدم listenNotifications()
  if(!currentUserId) return;
  const listEl = document.querySelector('#notificationsPage .notifications-list');
  if(listEl) listEl.innerHTML = '<div style="padding:12px;">جاري التحميل...</div>';
  return; // الاعتماد على الاستماع اللحظي
}

function listenNotifications(){
  if(!currentUserId) return;
  const listEl = document.querySelector('#notificationsPage .notifications-list');
  if(listEl) listEl.innerHTML = '<div style="padding:12px;">جاري التحميل...</div>';
  try {
    const qNotif = query(collection(db,'notifications'), where('userId','==', currentUserId)); // بدون orderBy لتفادي الفهرس
    onSnapshot(qNotif, snap => {
      if(snap.empty){
        if(listEl) listEl.innerHTML = '<div style="padding:12px;opacity:0.7;">لا توجد إشعارات</div>';
        updateNotificationsBadge(0);
        return;
      }
      const docsArr = [];
      snap.forEach(d=> docsArr.push(d));
      docsArr.sort((a,b)=>{ // ترتيب محلي تنازلي
        const ta = a.data().createdAt?.toDate ? a.data().createdAt.toDate().getTime() : 0;
        const tb = b.data().createdAt?.toDate ? b.data().createdAt.toDate().getTime() : 0;
        return tb - ta;
      });
      let unreadCount=0; let html='';
      docsArr.forEach(d=>{
        const n = d.data();
        const isUnread = (n.read === false || n.read === undefined);
        if(isUnread) unreadCount++;
        const time = formatNotifTime(n.createdAt);
        html += `<div class=\"notif-item ${isUnread?'unread':''}\" data-id=\"${d.id}\">\n  <div class=\"notif-title\">${n.title || 'إشعار'}</div>\n  <div class=\"notif-body\">${n.body || ''}</div>\n  <div class=\"notif-time\">${time}</div>\n</div>`;
      });
      if(listEl) listEl.innerHTML = html;
      updateNotificationsBadge(unreadCount);
    }, err => {
      console.error('خطأ استماع الإشعارات', err);
      if(listEl) listEl.innerHTML = '<div style="padding:12px;color:#f66;">خطأ في تحميل الإشعارات</div>';
    });
  } catch(e){
    console.error('فشل بدء الاستماع للإشعارات', e);
    if(listEl) listEl.innerHTML = '<div style="padding:12px;color:#f66;">خطأ في تحميل الإشعارات</div>';
  }
}
function updateNotificationsBadge(count){
  const badge = document.getElementById('notificationsBadge');
  if(!badge) return;
  if(count>0){ badge.textContent = count; badge.style.display='block'; }
  else { badge.style.display='none'; }
}
function setupNotificationsPage(){
  const listEl = document.querySelector('#notificationsPage .notifications-list');
  if(!listEl) return;
  listEl.addEventListener('click', async (e)=>{
    const item = e.target.closest('.notif-item');
    if(!item) return;
    if(item.classList.contains('unread')){
      const id = item.getAttribute('data-id');
      try { await updateDoc(doc(db,'notifications',id), { read:true }); item.classList.remove('unread'); recalcUnread(); } catch(err){ console.error(err); }
    }
  });
}
async function recalcUnread(){
  if(!currentUserId) return;
  const qNotif = query(collection(db,'notifications'), where('userId','==', currentUserId), where('read','==', false));
  const snap = await getDocs(qNotif);
  updateNotificationsBadge(snap.size);
}
function formatNotifTime(ts){
  if(!ts) return '';
  try { const d = ts.toDate(); return d.toLocaleString('ar-EG',{hour:'2-digit', minute:'2-digit'}); } catch(e){ return ''; }
}
