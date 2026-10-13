import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore.js";
import { API_BASE_URL } from "../api/axios.js";

// API jis server pe hai, socket bhi wahin: "http://localhost:5000/api/" -> "http://localhost:5000"
// (pehle hardcoded Render URL tha, isliye local backend ke live events frontend tak nahi pahunchte the)
const SOCKET_URL = new URL(API_BASE_URL).origin;

let socket = null;

export function getSocket() {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    // Function form: har (re)connect par ABHI ka access token jata hai.
    // (Pehle token ek baar fix ho jata tha; 15 min baad expire hone par
    // reconnect fail ho jata tha.)
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
