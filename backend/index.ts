import { createApp } from "./app";
import { config } from "./config";

const app = createApp();

app.listen(config.port, () => {
  console.log(
    `PRISM backend listening on :${config.port} (${config.env}, ${config.solana.network})`
  );
});
