const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const CustomerUser = require('../models/CustomerUser');
const { PERMISSIONS } = require('../config/permissions');

const CHAT_ROLES = new Set(PERMISSIONS.chat.read);

// All internal sockets allowed to see chat join this room — used to push
// conversation-list-level updates (new message badge, reordering) to every
// support agent regardless of which single conversation they have open.
const STAFF_ROOM = 'staff-chat';
const conversationRoom = (conversationId) => `conversation:${conversationId}`;

// Kişiye özel oda — bildirimler buraya yayınlanır. STAFF_ROOM'dan bağımsız:
// oraya yalnız sohbet yetkisi olanlar girer, buraya oturumu olan HER personel
// girer (bkz. aşağıdaki bağlantı kapısı notu).
const userRoom = (userId) => `user:${userId}`;

let io = null;

/**
 * Authenticates a socket connection. Unlike a pure claims-trust handshake,
 * this re-checks the live DB the same way `protect`/`protectPortal` and the
 * invoice microservices do — the socket is itself a *read* channel (room
 * members receive `message:new` pushes), so a revoked/de-provisioned account
 * must be denied here too, not just on the REST write path. Verifying
 * tokenVersion + live status at connect time means a fired employee or a
 * revoked token can no longer keep receiving live pushes for the token's
 * remaining lifetime.
 *
 * "Bağlanabilir" ile "sohbeti okuyabilir" AYRI iki karardır. Bağlantı, oturumu
 * olan her onaylı personele açıktır — çünkü soket artık yalnız sohbet kanalı
 * değil, kişiye özel bildirim kanalı da (bkz. userRoom). Sohbet yetkisi
 * `socket.data.canChat` olarak taşınır ve SADECE STAFF_ROOM'a ve konuşma
 * odalarına katılımı belirler.
 *
 * Bu ayrım olmadan `accountant` sokete hiç bağlanamıyordu; oysa
 * tasks.getAssignableUsers role bakmadığı için bir muhasebeci pekâlâ görev
 * atanan kişi olabiliyor — yani kendisine ait bildirimi asla alamıyordu.
 */
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Not authorized — no token provided'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.aud === 'internal') {
      const live = await User.findById(decoded.id).select('role status tokenVersion').lean();
      if (!live || live.status !== 'approved') return next(new Error('Not authorized'));
      if ((decoded.tokenVersion || 0) !== (live.tokenVersion || 0)) return next(new Error('Not authorized — token revoked'));
      socket.data.accountType = 'internal';
      socket.data.userId = decoded.id;
      // Rol her zaman canlı dokümandan okunur, token'dan değil — sohbet
      // yetkisinin alınması anında etkili olur.
      socket.data.role = live.role;
      socket.data.canChat = CHAT_ROLES.has(live.role);
      return next();
    }

    if (decoded.aud === 'portal') {
      const cu = await CustomerUser.findById(decoded.id).select('status customer tokenVersion').lean();
      if (!cu || cu.status !== 'active') return next(new Error('Not authorized'));
      if ((decoded.tokenVersion || 0) !== (cu.tokenVersion || 0)) return next(new Error('Not authorized — token revoked'));
      socket.data.accountType = 'customer';
      // customer ref from the live record, not the token, in case the token
      // predates a record change.
      socket.data.customerId = cu.customer;
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
      // Bildirim kanalı — sohbet yetkisinden bağımsız, her personel kendi
      // odasına girer.
      socket.join(userRoom(socket.data.userId));

      // Sohbetle ilgili odalara YALNIZ sohbet yetkisi olanlar girer. Buradaki
      // erken çıkış olmazsa, bağlantıyı tüm rollere açmak STAFF_ROOM'a
      // yayınlanan müşteri mesajlarını yetkisiz rollere sızdırırdı.
      if (!socket.data.canChat) return;

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

module.exports = { initSocket, getIO, STAFF_ROOM, conversationRoom, userRoom };
