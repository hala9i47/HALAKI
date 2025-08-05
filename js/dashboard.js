// جلب بيانات المستخدم الحالي
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = '../index.html';
}

// تحديث معلومات المستخدم في الصفحة
document.getElementById('userName').textContent = currentUser.fullName;
document.getElementById('userPoints').textContent = currentUser.points;

// دالة العد التنازلي
function updateCountdown() {
    const lastHaircut = new Date(currentUser.lastHaircut);
    const nextHaircut = new Date(lastHaircut.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 يوم
    const now = new Date();
    
    const difference = nextHaircut - now;
    
    if (difference <= 0) {
        document.getElementById('countdown').innerHTML = 'حان موعد الحلاقة!';
        // إظهار إشعار للمستخدم
        if (Notification.permission === "granted") {
            new Notification("تذكير بموعد الحلاقة", {
                body: "حان موعد حلاقتك! هل تريد تحديد موعد؟",
                icon: "../images/barber-icon.png"
            });
        }
    } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        document.getElementById('countdown').innerHTML = `
            متبقي ${days} يوم و ${hours} ساعة للموعد القادم
        `;
    }
}

// تحديث العد التنازلي كل ساعة
updateCountdown();
setInterval(updateCountdown, 3600000);

// اقتراح موعد جديد
document.getElementById('suggestTime').addEventListener('click', function() {
    const chatSection = document.querySelector('.chat-section');
    chatSection.style.display = 'block';
    // هنا سيتم إضافة المزيد من المنطق للتواصل مع الحلاق
});

// إرسال رسالة في المحادثة
document.getElementById('sendMessage').addEventListener('click', function() {
    const message = document.getElementById('messageInput').value;
    if (message.trim()) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        document.getElementById('messageInput').value = '';
    }
});
