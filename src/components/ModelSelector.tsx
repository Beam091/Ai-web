import type { ProviderInfo, Selection } from '../types';
import { ChevronIcon } from './Icons';

interface ModelSelectorProps {
  providers: ProviderInfo[];
  selection: Selection | null;
  onChange: (selection: Selection) => void;
  disabled?: boolean;
}

const selectClass =
  'appearance-none rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-3 pr-8 text-xs text-zinc-200 transition hover:bg-white/[0.07] focus:border-indigo-400/60 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 disabled:cursor-not-allowed disabled:opacity-50';

export function ModelSelector({ providers, selection, onChange, disabled }: ModelSelectorProps) {
  const activeProvider = providers.find((provider) => provider.id === selection?.provider);
  const models = activeProvider?.models ?? [];

  return (
    <div className="flex items-center gap-2">
      <div className="relative hidden sm:block">
        <select
          aria-label="เลือกผู้ให้บริการ AI"
          className={`${selectClass} max-w-[150px]`}
          value={selection?.provider ?? ''}
          disabled={disabled}
          onChange={(event) => {
            const provider = providers.find((item) => item.id === event.target.value);
            if (!provider || provider.models.length === 0) return;
            onChange({ provider: provider.id, model: provider.models[0].id });
          }}
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id} disabled={!provider.available}>
              {provider.label}
              {!provider.available ? ' (ยังไม่ตั้งค่า)' : ''}
            </option>
          ))}
        </select>
        <ChevronIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
      </div>

      <div className="relative">
        <select
          aria-label="เลือกโมเดล"
          className={`${selectClass} max-w-[190px]`}
          value={selection?.model ?? ''}
          disabled={disabled || models.length === 0}
          onChange={(event) => {
            if (!selection) return;
            onChange({ provider: selection.provider, model: event.target.value });
          }}
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
        <ChevronIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
      </div>

      {selection?.provider === 'mock' && (
        <span className="hidden rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 sm:inline">
          DEMO
        </span>
      )}
    </div>
  );
}
