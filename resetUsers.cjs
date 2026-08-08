const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();
const db = getFirestore();

async function resetAllUsers() {
  console.log("מתחיל בתהליך המחיקה...");
  try {
    const listUsersResult = await auth.listUsers(1000);
    const uids = listUsersResult.users.map(user => user.uid);
    
    if (uids.length > 0) {
      console.log(`מוחק ${uids.length} משתמשים ממערכת ה-Auth...`);
      await auth.deleteUsers(uids);
      console.log("כל המשתמשים נמחקו בהצלחה ממערכת ההזדהות!");
    } else {
      console.log("לא נמצאו משתמשים במערכת ההזדהות.");
    }

    console.log("מוחק את כל הפרופילים מה-Firestore...");
    const usersSnapshot = await db.collection('users').get();
    
    if (!usersSnapshot.empty) {
      const batch = db.batch();
      usersSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`${usersSnapshot.size} פרופילים נמחקו בהצלחה ממסד הנתונים!`);
    } else {
      console.log("לא נמצאו פרופילים במסד הנתונים.");
    }
    
    console.log("תהליך האיפוס הושלם בהצלחה!");
  } catch (error) {
    console.log('שגיאה במהלך המחיקה:', error);
  }
}

resetAllUsers();