// تسجيل Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// المستخدمين المسجلين (في الواقع سيكون هناك قاعدة بيانات)
let users = JSON.parse(localStorage.getItem('users')) || [];

// التعامل مع نموذج التسجيل
document.getElementById('register').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const newUser = {
        fullName: document.getElementById('fullName').value,
        phoneNumber: document.getElementById('phoneNumber').value,
        lastHaircut: document.getElementById('lastHaircut').value,
        password: document.getElementById('password').value,
        points: 0,
        appointments: []
    };

    // التحقق من عدم وجود المستخدم مسبقاً
    if (users.find(user => user.phoneNumber === newUser.phoneNumber)) {
        alert('رقم الهاتف مسجل مسبقاً');
        return;
    }

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    alert('تم التسجيل بنجاح!');
    window.location.href = 'pages/customer-dashboard.html';
});

// التعامل مع تسجيل الدخول
document.getElementById('login').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const phone = document.getElementById('loginPhone').value;
    const password = document.getElementById('loginPassword').value;

    const user = users.find(u => u.phoneNumber === phone && u.password === password);
    
    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        window.location.href = 'pages/customer-dashboard.html';
    } else {
        alert('رقم الهاتف أو كلمة المرور غير صحيحة');
    }
});
