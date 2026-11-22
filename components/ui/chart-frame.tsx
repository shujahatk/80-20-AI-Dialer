import React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from './card';
import { cn } from '@/lib/utils';

export function ChartFrame({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      {children}
    </Card>
  );
}
