document.querySelectorAll('nav a').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();  // Prevent the default anchor behavior
    
    const targetId = this.getAttribute('href').substring(1); // Get the target section's id
    const targetElement = document.getElementById(targetId);
    
    if (targetElement) {
      setTimeout(() => {  // Add a slight delay to allow layout recalculation
        window.scrollTo({
          top: targetElement.offsetTop - document.querySelector('header').offsetHeight, // Scroll with header height offset
          behavior: 'smooth'
        });
      }, 50); // 50ms delay (adjust if needed)
    } else {
      console.error(`Element with id "${targetId}" not found.`);
    }
  });
});


document.getElementById('menu-icon').addEventListener('click', function() {
  const navMenu = document.getElementById('nav-menu');
  const menuIcon = document.getElementById('menu-icon');
  navMenu.classList.toggle('show');
  menuIcon.classList.toggle('open');
});
