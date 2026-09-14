"use client";

import { Button } from "@heroui/react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import type { CatalogRow } from "./product-insights";

export function ProductActionsDropdown({
  product,
  canManage,
  onView,
  onEdit,
  onDelete,
}: {
  product: CatalogRow;
  canManage: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Button
        isIconOnly
        size="sm"
        variant="flat"
        color="primary"
        radius="lg"
        aria-label={`View ${product.name}`}
        title="View"
        onPress={onView}
        className="h-9 w-9 min-w-9 bg-teal-50 text-teal-800"
      >
        <Eye size={16} />
      </Button>
      {canManage ? (
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          radius="lg"
          aria-label={`Edit ${product.name}`}
          title="Edit"
          onPress={onEdit}
          className="h-9 w-9 min-w-9 bg-slate-100 text-slate-800"
        >
          <Pencil size={16} />
        </Button>
      ) : null}
      {canManage ? (
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          color="danger"
          radius="lg"
          aria-label={`Delete ${product.name}`}
          title="Delete"
          onPress={onDelete}
          className="h-9 w-9 min-w-9 bg-red-50 text-red-700"
        >
          <Trash2 size={16} />
        </Button>
      ) : null}
    </div>
  );
}
