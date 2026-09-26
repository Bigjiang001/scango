import { useEffect, useState, type ImgHTMLAttributes } from "react";
export function BlobImage({
  blob,
  ...props
}: { blob: Blob } & ImgHTMLAttributes<HTMLImageElement>) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return <img {...props} src={url || undefined} />;
}
