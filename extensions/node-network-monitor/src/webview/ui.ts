import { copyToClipboard } from "./clipboard.js";

export function copyButton(getText: () => string, label = "Copy"): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nm-btn";
  button.textContent = label;
  button.addEventListener("click", () => {
    void copyToClipboard(getText()).then((ok) => {
      const original = label;
      button.textContent = ok ? "Copied!" : "Copy failed";
      setTimeout(() => {
        button.textContent = original;
      }, 1200);
    });
  });
  return button;
}
