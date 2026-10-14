import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonStyles = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: { default: "bg-violet text-white hover:bg-[#6546eb]", secondary: "bg-surface text-ink hover:bg-[#eceef2]", outline: "border border-line bg-white hover:bg-surface", ghost: "text-muted hover:bg-surface hover:text-ink" },
    size: { default: "h-10 px-4 py-2", sm: "h-9 rounded-lg px-3", icon: "size-9" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => <button ref={ref} className={cn(buttonStyles({ variant, size }), className)} {...props}/>);
Button.displayName = "Button";
