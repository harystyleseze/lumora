import { Router } from 'express';
import { listServices, getService, getServiceStats } from '../db/queries/services.js';

const router = Router();

router.get('/services', (_req, res) => {
  const services = listServices(true);
  res.json({ services });
});

router.get('/services/:id', (req, res) => {
  const service = getService(req.params['id']!);
  if (!service) {
    res.status(404).json({ error: 'Service not found' });
    return;
  }
  const stats = getServiceStats(service.id);
  res.json({ service: { ...service, stats } });
});

export default router;
