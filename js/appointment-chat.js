// واجهة الدردشة للموعد الواحد
import { db, auth } from '../js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { doc, onSnapshot, collection, query, orderBy } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { sendTextMessage, sendVoiceMessage, proposeNewTime, acceptProposal, rejectProposal, cancelAppointment, completeAppointment } from './appointments.js';
import { uploadToCloudinaryGeneric } from '../js/cloudinary-config.js';

let currentUserId = null;
onAuthStateChanged(auth, (u)=>{ currentUserId = u ? u.uid : null; });

// عناصر الواجهة (يجب أن تكون معرفاتها موجودة بالصفحة)
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');
const recordBtn = document.getElementById('recordBtn');
const statusBadge = document.getElementById('statusBadge');
const proposeForm = document.getElementById('proposeForm');
const proposeDate = document.getElementById('proposeDate');
const proposeTime = document.getElementById('proposeTime');
const acceptBtn = document.getElementById('acceptProposalBtn');
const rejectBtn = document.getElementById('rejectProposalBtn');
const cancelBtn = document.getElementById('cancelApptBtn');
const completeBtn = document.getElementById('completeApptBtn');

function getAppointmentId(){
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}
const appointmentId = getAppointmentId();

if(!appointmentId){
  console.warn('لا يوجد معرف موعد بالرابط');
}

// الاستماع لتغييرات بيانات الموعد
if(appointmentId){
  onSnapshot(doc(db,'appointments',appointmentId), snap => {
    if(!snap.exists()) return;
    const data = snap.data();
    renderAppointmentState(data);
  });
  // الاستماع للرسائل
  const q = query(collection(db,'appointmentChats',appointmentId,'messages'), orderBy('createdAt','asc'));
  onSnapshot(q, (qs)=>{
    messagesContainer.innerHTML = '';
    qs.forEach(docSnap => {
      const msg = docSnap.data();
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (msg.senderId === currentUserId ? 'me':'other');
      if(msg.type === 'text'){
        div.textContent = msg.text || '';
      } else if(msg.type === 'voice') {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = msg.audioUrl;
        div.appendChild(audio);
        if(msg.durationSec) {
          const span = document.createElement('span');
            span.style.fontSize='0.75em';
            span.style.marginRight='6px';
            span.textContent = Math.round(msg.durationSec)+'s';
            div.appendChild(span);
        }
      }
      messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

function renderAppointmentState(data){
  if(statusBadge){
    statusBadge.textContent = translateStatus(data.status);
    statusBadge.className = 'status-badge status-' + data.status;
  }
  // إظهار/إخفاء عناصر الاقتراح
  const proposalBox = document.getElementById('proposalBox');
  if(data.proposedSlot){
    proposalBox.style.display='block';
    const proposedInfo = document.getElementById('proposedInfo');
    proposedInfo.textContent = `اقتراح جديد: ${data.proposedSlot.date} ${data.proposedSlot.time}`;
    // السماح بالقبول/الرفض للطرف الآخر فقط
    const isProposer = data.proposedSlot.by === currentUserId;
    if(acceptBtn) acceptBtn.style.display = isProposer ? 'none':'inline-block';
    if(rejectBtn) rejectBtn.style.display = isProposer ? 'none':'inline-block';
  } else {
    if(proposalBox) proposalBox.style.display='none';
  }
  // تعطيل زر اقتراح جديد أثناء وجود اقتراح معلق
  if(proposeForm){
    proposeForm.querySelector('button[type="submit"]').disabled = !!data.proposedSlot;
  }
}

function translateStatus(s){
  switch(s){
    case 'pending': return 'قيد الانتظار';
    case 'confirmed': return 'مؤكد';
    case 'reschedule_pending': return 'مقترح تعديل';
    case 'cancelled': return 'ملغي';
    case 'completed': return 'مكتمل';
    default: return s || '';
  }
}

// إرسال نص
if(sendMsgBtn){
  sendMsgBtn.onclick = async ()=>{
    try { await sendTextMessage(appointmentId, messageInput.value); messageInput.value=''; } catch(e){ console.error(e); }
  };
}

// تسجيل صوت
let mediaRecorder = null; let chunks=[]; let isRecording=false; let startTime=0;
if(recordBtn){
  recordBtn.onclick = async ()=>{
    if(!isRecording){
      try {
        const stream = await navigator.mediaDevices.getUserMedia({audio:true});
        mediaRecorder = new MediaRecorder(stream);
        chunks=[]; isRecording=true; startTime=Date.now();
        recordBtn.textContent='إيقاف';
        mediaRecorder.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
        mediaRecorder.onstop = async ()=>{
          const blob = new Blob(chunks,{type:'audio/webm'});
          const durationSec = (Date.now()-startTime)/1000;
          const url = await uploadVoiceBlob(blob); // دالة رفع
          await sendVoiceMessage(appointmentId, url, durationSec);
          recordBtn.textContent='🎤'; isRecording=false;
        };
        mediaRecorder.start();
      } catch(e){ console.error('فشل بدء التسجيل', e); }
    } else {
      mediaRecorder.stop();
    }
  };
}

// رفع الصوت (يمكن دمجه مع Cloudinary)
async function uploadVoiceBlob(blob){
  try {
    const { url } = await uploadToCloudinaryGeneric(blob, { folder: 'barberapp/voices', resourceType: 'video' });
    triggerLocalNotification('تم إرسال رسالة صوتية');
    return url;
  } catch(e){
    console.error('فشل رفع الصوت', e); return '';
  }
}

// اقتراح موعد
if(proposeForm){
  proposeForm.onsubmit = async (e)=>{
    e.preventDefault();
    try { await proposeNewTime(appointmentId, proposeDate.value, proposeTime.value); proposeForm.reset(); } catch(e){ console.error(e); }
  };
}

if(acceptBtn){ acceptBtn.onclick = ()=> acceptProposal(appointmentId).catch(console.error); }
if(rejectBtn){ rejectBtn.onclick = ()=> rejectProposal(appointmentId).catch(console.error); }
if(cancelBtn){ cancelBtn.onclick = ()=> cancelAppointment(appointmentId).catch(console.error); }
if(completeBtn){ completeBtn.onclick = ()=> completeAppointment(appointmentId).catch(console.error); }

function triggerLocalNotification(body){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'granted') {
    new Notification(body);
  } else if(Notification.permission !== 'denied') {
    Notification.requestPermission().then(p=>{ if(p==='granted') new Notification(body); });
  }
}
