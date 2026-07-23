import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/lib/store";

export function AddCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (name: string) => void;
}) {
  const { list, add } = useCategories();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a category name.");
      return;
    }
    const dupe = list.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (dupe) {
      toast.error(`"${dupe}" already exists.`);
      onCreated(dupe);
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await add(trimmed);
      onCreated(trimmed);
      toast.success(`Added "${trimmed}"`);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="e.g. Pet supplies"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Add category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const ADD_CATEGORY_SENTINEL = "__add_new_category__";
