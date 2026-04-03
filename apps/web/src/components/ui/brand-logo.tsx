import Image from "next/image";

export function BrandLogo({
  size = 36,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="SkillSet.ai"
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      priority={priority}
    />
  );
}
