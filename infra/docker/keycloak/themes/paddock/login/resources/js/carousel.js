(function () {
  var current = 0;

  document.addEventListener('DOMContentLoaded', function () {
    var slides = document.querySelectorAll('.slide');
    var dots   = document.querySelectorAll('.dot');

    if (!slides.length) return;

    function goTo(n) {
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = n;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); });
    });

    setInterval(function () {
      goTo((current + 1) % slides.length);
    }, 4500);
  });
}());
