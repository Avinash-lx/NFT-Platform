import type { AppProps } from "next/app";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "@/wallet/WalletProvider";
import { Layout } from "@/components/Layout";
import "@/styles/globals.css";

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
