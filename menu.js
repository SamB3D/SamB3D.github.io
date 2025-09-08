document.getElementById('menu-icon').addEventListener('click', function() {
  const navMenu = document.getElementById('nav-menu');
  const menuIcon = document.getElementById('menu-icon');
  navMenu.classList.toggle('show');
  menuIcon.classList.toggle('open');
});
