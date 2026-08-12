import "./style.css";
import "./widget";

const signupForm = document.querySelector<HTMLFormElement>("#signup-form");
const successMessage = document.querySelector<HTMLElement>("#form-success");
const demoEmail = document.querySelector<HTMLInputElement>("#work-email");
const outageControl = document.querySelector<HTMLInputElement>("#simulate-outage");
const demoWidget = demoEmail ? window.InboxValid.attach(demoEmail) : undefined;

outageControl?.addEventListener("change", () => {
  demoWidget?.setOutageSimulation(outageControl.checked);
});

signupForm?.addEventListener("submit", (event) => {
  if (event.defaultPrevented) return;
  event.preventDefault();
  if (successMessage) {
    successMessage.hidden = false;
    successMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
});

signupForm?.addEventListener("input", () => {
  if (successMessage) successMessage.hidden = true;
});

const copyButton = document.querySelector<HTMLButtonElement>("#copy-code");
const integrationCode = document.querySelector<HTMLElement>("#integration-code");

copyButton?.addEventListener("click", async () => {
  if (!integrationCode) return;
  try {
    await navigator.clipboard.writeText(integrationCode.textContent ?? "");
    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = "Copy code";
    }, 1_500);
  } catch {
    copyButton.textContent = "Select code to copy";
  }
});
