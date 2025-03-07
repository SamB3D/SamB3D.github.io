document.addEventListener("DOMContentLoaded", () => {
  function getGMT1Time() {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utcTime + 3600000);
  }

  function updateTime() {
    const timeDisplay = document.getElementById("timeDisplay");
    if (!timeDisplay) return; // Safety check
    const gmt1Time = getGMT1Time();
    const formattedTime = gmt1Time.toLocaleTimeString("en-GB", { hour12: false });
    timeDisplay.textContent = " " + formattedTime;
  }

  updateTime();
  setInterval(updateTime, 1000);
});
