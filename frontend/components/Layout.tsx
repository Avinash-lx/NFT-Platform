import { FC, ReactNode } from "react";
import Link from "next/link";
import { WalletButton } from "./WalletButton";

/** Shared page shell: top navigation + content container. */
export const Layout: FC<{ children: ReactNode }> = ({ children }) => (
  <>
    <header className="container">
      <nav className="nav">
        <div className="row" style={{ gap: 28 }}>
          <Link href="/" className="brand">
            PRISM
          </Link>
          <div className="nav-links">
            <Link href="/marketplace">Marketplace</Link>
            <Link href="/create">Create</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
        </div>
        <WalletButton />
      </nav>
    </header>
    <main className="container">{children}</main>
  </>
);
