import { db, auth } from '../js/firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';

const dateInput = document.getElementById('dateInput');
const timeInput = document.getElementById('timeInput');
const bookingForm = document.getElementById('bookingForm');
const submitBtn = document.getElementById('submitBtn');
const successMsg = document.getElementById('successMsg');
const errorMsg = document.getElementById('errorMsg');

// ضبط أقل تاريخ للحجز (اليوم)
const today = new Date().toISOString().split('T')[0];
dateInput.min = today;

function getBarberIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('barber');
}

const FALLBACK_BARBER_ID = 'general_barber';

let currentUserId = null; let authResolved = false;
submitBtn.disabled = true; // منع الإرسال حتى نعرف حالة الدخول
onAuthStateChanged(auth, (u)=>{ currentUserId = u ? u.uid : null; authResolved = true; submitBtn.disabled = false; if(!u){ errorMsg.textContent='يجب تسجيل الدخول قبل الحجز'; errorMsg.style.display='block'; }});

bookingForm.onsubmit = async (e) => {
    e.preventDefault();
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    submitBtn.disabled = true;
    try {
        if(!authResolved){ throw new Error('يرجى الانتظار لحين التحقق من الحساب'); }
        if(!currentUserId){ throw new Error('يرجى تسجيل الدخول للحجز'); }
        let barberId = getBarberIdFromUrl();
        const date = dateInput.value;
        const time = timeInput.value;
        if (!date || !time) throw new Error('يرجى تعبئة التاريخ والوقت');
        if (!barberId) {
            barberId = FALLBACK_BARBER_ID; // استخدام معرف افتراضي بدل إيقاف العملية
        }
        await addDoc(collection(db, 'appointments'), {
            barberId,
            customerId: currentUserId,
            date,
            time,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        successMsg.textContent = 'تم حجز الموعد بنجاح!';
        successMsg.style.display = 'block';
        bookingForm.reset();
    } catch (e) {
        errorMsg.textContent = e.message || 'حدث خطأ أثناء الحجز';
        errorMsg.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
    }
};
