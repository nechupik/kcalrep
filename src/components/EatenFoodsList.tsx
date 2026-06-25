import { useState } from "react";
import { Card } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiaryEntry } from "@/lib/storage";

const VISIBLE_COUNT = 4;

interface EatenFoodsListProps {
  entries: DiaryEntry[];
  onRemove: (id: string) => void;
  onEdit?: (entry: DiaryEntry) => void;
  className?: string;
}

export const EatenFoodsList = ({ entries, onRemove, onEdit, className }: EatenFoodsListProps) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleRemoveEntry = (id: string) => {
    setEntryToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    await onRemove(entryToDelete);
    setDeleteConfirmOpen(false);
    setEntryToDelete(null);
  };

  const cancelDelete = () => {
    setDeleteConfirmOpen(false);
    setEntryToDelete(null);
  };

  if (entries.length === 0) return null;

  const sorted = entries.slice().sort((a, b) => b.addedAt - a.addedAt);
  const hasMore = sorted.length > VISIBLE_COUNT;
  const visible = expanded ? sorted : sorted.slice(0, VISIBLE_COUNT);
  const hiddenCount = sorted.length - VISIBLE_COUNT;

  return (
    <>
      <Card className={`w-full p-6 md:p-8 shadow-soft border-border/50 backdrop-blur-sm bg-card/80 ${className || ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Съедено</h3>
          <span className="text-xs text-muted-foreground">{entries.length} шт.</span>
        </div>
        <div className="space-y-2">
          {visible.map((e) => (
            <div
              key={e.id}
              className={`flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5 group hover:bg-muted/70 transition-smooth ${onEdit ? 'cursor-pointer' : ''}`}
              onClick={() => onEdit && onEdit(e)}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{e.name}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="text-macro-calories font-semibold">{e.calories}</span> ккал ·
                  Б {e.protein}г · Ж {e.fat}г · У {e.carbs}г
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="text-xs text-muted-foreground">
                  {e.addedAt ? (() => { const d = new Date(e.addedAt); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })() : ''}
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemoveEntry(e.id);
                  }}
                  className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-smooth p-1"
                  aria-label="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <button
            onClick={() => setExpanded(o => !o)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-smooth py-1.5 rounded-lg hover:bg-muted/40"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", expanded && "rotate-180")} />
            {expanded ? "Скрыть" : `Ещё ${hiddenCount}`}
          </button>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить "{entryToDelete ? entries.find(e => e.id === entryToDelete)?.name : ''}"? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
