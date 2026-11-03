import { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Product } from '@workspace/api-client-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

type Props = {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

const normalize = (text: string) => text.trim().toLocaleLowerCase().normalize('NFKC');

export function SaleProductSelect({ products, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const labelId = useId();
  const selected = products.find(product => product.id === value);
  const stock = (quantity: number) => quantity.toLocaleString('ar-SA');

  return <div className="form-field grow">
    <span id={labelId}>المنتج</span>
    <Popover open={open} onOpenChange={next => { setOpen(next); setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="button ghost"
          role="combobox"
          aria-expanded={open}
          aria-required="true"
          aria-labelledby={labelId}
          disabled={disabled}
          style={{ width: '100%', minHeight: 44, justifyContent: 'space-between', textAlign: 'right', fontWeight: 400 }}
          data-testid="select-sale-product"
        >
          <span>{selected ? `${selected.name} · متوفر ${stock(selected.stock)}` : 'اختر المنتج'}</span>
          <ChevronDown style={{ flexShrink: 0, width: 16 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        dir="rtl"
        style={{ zIndex: 60, width: 'var(--radix-popover-trigger-width)', padding: 0 }}
      >
        <Command
          filter={(_value, term, keywords) => normalize(keywords?.[0] ?? '').includes(normalize(term)) ? 1 : 0}
        >
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="اكتب اسم المنتج…"
            aria-label="البحث داخل قائمة المنتجات"
            autoComplete="off"
            data-testid="input-sale-product-select-search"
          />
          <CommandList style={{ maxHeight: 'min(240px, 40dvh)', overscrollBehavior: 'contain' }}>
            <CommandEmpty>لا يوجد منتج مطابق للاسم</CommandEmpty>
            {products.map(product => <CommandItem
              key={product.id}
              value={product.id}
              keywords={[product.name]}
              onSelect={() => { onChange(product.id); setOpen(false); setSearch(''); }}
              style={{ minHeight: 44, cursor: 'pointer' }}
              data-testid={`option-sale-product-${product.id}`}
            >
              <span style={{ flex: 1 }}>{product.name}<span className="subtle" style={{ display: 'block' }}>متوفر {stock(product.stock)}</span></span>
              {product.id === value && <Check aria-hidden="true" />}
            </CommandItem>)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>;
}
