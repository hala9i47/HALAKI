import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const loginForm = document.getElementById('loginForm');
const phone = document.getElementById('phone');
const password = document.getElementById('password');
const toast = document.getElementById('toast');

// تبديل إظهار/إخفاء كلمة المرور
document.querySelector('.toggle-password').addEventListener('click', function() {
    const passwordInput = this.previousElementSibling;
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
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

// تسجيل الدخول
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');
    
    // عرض حالة التحميل
    btnText.style.display = 'none';
    loader.style.display = 'block';

    try {
        // تنسيق رقم الهاتف بنفس منطق التسجيل
        let formattedPhone = phone.value.replace(/[^0-9]/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '966' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('966')) {
            formattedPhone = '966' + formattedPhone;
        }
        const email = `${formattedPhone}@halaqi.com`;
        
        // تسجيل الدخول باستخدام Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password.value);
        
        // جلب بيانات المستخدم من Firestore
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            // تخزين معلومات المستخدم في localStorage
            localStorage.setItem('user', JSON.stringify({
                uid: userCredential.user.uid,
                email: email,
                phone: userData.phone,
                fullName: userData.fullName,
                userType: userData.userType,
                profileImage: userData.profileImage
            }));

            // تم تسجيل الدخول بنجاح
            showToast('تم تسجيل الدخول بنجاح!', 'success');

            // التوجيه حسب نوع المستخدم مع منع التحقق من auth
            setTimeout(() => {
                sessionStorage.setItem('skipAuthCheck', 'true');
                console.log('نوع المستخدم:', userData.userType);
                const isLocalhost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
                const basePath = isLocalhost ? '' : '/halaki';

                if (userData.userType === 'barber') {
                    window.location.replace(`${basePath}/pages/barber-dashboard.html`);
                } else {
                    window.location.replace(`${basePath}/pages/customer-dashboard.html`);
                }
            }, 1000);
        } else {
            showToast('لم يتم العثور على بيانات المستخدم', 'error');
        }

    } catch (error) {
        let errorMessage = 'حدث خطأ في تسجيل الدخول';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'رقم الهاتف غير مسجل';
                break;
            case 'auth/wrong-password':
                errorMessage = 'كلمة المرور غير صحيحة';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'تم تجاوز عدد المحاولات المسموح بها';
                break;
        }
        
        showToast(errorMessage, 'error');
    } finally {
        // إخفاء حالة التحميل
        btnText.style.display = 'block';
        loader.style.display = 'none';
    }
});
