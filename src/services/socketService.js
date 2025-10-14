// src/services/socketService.js
import { Server } from 'socket.io';

let ioInstance = null;

/**
 * initSocket(httpServer)
 * - Attaches Socket.IO to the provided http server and registers handlers.
 */
export function initSocket(httpServer) {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/socket.io'
  });

  console.log('Socket.IO initializing...');

  ioInstance.on('connection', (socket) => {
    // log handshake info to help debugging
    console.log('Socket connected:', socket.id, 'handshake:', socket.handshake && (socket.handshake.auth || socket.handshake.query));

    // Mechanic registers to join their room
    // client should emit: socket.emit('mechanic_register', { mechanicId }, cb)
    socket.on('mechanic_register', (data, callback) => {
      try {
        if (!data || !data.mechanicId) {
          const msg = 'mechanic_register requires { mechanicId }';
          if (callback) callback({ ok: false, message: msg });
          return;
        }
        const mechanicId = data.mechanicId.toString();
        const room = `mechanic_${mechanicId}`;
        socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
        if (callback) callback({ ok: true, message: `joined ${room}` });

        // optional: acknowledge back to this socket
        socket.emit('registered', { mechanicId, socketId: socket.id });
      } catch (err) {
        console.error('mechanic_register error', err);
        if (callback) callback({ ok: false, message: 'internal error' });
      }
    });

    // Mechanic responds (accept/reject). Payload example: { jobId, attemptIndex, response }
    socket.on('job_response', (payload, callback) => {
      console.log('job_response from socket', socket.id, payload);
      // TODO: validate & handle this (DB update, clear timer, create ticket etc.)
      if (callback) callback({ ok: true, message: 'server received response' });
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', socket.id, 'reason:', reason);
    });

    // debug ping handler
    socket.on('ping_server', (payload, cb) => {
      if (cb) cb({ ok: true, now: Date.now() });
    });
  });

  console.log('Socket.IO initialized');
  return ioInstance;
}

/**
 * attachTestRoutes(app)
 * Adds development/test endpoints to your express app to emit socket events easily.
 */
export function attachTestRoutes(app) {
  // POST /api/test/emit { mechanicId, event, payload }
  app.post('/api/test/emit', (req, res) => {
    const { mechanicId, event = 'job_alert', payload = {} } = req.body || {};
    if (!mechanicId) return res.status(400).json({ ok: false, message: 'mechanicId required' });
    if (!ioInstance) return res.status(500).json({ ok: false, message: 'socket not initialized' });

    const msg = { ...payload, testAt: new Date().toISOString() };
    console.log(`Emitting ${event} to mechanic_${mechanicId}`, msg);
    ioInstance.to(`mechanic_${mechanicId}`).emit(event, msg);
    return res.json({ ok: true, message: `Emitted ${event}` });
  });

  // GET /api/test/connected -> quick insight (dev)
  app.get('/api/test/connected', (req, res) => {
    if (!ioInstance) return res.status(500).json({ ok: false, message: 'socket not initialized' });
    const rooms = Array.from(ioInstance.sockets.adapter.rooms.keys()).slice(0, 50);
    return res.json({ ok: true, rooms });
  });
}

/**
 * Helper to allow other modules to emit programmatically:
 *   import { getIo } from './services/socketService.js'
 *   getIo().to('mechanic_...').emit('event', payload)
 */
export function getIo() {
  return ioInstance;
}
