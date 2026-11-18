import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserRoleCode } from '@/types/database';
import { ROLE_LABELS } from '@/lib/permissions';

interface ModulePageScaffoldProps {
  title: string;
  description: string;
  phaseBadge: string;
  allowedRoles: UserRoleCode[];
  children?: React.ReactNode;
}

export function ModulePageScaffold({
  title,
  description,
  phaseBadge,
  allowedRoles,
  children,
}: ModulePageScaffoldProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{phaseBadge}</Badge>
          {allowedRoles.map((role) => (
            <Badge key={role} variant="outline">
              {ROLE_LABELS[role]}
            </Badge>
          ))}
        </div>
      </div>

      {children ?? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Rute, proteksi autentikasi, dan otorisasi peran (RBAC) telah aktif
            pada Phase 1. Implementasi logika bisnis penuh modul ini dijadwalkan
            pada fase berikutnya sesuai rencana arsitektur.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
