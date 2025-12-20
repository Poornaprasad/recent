'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/utils';
import { getDocumentTypeBadgeClass } from '@/lib/utils/document-type-utils';
import { hasMultiStateAccess } from '@/hooks/use-state-filter';
import type { DocumentType } from '@/lib/domain/types';
import type { User } from '@/lib/domain/types';

interface DocumentTypeCellProps {
  documentType?: DocumentType;
  state?: string | null;
  user: User | null;
}

/**
 * Get color classes for state badge
 */
function getStateBadgeClass(state: string): string {
  switch (state) {
    case 'CA':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800';
    case 'NY':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-800';
  }
}

/**
 * Reusable component to display document type with optional state badge
 * Shows state badge only if user has access to multiple states
 * State badge shows shorthand (CA, NY) with color coding
 */
export function DocumentTypeCell({ documentType, state, user }: DocumentTypeCellProps) {
  if (!documentType) {
    return <span className="text-muted-foreground">-</span>;
  }

  const showStateBadge = hasMultiStateAccess(user) && state;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge 
        variant="outline" 
        className={cn(getDocumentTypeBadgeClass(documentType))}
      >
        {documentType}
      </Badge>
      {showStateBadge && (
        <Badge 
          variant="outline" 
          className={cn('text-xs font-semibold', getStateBadgeClass(state))}
        >
          {state}
        </Badge>
      )}
    </div>
  );
}

