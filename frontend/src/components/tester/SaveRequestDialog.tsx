import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/hooks/useToast';
import { useCollectionMutations, useCollections, useSavedRequestMutations } from '@/hooks/useWorkspace';
import { fieldErrorsFrom, errorMessage, type FieldErrors } from '@/lib/form-errors';
import { testerStore, toSavedInput, UNTITLED, type DraftRequest } from '@/lib/tester-store';

const NEW_COLLECTION = '__new__';

interface SaveRequestDialogProps {
  open: boolean;
  onClose: () => void;
  draft: DraftRequest;
  /** "Save as" always creates a new saved request. */
  saveAs: boolean;
}

function SaveForm({ onClose, draft, saveAs }: Omit<SaveRequestDialogProps, 'open'>) {
  const collections = useCollections();
  const { create: createCollection } = useCollectionMutations();
  const { create, replace } = useSavedRequestMutations();
  const toast = useToast();
  const firstCollection = collections.data?.[0]?.id ?? NEW_COLLECTION;
  const [name, setName] = useState(draft.name === UNTITLED ? '' : saveAs ? `${draft.name} copy` : draft.name);
  const [description, setDescription] = useState('');
  const [collectionId, setCollectionId] = useState(draft.collectionId ?? firstCollection);
  const [newCollection, setNewCollection] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const local: FieldErrors = {};
    if (!name.trim()) local.name = 'Give the request a name';
    if (collectionId === NEW_COLLECTION && !newCollection.trim()) local.newCollection = 'Name the new collection';
    setErrors(local);
    if (Object.keys(local).length) return;

    setPending(true);
    try {
      const targetCollection =
        collectionId === NEW_COLLECTION
          ? (await createCollection.mutateAsync({ name: newCollection.trim() })).id
          : collectionId;
      const input = toSavedInput(draft, {
        name: name.trim(),
        description: description.trim() || null,
        collectionId: targetCollection,
      });
      const saved =
        !saveAs && draft.savedRequestId
          ? await replace.mutateAsync({ id: draft.savedRequestId, input })
          : await create.mutateAsync(input);
      testerStore.markSaved(saved);
      toast.success('Request saved', saved.name);
      onClose();
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      toast.error('Request not saved', errorMessage(error));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Name" error={errors.name}>
        {(control) => (
          <Input
            {...control}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            placeholder="List products"
          />
        )}
      </Field>
      <Field label="Collection" error={errors.collectionId}>
        {(control) => (
          <Select {...control} value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
            {(collections.data ?? []).map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
            <option value={NEW_COLLECTION}>New collection…</option>
          </Select>
        )}
      </Field>
      {collectionId === NEW_COLLECTION ? (
        <Field label="New collection name" error={errors.newCollection}>
          {(control) => (
            <Input
              {...control}
              value={newCollection}
              onChange={(event) => setNewCollection(event.target.value)}
              maxLength={80}
              placeholder="Payments API"
            />
          )}
        </Field>
      ) : null}
      <Field label="Description" aside="Optional" error={errors.description}>
        {(control) => (
          <Textarea
            {...control}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            className="min-h-20"
            placeholder="What this request is for"
          />
        )}
      </Field>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {!saveAs && draft.savedRequestId ? 'Save changes' : 'Save request'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SaveRequestDialog({ open, onClose, draft, saveAs }: SaveRequestDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={saveAs || !draft.savedRequestId ? 'Save request' : 'Save changes'}
      description="Saved requests keep their {{variables}}, so they work in any environment."
    >
      <SaveForm onClose={onClose} draft={draft} saveAs={saveAs} />
    </Dialog>
  );
}
