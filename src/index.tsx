import { render } from "ink";
import { App } from "./app";
import { ConfigProvider } from "./config/hook";

/** Entry point. Renders the root App component via Ink. */
function main() {
  render(
    <ConfigProvider>
      <App />
    </ConfigProvider>,
  );
}

main();
