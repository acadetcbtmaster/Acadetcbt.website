import { Router } from 'express';
import { getPool } from '../../db/index.js';
import { handleApiError, requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user!.id;

    const result = await pool.query<{
      id: string;
      notificationType: 'admin_direct' | 'payment_success' | 'system';
      title: string;
      message: string;
      senderName: string;
      courseId: string | null;
      courseCode: string | null;
      courseTitle: string | null;
      paymentId: string | null;
      actionLabel: string | null;
      actionUrl: string | null;
      createdAt: Date;
      readAt: Date | null;
    }>(
      `SELECT
         n.id,
         n.notification_type AS "notificationType",
         n.title,
         n.message,
         n.sender_name AS "senderName",
         n.course_id AS "courseId",
         c.code AS "courseCode",
         c.title AS "courseTitle",
         n.payment_id AS "paymentId",
         n.action_label AS "actionLabel",
         n.action_url AS "actionUrl",
         n.created_at AS "createdAt",
         nr.read_at AS "readAt"
       FROM notifications n
       LEFT JOIN courses c ON c.id = n.course_id
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.id AND nr.user_id = $1
       WHERE n.recipient_user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 100`,
      [userId]
    );

    const notifications = result.rows.map((r) => ({
      ...r,
      isRead: Boolean(r.readAt),
    }));
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.json({ notifications, unreadCount });
  } catch (err) {
    handleApiError(res, err, 'fetching notifications');
  }
});

router.post('/:id/read', async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const notificationId = req.params.id;

    const ownerCheck = await pool.query<{ id: string }>(
      `SELECT id FROM notifications WHERE id = $1 AND recipient_user_id = $2 LIMIT 1`,
      [notificationId, userId]
    );

    if (ownerCheck.rows.length === 0) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }

    const readRes = await pool.query<{ readAt: Date }>(
      `INSERT INTO notification_reads (notification_id, user_id, read_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (notification_id, user_id)
       DO UPDATE SET read_at = notification_reads.read_at
       RETURNING read_at AS "readAt"`,
      [notificationId, userId]
    );

    res.json({
      notificationId,
      isRead: true,
      readAt: readRes.rows[0]?.readAt ?? new Date(),
    });
  } catch (err) {
    handleApiError(res, err, 'marking notification as read');
  }
});

router.post('/read-all', async (req, res) => {
  try {
    const pool = getPool();
    const userId = req.user!.id;

    const result = await pool.query(
      `INSERT INTO notification_reads (notification_id, user_id, read_at)
       SELECT n.id, $1, NOW()
       FROM notifications n
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.id AND nr.user_id = $1
       WHERE n.recipient_user_id = $1
         AND nr.id IS NULL
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [userId]
    );

    res.json({ ok: true, markedCount: result.rowCount ?? 0 });
  } catch (err) {
    handleApiError(res, err, 'marking all notifications as read');
  }
});

export default router;
