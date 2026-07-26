import { ApiPill } from './ApiPill';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="header">
      <h1 className="header__title">{title}</h1>
      <div className="header__right">
        <ApiPill />
        <UserMenu />
      </div>
    </header>
  );
}
