import { Utensils } from 'lucide-react';
import Link from 'next/link';
import type { FC } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  colorClassName?: string;
  showText?: boolean;
  href?: string;
}

const Logo: FC<LogoProps> = ({ size = 'md', colorClassName = 'text-primary', showText = true, href = "/" }) => {
  const iconSize = size === 'sm' ? 'h-6 w-6' : size === 'md' ? 'h-8 w-8' : 'h-10 w-10';
  const textSize = size === 'sm' ? 'text-xl' : size === 'md' ? 'text-2xl' : 'text-3xl';

  const LogoContent = () => (
    <div className="flex items-center gap-2">
      <Utensils className={`${iconSize} ${colorClassName}`} />
      {showText && <span className={`${textSize} font-headline font-bold ${colorClassName}`}>Table Maestro</span>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block" aria-label="Table Maestro Home">
        <LogoContent />
      </Link>
    );
  }

  return <LogoContent />;
};

export default Logo;
