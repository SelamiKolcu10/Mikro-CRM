import api from './api';

// Same endpoints the web panel uses. List → res.data.data (array), each deal
// with computed `weightedValue` + populated customer/owner. Mutations return
// the updated deal (also with computed fields).
const dealService = {
  getAll: () => api.get('/deals'),
  update: (id, payload) => api.patch(`/deals/${id}`, payload),
  // expectedVersion is optional server-side, so we skip optimistic concurrency
  // here — stage change also resets probability to the stage default.
  updateStage: (id, stage) => api.patch(`/deals/${id}/stage`, { stage }),
  getEvents: (id) => api.get(`/deals/${id}/events`),
  addNote: (id, note) => api.post(`/deals/${id}/notes`, { note }),
  create: (payload) => api.post('/deals', payload),
};

export default dealService;
