/**
 * Parses a Server-Sent Events stream, yielding the data payload of each event.
 * Handles buffering of partial lines across chunks.
 * Returns when it encounters `data: [DONE]` or the stream ends.
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, "");
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          yield data;
        }
      }
    }

    // Handle remaining buffer after stream ends
    const remaining = buffer.replace(/\r$/, "");
    if (remaining.startsWith("data: ")) {
      const data = remaining.slice(6);
      if (data !== "[DONE]") yield data;
    }
  } finally {
    reader.releaseLock();
  }
}
