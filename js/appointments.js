// إدارة المواعيد (التفاوض وتحديث الحالة)
import { db, auth } from '../js/firebase-config.js';
import { doc, updateDoc, serverTimestamp, addDoc, collection, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';

let currentUserId = null;
onAuthStateChanged(auth, (u)=>{ currentUserId = u ? u.uid : null; });

async function _getApptRef(appointmentId){
  return doc(db,'appointments',appointmentId);
}

async function _createNotification(userId, title, body, extra={}){
  if(!userId) { console.warn('تخطي إشعار بدون userId'); return; }
  // اعتبار بسيط لصلاحية المعرّف (معرّفات Firebase UID عادة > 10)
  if(userId.length < 10) { console.warn('معرّف مستخدم غير متوقع للإشعار:', userId); return; }
  try {
    await addDoc(collection(db,'notifications'), { userId, title, body, type:'chat', read:false, createdAt: serverTimestamp(), ...extra });
    console.log('تم إنشاء إشعار للمستخدم', userId, title);
  } catch(e){ console.error('فشل إنشاء إشعار', e); }
}

function _extractParticipants(appt){
  const set = new Set();
  if(appt.barberId) set.add(appt.barberId);
  if(appt.customerId) set.add(appt.customerId);
  if(appt.createdBy) set.add(appt.createdBy);
  return Array.from(set);
}

async function _notifyParticipants(appt, excludingUserId, title, body, extra={}){
  const participants = _extractParticipants(appt).filter(uid=>uid && uid!==excludingUserId);
  for(const uid of participants){
    await _createNotification(uid, title, body, { appointmentId: appt.id || extra.appointmentId, ...extra, from: excludingUserId });
  }
}

export async function proposeNewTime(appointmentId, date, time){
  if(!currentUserId) throw new Error('مطلوب تسجيل الدخول');
  const ref = await _getApptRef(appointmentId);
  await updateDoc(ref, {
    proposedSlot:{date,time, by: currentUserId, createdAt: serverTimestamp()},
    status:'reschedule_pending',
    lastActionBy: currentUserId,
    updatedAt: serverTimestamp()
  });
  const snap = await getDoc(ref);
  if(snap.exists()){
    const appt = { id: appointmentId, ...snap.data() };
    await _notifyParticipants(appt, currentUserId, 'اقتراح موعد جديد', `تم اقتراح تعديل الموعد إلى ${date} ${time}`, { action:'propose' });
  }
}

export async function acceptProposal(appointmentId){
  if(!currentUserId) throw new Error('مطلوب تسجيل الدخول');
  const ref = await _getApptRef(appointmentId);
  const snap = await getDoc(ref);
  if(!snap.exists()) throw new Error('الموعد غير موجود');
  const data = snap.data();
  if(!data.proposedSlot) throw new Error('لا يوجد اقتراح');
  await updateDoc(ref, {
    currentSlot: data.proposedSlot,
    proposedSlot: null,
    status:'confirmed',
    lastActionBy: currentUserId,
    updatedAt: serverTimestamp()
  });
  const updated = await getDoc(ref);
  if(updated.exists()){
    const appt = { id: appointmentId, ...updated.data() };
    await _notifyParticipants(appt, currentUserId, 'تم قبول التعديل', 'تم قبول اقتراح تعديل الموعد', { action:'accept' });
  }
}

export async function rejectProposal(appointmentId){
  if(!currentUserId) throw new Error('مطلوب تسجيل الدخول');
  const ref = await _getApptRef(appointmentId);
  await updateDoc(ref, {
    proposedSlot: null,
    status:'confirmed',
    lastActionBy: currentUserId,
    updatedAt: serverTimestamp()
  });
  const snap = await getDoc(ref);
  if(snap.exists()){
    const appt = { id: appointmentId, ...snap.data() };
    await _notifyParticipants(appt, currentUserId, 'تم رفض التعديل', 'تم رفض اقتراح تعديل الموعد', { action:'reject' });
  }
}

export async function cancelAppointment(appointmentId){
  if(!currentUserId) throw new Error('مطلوب تسجيل الدخول');
  const ref = await _getApptRef(appointmentId);
  await updateDoc(ref, {
    status:'cancelled',
    lastActionBy: currentUserId,
    updatedAt: serverTimestamp()
  });
  const snap = await getDoc(ref);
  if(snap.exists()){
    const appt = { id: appointmentId, ...snap.data() };
    await _notifyParticipants(appt, currentUserId, 'إلغاء الموعد', 'تم إلغاء الموعد', { action:'cancel' });
  }
}

export async function completeAppointment(appointmentId){
  if(!currentUserId) throw new Error('مطلوب تسجيل الدخول');
  const ref = await _getApptRef(appointmentId);
  await updateDoc(ref, {
    status:'completed',
    lastActionBy: currentUserId,
    updatedAt: serverTimestamp()
  });
  const snap = await getDoc(ref);
  if(snap.exists()){
    const appt = { id: appointmentId, ...snap.data() };
    await _notifyParticipants(appt, currentUserId, 'انتهاء الموعد', 'تم وضع علامة مكتمل على الموعد', { action:'complete' });
  }
}

export async function confirmAppointmentWithNotification(appointmentId){
  if(!currentUserId) throw new Error('مطلوب تسجيل الدخول');
  const ref = await _getApptRef(appointmentId);
  await updateDoc(ref, { status:'confirmed', lastActionBy: currentUserId, updatedAt: serverTimestamp() });
  const snap = await getDoc(ref);
  if(snap.exists()){
    const appt = { id: appointmentId, ...snap.data() };
    await _notifyParticipants(appt, currentUserId, 'تأكيد الموعد', 'تم تأكيد موعدك', { action:'confirm' });
  }
}

export async function cancelAppointmentWithNotification(appointmentId){
  return cancelAppointment(appointmentId); // يعيد استخدامها مع إشعار
}

// إرسال رسالة نصية
export async function sendTextMessage(appointmentId, text){
  if(!currentUserId) throw new Error('مطلوب تسجيل الدخول');
  text = (text||'').trim();
  if(!text) return;
  const chatRef = collection(db,'appointmentChats',appointmentId,'messages');
  await addDoc(chatRef, {
    senderId: currentUserId,
    type:'text',
    text,
    createdAt: serverTimestamp()
  });
  const apptSnap = await getDoc(doc(db,'appointments',appointmentId));
  if(apptSnap.exists()){
    const appt = apptSnap.data();
    const participants = _extractParticipants(appt).filter(uid=>uid!==currentUserId);
    if(!participants.length){ console.warn('لا يوجد طرف آخر لإشعاره'); }
    for(const uid of participants){
      await _createNotification(uid, 'رسالة جديدة', text.slice(0,60), { appointmentId, from: currentUserId });
    }
  } else {
    console.warn('لم يتم العثور على الموعد لإنشاء إشعار');
  }
}

// إرسال رسالة صوتية (بعد رفعها وجلب url)
export async function sendVoiceMessage(appointmentId, audioUrl, durationSec){
  if(!currentUserId) throw new Error('مطلوب تسجيل الدخول');
  if(!audioUrl) return;
  const chatRef = collection(db,'appointmentChats',appointmentId,'messages');
  await addDoc(chatRef, {
    senderId: currentUserId,
    type:'voice',
    audioUrl,
    durationSec: durationSec || null,
    createdAt: serverTimestamp()
  });
  const apptSnap = await getDoc(doc(db,'appointments',appointmentId));
  if(apptSnap.exists()){
    const appt = apptSnap.data();
    const participants = _extractParticipants(appt).filter(uid=>uid!==currentUserId);
    for(const uid of participants){
      await _createNotification(uid, 'رسالة صوتية', 'لديك رسالة صوتية جديدة', { appointmentId, from: currentUserId });
    }
  }
}
