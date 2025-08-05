import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { uploadToCloudinary, getOptimizedImageUrl } from './cloudinary-config.js';

const registerForm = document.getElementById('registerForm');
const profileImage = document.getElementById('profileImage');
const fullName = document.getElementById('fullName');
const phone = document.getElementById('phone');
const lastHaircut = document.getElementById('lastHaircut');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirmPassword');
const toast = document.getElementById('toast');

// معاينة الصورة المحددة
profileImage.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.querySelector('.image-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Profile Preview">`;
        }
        reader.readAsDataURL(file);
    }
});

// تبديل إظهار/إخفاء كلمة المرور
document.querySelectorAll('.toggle-password').forEach(toggle => {
    toggle.addEventListener('click', function() {
        const passwordInput = this.previousElementSibling;
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });
});

// عرض رسالة خطأ أو نجاح
function showToast(message, type) {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// التحقق من صحة المدخلات
function validateInputs() {
    if (password.value !== confirmPassword.value) {
        showToast('كلمات المرور غير متطابقة', 'error');
        return false;
    }
    
    if (password.value.length < 6) {
        showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        return false;
    }
    
    if (phone.value.length < 10) {
        showToast('رقم الهاتف غير صحيح', 'error');
        return false;
    }
    
    return true;
}

// إنشاء حساب جديد
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateInputs()) return;

    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');
    
    // عرض حالة التحميل
    btnText.style.display = 'none';
    loader.style.display = 'block';

    try {
        // تحويل رقم الهاتف إلى بريد إلكتروني بنفس النمط المستخدم في login.js
        let formattedPhone = phone.value.replace(/[^0-9]/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '966' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('966')) {
            formattedPhone = '966' + formattedPhone;
        }
        const email = `${formattedPhone}@halaqi.com`;

        // إنشاء حساب جديد في Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, email, password.value);

        // رفع الصورة إلى Cloudinary إذا تم اختيارها
        let profileImageUrl = '';
        if (profileImage.files[0]) {
            try {
                const imageData = await uploadToCloudinary(
                    profileImage.files[0],
                    `users/${userCredential.user.uid}`
                );
                profileImageUrl = imageData.url;
            } catch (error) {
                console.error('خطأ في رفع الصورة:', error);
            }
        }

        // إضافة بيانات المستخدم في Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
            fullName: fullName.value,
            phone: formattedPhone,
            lastHaircut: lastHaircut.value,
            profileImage: profileImageUrl,
            points: 0,
            appointments: [],
            createdAt: new Date().toISOString()
        });

        // تم إنشاء الحساب بنجاح
        showToast('تم إنشاء الحساب بنجاح!', 'success');

        // تخزين معلومات المستخدم
        localStorage.setItem('user', JSON.stringify(userCredential.user));

        // الانتقال إلى لوحة التحكم
        setTimeout(() => {
            window.location.href = 'pages/customer-dashboard.html';
        }, 1000);

    } catch (error) {
        let errorMessage = 'حدث خطأ في إنشاء الحساب';
        console.error('تفاصيل الخطأ:', error);

        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'رقم الهاتف مسجل مسبقاً. الرجاء تسجيل الدخول أو استخدام رقم آخر';
                break;
            case 'auth/invalid-email':
                errorMessage = 'رقم الهاتف غير صالح';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'تسجيل المستخدمين غير مفعل حالياً';
                break;
            case 'auth/weak-password':
                errorMessage = 'كلمة المرور ضعيفة جداً، يجب أن تكون 6 أحرف على الأقل';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'فشل الاتصال بالخادم. تأكد من اتصال الإنترنت وحاول مرة أخرى';
                break;
            default:
                if (error.message) {
                    errorMessage = `خطأ: ${error.message}`;
                }
        }
        
        showToast(errorMessage, 'error');
    } finally {
        // إخفاء حالة التحميل
        btnText.style.display = 'block';
        loader.style.display = 'none';
    }
});
