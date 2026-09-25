import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore.js';

const SOCKET_URL = 'https://real-estate-backend-n7h1.onrender.com'

let socket = null;

export function getSocket() {
  if (socket) return socket;
  const { accessToken } = useAuthStore.getState();
  socket = io(SOCKET_URL, {
    auth: { token: accessToken },
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
