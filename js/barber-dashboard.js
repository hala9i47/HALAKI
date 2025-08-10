import { auth, db } from '../js/firebase-config.js';
import { cloudinaryConfig } from '../js/cloudinary-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { collection, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// عناصر الواجهة
const barberName = document.getElementById('barberName');
const barberPhone = document.getElementById('barberPhone');
const barberProfileImage = document.getElementById('barberProfileImage');
const appointmentsContainer = document.getElementById('appointmentsContainer');


let currentBarberId = null;
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace('../login.html');
        return;
    }
    currentBarberId = user.uid;
    // جلب بيانات الحلاق من قاعدة البيانات
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
        const data = userDoc.data();
        barberName.textContent = data.name || data.fullName || 'اسم الحلاق';
        barberPhone.textContent = data.phone || '';
        if (data.profileImage) barberProfileImage.src = data.profileImage;
    }
    // جلب المواعيد
    loadAppointments(user.uid);
});


async function loadAppointments(barberId) {
    appointmentsContainer.innerHTML = '<div class="loading">جاري تحميل المواعيد...</div>';
    const querySnapshot = await getDocs(collection(db, 'appointments'));
    // حساب تاريخ اليوم المحلي (وليس UTC) لتفادي اختلاف اليوم آخر الليل
    const now = new Date();
    const todayLocal = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    let html = '';
    querySnapshot.forEach(docSnap => {
        const appt = docSnap.data();
        // إظهار مواعيد هذا الحلاق + المواعيد العامة (general_barber)
        if ((appt.barberId === barberId || appt.barberId === 'general_barber') && appt.date === todayLocal) {
            const customerName = appt.fullName || appt.customerName || appt.name || 'عميل';
            html += `<div class="appointment-item">
                <span class="appointment-customer">${customerName}</span>
                <span class="appointment-time">${appt.time || ''}</span>
                <div class="appointment-actions">
                    <button onclick=\"window.location.href='../pages/appointment-chat.html?id=${docSnap.id}'\">دردشة</button>
                    <button onclick="window.confirmAppointment('${docSnap.id}')">تأكيد</button>
                    <button onclick="window.cancelAppointment('${docSnap.id}')">إلغاء</button>
                </div>
            </div>`;
        }
    });
    appointmentsContainer.innerHTML = html || '<div>لا توجد مواعيد اليوم</div>';
}


window.confirmAppointment = async function(id) {
    await updateDoc(doc(db, 'appointments', id), { status: 'confirmed' });
    loadAppointments(currentBarberId);
};

window.cancelAppointment = async function(id) {
    await updateDoc(doc(db, 'appointments', id), { status: 'cancelled' });
    loadAppointments(currentBarberId);
};

// منطق نافذة المنشور الجديد
const postModal = document.getElementById('postModal');
const addPostBtn = document.getElementById('addPostBtn');
const cancelPostBtn = document.getElementById('cancelPostBtn');
const submitPostBtn = document.getElementById('submitPostBtn');
const postContent = document.getElementById('postContent');
const postMediaInput = document.getElementById('postMedia');
const mediaPreview = document.getElementById('mediaPreview');
let selectedMediaFiles = [];
let isUploading = false;
function setPostingState(state){
  isUploading = state;
  if(submitPostBtn){
    submitPostBtn.disabled = state;
    submitPostBtn.style.opacity = state ? '0.6':'1';
    submitPostBtn.textContent = state ? 'جارٍ الرفع...' : 'نشر';
  }
}

if (addPostBtn && postModal) {
    addPostBtn.onclick = () => { postModal.style.display = 'flex'; };
}
if (cancelPostBtn && postModal) {
    cancelPostBtn.onclick = () => { postModal.style.display = 'none'; postContent.value = ''; };
}
if (submitPostBtn && postModal) {
    submitPostBtn.onclick = async () => {
        if (!postContent.value.trim() && selectedMediaFiles.length === 0) return;
        await addPostToDB(postContent.value.trim(), selectedMediaFiles);
        postModal.style.display = 'none';
        postContent.value = '';
        postMediaInput.value = '';
        mediaPreview.innerHTML = '';
        selectedMediaFiles = [];
        alert('تم نشر المنشور بنجاح!');
    };
}

