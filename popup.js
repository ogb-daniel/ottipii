document.addEventListener("DOMContentLoaded", () => {
  //   const button = document.getElementById("check-otp");
  const display = document.getElementById("otp-display");
  const copyIcon = document.getElementById("copy-icon");
  copyIcon.style.display = "none";
  const checkIcon = document.getElementById("check-icon");
  checkIcon.style.display = "none";
  copyIcon.addEventListener("click", () => {
    navigator.clipboard.writeText(display.textContent);
    copyIcon.style.display = "none";
    checkIcon.style.display = "block";
    checkIcon.style.color = "green";
    setTimeout(() => {
      copyIcon.style.display = "block";
      checkIcon.style.display = "none";
    }, 2000);
  });
  //   button.addEventListener("click", () => {
  display.textContent = "Scanning Gmail...";
  chrome.runtime.sendMessage({ action: "fetch_otp" }, (response) => {
    if (response && response.success) {
      if (response.otp) {
        display.textContent = response.otp;
        display.style.letterSpacing = "0.1rem";
        copyIcon.style.display = "block";
      } else {
        display.textContent = "No OTP found";
        copyIcon.style.display = "none";
      }
    } else {
      display.textContent = "Error: " + (response?.error || "Unknown");
      copyIcon.style.display = "none";
    }
  });
  //   });
});
