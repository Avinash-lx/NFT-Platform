import type { AppProps } from "next/app";
import { Buffer } from "buffer";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "@/wallet/WalletProvider";
import { Layout } from "@/components/Layout";
import "@/styles/globals.css";

// Solana web3.js / Anchor expect a Buffer global, which Next.js does not provide
// in the browser by default.
if (typeof window !== "undefined") {
  window.Buffer = window.Buffer ?? Buffer;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: "#15151f", color: "#eef0f6", border: "1px solid #2a2a3c" },
        }}
      />
    </WalletProvider>
  );
}
