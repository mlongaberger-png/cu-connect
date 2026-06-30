import { Button } from "@/components/ui/button";

export default function EmptyChannelState({ icon: Icon, message, ctaLabel, onCta }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 px-4 text-center">
      {Icon && <Icon className="w-9 h-9 text-muted-foreground opacity-30" />}
      <p className="text-sm text-muted-foreground">{message}</p>
      {ctaLabel && onCta && (
        <Button size="sm" variant="outline" onClick={onCta}>
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}