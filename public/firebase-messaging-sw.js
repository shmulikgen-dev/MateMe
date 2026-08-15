importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyD8c6eaJI1TLJAPgKS4iF0gfqbjZ3dPow8",
  authDomain: "mateme-2f6e6.firebaseapp.com",
  projectId: "mateme-2f6e6",
  storageBucket: "mateme-2f6e6.firebasestorage.app",
  messagingSenderId: "387313337073",
  appId: "1:387313337073:web:86444908bb97f8155c5f50"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/icons/icon-192x192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
