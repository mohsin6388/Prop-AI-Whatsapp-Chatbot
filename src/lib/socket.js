import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore.js";

const SOCKET_URL = "https://prop-ai-whatsapp-chatbot.onrender.com";

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
