// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAzAXOP8XqDmYUo5H1LtHrb4rSUkx8zZiI",
  authDomain: "aurastream-2071c.firebaseapp.com",
  databaseURL: "https://aurastream-2071c-default-rtdb.asia-southeast1.firebasedatabase.app", // Added for Realtime Database (Party Room)
  projectId: "aurastream-2071c",
  storageBucket: "aurastream-2071c.firebasestorage.app",
  messagingSenderId: "503710120478",
  appId: "1:503710120478:web:2c4ededd2bf836d293cc0f",
  measurementId: "G-HZW6R0D2B3"
};

// Initialize Firebase (using v8 compat mode as configured in index.html)
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase Initialized Successfully!");
} else {
  console.warn("Firebase SDK not loaded yet.");
}
