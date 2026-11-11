import { useState } from 'react';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import type { HistorySummary, SavedRequest } from '@/types/models';
import { CollectionsPanel } from './CollectionsPanel';
import { HistoryPanel } from './HistoryPanel';

interface TesterRailProps {
  activeRequestId: string | null;
  onOpenSaved: (request: SavedRequest) => void;
  onOpenHistory: (entry: HistorySummary) => void;
}

/** Saved collections and request history, side by side with the editor. */
export function TesterRail({ activeRequestId, onOpenSaved, onOpenHistory }: TesterRailProps) {
  const [tab, setTab] = useState<'collections' | 'history'>('collections');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        idBase="tester-rail"
        label="Saved requests and history"
        value={tab}
        onChange={setTab}
        size="sm"
        items={[
          { value: 'collections', label: 'Collections' },
          { value: 'history', label: 'History' },
        ]}
      />
      <TabPanel idBase="tester-rail" value={tab} className="flex min-h-0 flex-1 flex-col pt-3">
        {tab === 'collections' ? (
          <CollectionsPanel activeRequestId={activeRequestId} onOpen={onOpenSaved} />
        ) : (
          <HistoryPanel onOpen={onOpenHistory} />
        )}
      </TabPanel>
    </div>
  );
}
