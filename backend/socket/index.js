const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Conversation = require('../models/Conversation');
const { PERMISSIONS } = require('../config/permissions');

const CHAT_ROLES = new Set(PERMISSIONS.chat.read);

// All internal sockets allowed to see chat join this room — used to push
// conversation-list-level updates (new message badge, reordering) to every
// support agent regardless of which single conversation they have open.
const STAFF_ROOM = 'staff-chat';
const conversationRoom = (conversationId) => `conversation:${conversationId}`;

let io = null;

/**
 * Trusts the JWT claims (role/id for staff, customerId for portal) the same
 * way the invoice microservices do — no DB lookup on every socket connect.
 * The REST endpoints that actually write data still re-verify against the
 * live DB via `protect`/`protectPortal`; sockets are only used here for room
 * membership and push delivery, never as the write path itself.
 */
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Not authorized — no token provided'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.aud === 'internal') {
      if (!CHAT_ROLES.has(decoded.role)) return next(new Error('Not authorized — chat not permitted for this role'));
      socket.data.accountType = 'internal';
      socket.data.userId = decoded.id;
      socket.data.role = decoded.role;
      return next();
    }

    if (decoded.aud === 'portal') {
      socket.data.accountType = 'customer';
      socket.data.customerId = decoded.customerId;
      return next();
    }

    return next(new Error('Not authorized — invalid token audience'));
  } catch (error) {
    return next(new Error('Not authorized — invalid token'));
  }
}

function initSocket(httpServer, { frontendUrl }) {
  io = new Server(httpServer, {
    cors: { origin: frontendUrl || 'http://localhost:5173', credentials: true },
  });

  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    if (socket.data.accountType === 'internal') {
      socket.join(STAFF_ROOM);

      // Staff explicitly join the one conversation they currently have open
      // so unrelated support agents don't receive every customer's messages.
      // Existence check is defensive, not an access-control boundary — every
      // chat-permitted role can already read every conversation via
      // GET /api/chat/conversations; this just avoids joining Socket.io to
      // rooms for garbage/stale IDs.
      socket.on('join-conversation', async (conversationId) => {
        if (!conversationId) return;
        try {
          const exists = await Conversation.exists({ _id: conversationId });
          if (exists) socket.join(conversationRoom(conversationId));
        } catch {
          // Malformed ObjectId or similar — silently ignore, nothing to join.
        }
      });
      socket.on('leave-conversation', (conversationId) => {
        if (conversationId) socket.leave(conversationRoom(conversationId));
      });
    }

    if (socket.data.accountType === 'customer') {
      // A customer has exactly one conversation — find or lazily create it
      // and join immediately so incoming staff replies arrive without the
      // customer having to take any action first.
      try {
        let conversation = await Conversation.findOne({ customer: socket.data.customerId });
        if (!conversation) {
          conversation = await Conversation.create({ customer: socket.data.customerId });
        }
        socket.data.conversationId = conversation._id.toString();
        socket.join(conversationRoom(conversation._id));
        socket.emit('conversation:init', { conversationId: conversation._id });
      } catch (err) {
        socket.emit('conversation:error', { error: 'Sohbet başlatılamadı.' });
      }
    }
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io henüz başlatılmadı.');
  return io;
}

module.exports = { initSocket, getIO, STAFF_ROOM, conversationRoom };
