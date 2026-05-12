interface DownBannerProps {
  visible: boolean;
}

export function DownBanner({ visible }: DownBannerProps) {
  if (!visible) return null;
  return (
    <div className="banner-down" role="status" aria-live="polite">
      Backend unreachable — retrying. Check the backend process and your network.
    </div>
  );
}
