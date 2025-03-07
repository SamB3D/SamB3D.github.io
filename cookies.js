// cookie.js
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); // Expiry date
    const expires = "expires=" + date.toUTCString();
    
    // Constructing the cookie string
    const cookieString = `${name}=${value}; ${expires}; path=/; Secure; SameSite=None; Partitioned`;
    
    // Setting the cookie
    document.cookie = cookieString;
    console.log(`Cookie ${name} has been set with value: ${value}`);
  }
  
  // Example: Set a cookie for 'VISITOR_INFO1_LIVE' with value 'sampleValue' for 7 days
  setCookie("VISITOR_INFO1_LIVE", "sampleValue", 7);
  