if (postMediaInput) {
    postMediaInput.addEventListener('change', (e) => {
        selectedMediaFiles = Array.from(e.target.files || []);
        mediaPreview.innerHTML = '';
        selectedMediaFiles.forEach(file => {
            const url = URL.createObjectURL(file);
            const isVideo = file.type.startsWith('video');
            const el = document.createElement(isVideo ? 'video' : 'img');
            if (isVideo) {
                el.src = url;
                el.controls = true;
                el.className = 'post-media-video';
                el.style.maxWidth = '120px';
                el.style.maxHeight = '120px';
                el.style.borderRadius = '8px';
                el.style.background = '#111';
            } else {
                el.src = url;
                el.className = 'post-media-img';
                el.style.maxWidth = '90px';
                el.style.maxHeight = '90px';
                el.style.objectFit = 'cover';
                el.style.borderRadius = '8px';
                el.style.background = '#111';
            }
            mediaPreview.appendChild(el);
        });
    });
}

async function addPostToDB(content, mediaFiles=[]) {
    if (!currentBarberId) return;
    const userDoc = await getDoc(doc(db, 'users', currentBarberId));
    const barberData = userDoc.exists() ? userDoc.data() : {};
    let mediaArray = [];
    if (mediaFiles.length) {
        mediaArray = await uploadMediaFiles(mediaFiles);
    }
    try {
        await addDoc(collection(db, 'posts'), {
            content: content || '',
            barberId: currentBarberId,
            barberName: barberData.name || barberData.fullName || '',
            barberImage: barberData.profileImage || '',
            media: mediaArray, // مصفوفة كائنات {type,url,publicId}
            likes: 0,
            comments: [],
            timestamp: serverTimestamp()
        });
    } catch(e){
        console.error('فشل إضافة المنشور:', e);
        alert('فشل نشر المنشور، حاول مرة أخرى');
    }
}

async function uploadMediaFiles(files){
  const results = [];
  setPostingState(true);
  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);
      formData.append('folder', `${cloudinaryConfig.folder}/posts/${currentBarberId}`);
      const resourceType = file.type.startsWith('video') ? 'video' : 'image';
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`, { method:'POST', body: formData });
        const data = await res.json();
        if(data.secure_url && data.secure_url.startsWith('http')){
          results.push({ type: resourceType === 'video' ? 'video':'image', url: data.secure_url, publicId: data.public_id });
        } else {
          console.error('فشل رفع ملف أو لم يتم إرجاع رابط نهائي:', data, file);
        }
      } catch(err){
        console.error('خطأ أثناء رفع وسيط:', err);
      }
    }
  } finally {
    setPostingState(false);
  }
  return results;
}

// منطق نافذة الإحصائيات
const statsModal = document.getElementById('statsModal');
const viewStatsBtn = document.getElementById('viewStatsBtn');
const closeStatsBtn = document.getElementById('closeStatsBtn');
const statsContent = document.getElementById('statsContent');

if (viewStatsBtn && statsModal) {
    viewStatsBtn.onclick = async () => {
        statsModal.style.display = 'flex';
        statsContent.innerHTML = 'جاري التحميل...';
        // جلب إحصائيات بسيطة: عدد المواعيد اليوم، عدد المنشورات
        let appointmentsCount = 0;
        let postsCount = 0;
        const today = new Date().toISOString().slice(0, 10);
        const appts = await getDocs(collection(db, 'appointments'));
        appts.forEach(docSnap => {
            const appt = docSnap.data();
            if (appt.barberId === currentBarberId && appt.date === today) appointmentsCount++;
        });
        const posts = await getDocs(collection(db, 'posts'));
        posts.forEach(docSnap => {
            const post = docSnap.data();
            if (post.barberId === currentBarberId) postsCount++;
        });
        statsContent.innerHTML = `<div>عدد مواعيد اليوم: <b>${appointmentsCount}</b></div><div>عدد المنشورات: <b>${postsCount}</b></div>`;
    };
}
if (closeStatsBtn && statsModal) {
    closeStatsBtn.onclick = () => { statsModal.style.display = 'none'; };
}
