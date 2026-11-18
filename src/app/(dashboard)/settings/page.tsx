import { requireAuthenticatedUser } from '@/lib/permissions/server';
import { ModulePageScaffold } from '@/components/layout/module-page-scaffold';

export default async function SettingsPage() {
  await requireAuthenticatedUser(['OWNER']);
  return (
    <ModulePageScaffold
      title="Pengaturan Sistem & Integrasi Webhook n8n"
      description="Konfigurasi profil usaha, ambang peringatan kedaluwarsa, serta pemantauan antrean Webhook Outbox n8n."
      phaseBadge="Phase 5 — Automation & Settings"
      allowedRoles={['OWNER']}
    />
  );
}
