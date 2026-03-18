import { render } from "ink";
import { App } from "./app";

const { waitUntilExit } = render(<App />);
await waitUntilExit();
