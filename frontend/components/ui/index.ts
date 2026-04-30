// frontend/src/components/ui/index.ts
// Barrel export — importá desde '@/components/ui'

export { default as Button }        from './Button';
export { default as Badge, eventTypeVariant, statusVariant, paymentVariant } from './Badge';
export { default as Card, CardHeader, CardBanner } from './Card';
export { default as SearchInput }   from './SearchInput';
export { default as TabGroup }      from './TabGroup';
export { default as Modal }         from './Modal';
export { default as EmptyState }    from './EmptyState';
export { default as LoadingSpinner } from './LoadingSpinner';
export { ToastProvider, useToast, StandaloneToast } from './Toast';
export { default as PageHeader }    from './PageHeader';
export { default as Select }        from './Select';
export { Input, Textarea, FormSelect } from './Input';