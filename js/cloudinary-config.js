// تكوين Cloudinary
const cloudinaryConfig = {
    cloudName: 'dhixv7vvh',
    uploadPreset: 'barberapp_unsigned', // يجب إنشاء unsigned upload preset في لوحة تحكم Cloudinary
    folder: 'barberapp' // المجلد الافتراضي للصور
};

// دالة لرفع الصور إلى Cloudinary
async function uploadToCloudinary(file, customFolder = '') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('folder', customFolder || cloudinaryConfig.folder);

    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        const data = await response.json();
        return {
            url: data.secure_url,
            publicId: data.public_id
        };
    } catch (error) {
        console.error('خطأ في رفع الصورة:', error);
        throw error;
    }
}

// دالة لحذف الصور من Cloudinary
async function deleteFromCloudinary(publicId) {
    // تحتاج إلى إعداد API على الخادم الخاص بك للقيام بعملية الحذف
    // لأن عمليات الحذف تتطلب مصادقة آمنة
    try {
        const response = await fetch('/api/deleteImage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ publicId })
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('خطأ في حذف الصورة:', error);
        throw error;
    }
}

// دالة لتحويل حجم الصورة وتحسينها
function getOptimizedImageUrl(url, width = 500, height = 500, quality = 'auto') {
    // تحويل URL Cloudinary إلى نسخة محسنة
    return url.replace('/upload/', `/upload/w_${width},h_${height},c_fill,q_${quality}/`);
}

export {
    cloudinaryConfig,
    uploadToCloudinary,
    deleteFromCloudinary,
    getOptimizedImageUrl
};
