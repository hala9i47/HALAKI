
import { auth, db } from '../js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

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
            console.log('نوع المستخدم:', userData.userType);
            
            if (userData.userType === 'barber') {
                console.log('هذا المستخدم حلاق، جاري التحويل إلى واجهة الحلاق...');
                setTimeout(() => {
                    window.location.replace('barber-dashboard.html');
                }, 2000);
                return;
            }
            // تحديث واجهة المستخدم
            console.log('تحديث واجهة المستخدم...');
            updateUIWithUserData(userData);
            loadPosts(); // تحميل المنشورات بعد التحقق من المستخدم
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
            posts.push({ id: doc.id, ...doc.data() });
        });

        // ترتيب المنشورات حسب التاريخ (الأحدث أولاً)
        posts.sort((a, b) => b.timestamp - a.timestamp);

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
    return `
        <article class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <img src="${post.barberImage || '../images/default-avatar.jpg'}" alt="صورة الحلاق" class="barber-avatar">
                <div class="post-info">
                    <h3 class="barber-name">${post.barberName}</h3>
                    <span class="post-time">${formatTimestamp(post.timestamp)}</span>
                </div>
            </div>
            <div class="post-content">
                ${post.image ? `<img src="${post.image}" alt="صورة المنشور" class="post-image">` : ''}
                <p class="post-text">${post.content}</p>
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
