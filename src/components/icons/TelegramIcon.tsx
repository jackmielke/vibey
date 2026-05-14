import { SVGProps } from "react";

/**
 * Telegram glyph (paper plane) — reusable across the app.
 * Uses currentColor so it picks up text color from the parent.
 */
export function TelegramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path d="M21.426 2.574a1.5 1.5 0 0 0-1.62-.27L2.7 9.45c-.96.39-.93 1.77.045 2.115l4.32 1.515 1.65 5.295c.18.585.9.78 1.35.36l2.49-2.31 4.62 3.405c.585.435 1.425.12 1.59-.585l3.165-13.95a1.5 1.5 0 0 0-.504-1.521ZM9.6 14.4l-.495 3.495-1.245-3.99 9.69-6.27L9.6 14.4Z" />
    </svg>
  );
}
