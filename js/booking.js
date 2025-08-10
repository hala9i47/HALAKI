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

let currentUserId = null;
onAuthStateChanged(auth, (u)=>{ currentUserId = u ? u.uid : null; });

bookingForm.onsubmit = async (e) => {
    e.preventDefault();
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    submitBtn.disabled = true;
    try {
        let barberId = getBarberIdFromUrl();
        const date = dateInput.value;
        const time = timeInput.value;
        if (!date || !time) throw new Error('يرجى تعبئة التاريخ والوقت');
        if (!barberId) {
            barberId = FALLBACK_BARBER_ID; // استخدام معرف افتراضي بدل إيقاف العملية
        }
        await addDoc(collection(db, 'appointments'), {
            barberId,
            customerId: currentUserId || null,
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
