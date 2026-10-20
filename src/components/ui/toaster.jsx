import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.filter((t) => t.open !== false).map(function ({ id, title, description, action, open, onOpenChange, duration, ...props }) {
        return (
          // Tap anywhere on a notification to close it.
          <Toast key={id} {...props} onClick={() => dismiss(id)} role="status">
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose onClick={(e) => { e.stopPropagation(); dismiss(id); }} aria-label="Close notification" />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}